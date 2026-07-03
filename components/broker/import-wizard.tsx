"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileText,
  FolderInput,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  brokerInsuranceTypeLabels,
  brokerInsuranceTypes,
} from "@/lib/broker/clients";
import {
  brokerDocumentCategories,
  brokerDocumentCategoryLabels,
} from "@/lib/broker/documents";
import {
  MAX_IMPORT_FILES,
  importGroupDisplayName,
  readExtraction,
} from "@/lib/broker/imports";
import type {
  BrokerImportBatchRow,
  BrokerImportFileRow,
  BrokerImportGroupRow,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Upload helpers
// ---------------------------------------------------------------------------
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  tif: "image/tiff",
  tiff: "image/tiff",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

// Non-standard folder-selection attributes, cast to valid input props once.
const directoryInputProps = {
  webkitdirectory: "",
  directory: "",
} as unknown as React.InputHTMLAttributes<HTMLInputElement>;

/** Whether we can upload this file (supported extension). */
function isSupported(name: string): boolean {
  return Boolean(MIME_BY_EXT[extOf(name)]);
}

type StagedEntry = { blob: Blob; path: string; name: string };

// --- File System Access API (Chromium) --------------------------------------
// Reads a picked folder's tree directly — including EMPTY sub-folders that a
// classic <input webkitdirectory> silently drops (the browser only hands over
// files). Falls back to the input when the API is unavailable.
interface FsFileHandle {
  kind: "file";
  getFile(): Promise<File>;
}
interface FsDirHandle {
  kind: "directory";
  entries(): AsyncIterableIterator<[string, FsFileHandle | FsDirHandle]>;
}

function getDirectoryPicker(): (() => Promise<FsDirHandle>) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    showDirectoryPicker?: () => Promise<FsDirHandle>;
  };
  return typeof w.showDirectoryPicker === "function"
    ? w.showDirectoryPicker.bind(w)
    : null;
}

/** Walks a directory handle into staged files + the list of empty top folders. */
async function readDirectoryTree(
  root: FsDirHandle,
): Promise<{ entries: StagedEntry[]; emptyFolders: string[] }> {
  const entries: StagedEntry[] = [];
  const dirTops = new Set<string>();
  const fileTops = new Set<string>();

  async function walk(dir: FsDirHandle, prefix: string, top: string) {
    for await (const [name, handle] of dir.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      const topSeg = top || name;
      if (handle.kind === "directory") {
        dirTops.add(topSeg);
        await walk(handle, path, topSeg);
      } else if (!name.startsWith(".") && isSupported(name)) {
        const file = await handle.getFile();
        if (top) fileTops.add(top); // only files that live under a folder
        entries.push({ blob: file, name, path });
      }
    }
  }

  await walk(root, "", "");
  const emptyFolders = [...dirTops].filter((f) => !fileTops.has(f));
  return { entries, emptyFolders };
}

/** Builds a File with a correct MIME type (zip blobs & some folder files lack one). */
function toUploadFile(entry: StagedEntry): File {
  const mime = MIME_BY_EXT[extOf(entry.name)] || "application/octet-stream";
  return new File([entry.blob], entry.name, { type: mime });
}

async function runPool<T>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Phase =
  | "home"
  | "uploading"
  | "analyzing"
  | "review"
  | "committing"
  | "done";

type ScanClient = {
  clientId: string;
  clientName: string;
  email: string;
  attachments: {
    ref: string;
    messageId: string;
    attachmentId: string;
    fileName: string;
    contentType: string;
    size: number;
    subject: string;
    receivedAt: string;
    suggestedCategory: string;
  }[];
};

const batchStatusLabels: Record<string, string> = {
  uploading: "Dépôt en cours",
  analyzing: "Analyse en cours",
  review: "À vérifier",
  committing: "Import en cours",
  completed: "Terminé",
  failed: "Échec",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ImportWizard({ storageFull }: { storageFull: boolean }) {
  const [phase, setPhase] = React.useState<Phase>("home");
  const [batches, setBatches] = React.useState<BrokerImportBatchRow[]>([]);
  const [loadingHome, setLoadingHome] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const [batchId, setBatchId] = React.useState<string | null>(null);
  const [uploadDone, setUploadDone] = React.useState(0);
  const [uploadTotal, setUploadTotal] = React.useState(0);
  const [analyzeDone, setAnalyzeDone] = React.useState(0);
  const [analyzeTotal, setAnalyzeTotal] = React.useState(0);

  const [groups, setGroups] = React.useState<BrokerImportGroupRow[]>([]);
  const [files, setFiles] = React.useState<BrokerImportFileRow[]>([]);

  const [commitResult, setCommitResult] = React.useState<{
    created: number;
    matched: number;
    filed: number;
  } | null>(null);

  // Post-import email attachment retrieval runs automatically (no manual step).
  const [emailPhase, setEmailPhase] = React.useState<
    "idle" | "running" | "done" | "unavailable"
  >("idle");
  const [emailFiled, setEmailFiled] = React.useState(0);

  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const zipInputRef = React.useRef<HTMLInputElement>(null);

  const loadBatches = React.useCallback(async () => {
    setLoadingHome(true);
    const res = await fetch("/api/broker/imports").catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { batches: BrokerImportBatchRow[] }
      | null;
    setBatches(data?.batches ?? []);
    setLoadingHome(false);
  }, []);

  React.useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  async function loadReview(id: string) {
    const res = await fetch(`/api/broker/imports/${id}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { batch: BrokerImportBatchRow; groups: BrokerImportGroupRow[]; files: BrokerImportFileRow[] }
      | null;
    if (!data?.batch) {
      toast.error("Import introuvable.");
      return false;
    }
    setGroups(data.groups);
    setFiles(data.files);
    return true;
  }

  // --- Pick + upload --------------------------------------------------------
  async function startImport(
    entries: StagedEntry[],
    sourceType: "folder" | "zip",
    emptyFolders: string[] = [],
  ) {
    const supported = entries.filter((e) => isSupported(e.name));
    if (supported.length === 0 && emptyFolders.length === 0) {
      toast.error("Aucun fichier exploitable", {
        description: "Formats acceptés : PDF, images, Word, Excel.",
      });
      return;
    }
    if (supported.length > MAX_IMPORT_FILES) {
      toast.error(`Trop de fichiers (max ${MAX_IMPORT_FILES}).`, {
        description: "Divisez vos fichiers en plusieurs imports.",
      });
      return;
    }

    setBusy(true);
    const createRes = await fetch("/api/broker/imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType }),
    }).catch(() => null);
    const created = (await createRes?.json().catch(() => null)) as
      | { success: true; batchId: string }
      | { success: false; message?: string }
      | null;
    if (!created || !("success" in created) || !created.success) {
      setBusy(false);
      toast.error("Impossible de démarrer l’import.");
      return;
    }

    const id = created.batchId;
    setBatchId(id);
    setUploadTotal(supported.length);
    setUploadDone(0);
    setPhase("uploading");

    let failures = 0;
    await runPool(supported, 4, async (entry) => {
      const form = new FormData();
      form.append("file", toUploadFile(entry));
      form.append("path", entry.path);
      const res = await fetch(`/api/broker/imports/${id}/files`, {
        method: "POST",
        body: form,
      }).catch(() => null);
      if (!res || !res.ok) failures += 1;
      setUploadDone((n) => n + 1);
    });

    if (failures > 0) {
      toast.warning(`${failures} fichier(s) n’ont pas pu être envoyés.`);
    }

    await runAnalyze(id, supported.length, emptyFolders);
  }

  // --- Analyze loop ---------------------------------------------------------
  async function runAnalyze(
    id: string,
    total: number,
    emptyFolders: string[] = [],
  ) {
    setAnalyzeTotal(total);
    setAnalyzeDone(0);
    setPhase("analyzing");

    let done = false;
    let guard = 0;
    while (!done && guard < total + 20) {
      guard += 1;
      const res = await fetch(`/api/broker/imports/${id}/analyze`, {
        method: "POST",
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | { success: true; analyzed: number; total: number; done: boolean }
        | { success: false; message?: string }
        | null;
      if (!data || !("success" in data) || !data.success) {
        toast.error("L’analyse a échoué. Réessayez.");
        setPhase("home");
        void loadBatches();
        return;
      }
      setAnalyzeDone(data.analyzed);
      setAnalyzeTotal(data.total);
      done = data.done;
    }

    // Group, then load the review. Empty folders (from a .zip tree) are passed
    // so they become document-less dossiers.
    const groupRes = await fetch(`/api/broker/imports/${id}/group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emptyFolders }),
    }).catch(() => null);
    if (!groupRes || !groupRes.ok) {
      toast.error("Le regroupement a échoué.");
      setPhase("home");
      void loadBatches();
      return;
    }
    const ok = await loadReview(id);
    setBusy(false);
    setPhase(ok ? "review" : "home");
    if (!ok) void loadBatches();
  }

  function handleFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (list.length === 0) return;
    const entries: StagedEntry[] = list.map((f) => ({
      blob: f,
      name: f.name,
      path:
        (f as File & { webkitRelativePath?: string }).webkitRelativePath ||
        f.name,
    }));
    void startImport(entries, "folder");
  }

  /**
   * Folder button. On Chromium we read the tree via the File System Access API
   * so EMPTY sub-folders are captured too; elsewhere we fall back to the classic
   * <input webkitdirectory> (which drops empty folders — the .zip covers that).
   */
  async function chooseFolder() {
    if (busy || storageFull) return;
    const picker = getDirectoryPicker();
    if (!picker) {
      folderInputRef.current?.click();
      return;
    }
    let root: FsDirHandle;
    try {
      root = await picker();
    } catch {
      return; // user cancelled the native picker
    }
    setBusy(true);
    try {
      const { entries, emptyFolders } = await readDirectoryTree(root);
      if (entries.length === 0 && emptyFolders.length === 0) {
        toast.error("Ce dossier ne contient aucun fichier exploitable.");
        setBusy(false);
        return;
      }
      await startImport(entries, "folder", emptyFolders);
    } catch {
      toast.error("Lecture du dossier impossible.");
      setBusy(false);
    }
  }

  async function handleZip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(file);
      const entries: StagedEntry[] = [];
      const tasks: Promise<void>[] = [];
      const dirTops = new Set<string>();
      const fileTops = new Set<string>();
      zip.forEach((path, entry) => {
        const top = path.split("/").filter(Boolean)[0] ?? "";
        if (entry.dir) {
          if (top) dirTops.add(top);
          return;
        }
        const name = path.split("/").pop() || path;
        if (name.startsWith(".") || !isSupported(name)) return;
        if (top) fileTops.add(top);
        tasks.push(
          entry.async("blob").then((blob) => {
            entries.push({ blob, name, path });
          }),
        );
      });
      await Promise.all(tasks);
      // Top-level folders present in the archive but with no usable file inside
      // → empty client folders. We still open a (document-less) dossier for each.
      const emptyFolders = [...dirTops].filter((f) => !fileTops.has(f));
      if (entries.length === 0 && emptyFolders.length === 0) {
        toast.error("L’archive ne contient aucun fichier exploitable.");
        setBusy(false);
        return;
      }
      await startImport(entries, "zip", emptyFolders);
    } catch {
      toast.error("Lecture du .zip impossible.");
      setBusy(false);
    }
  }

  // --- Review edits ---------------------------------------------------------
  async function patchGroup(
    groupId: string,
    patch: Record<string, unknown>,
  ) {
    setGroups((gs) =>
      gs.map((g) => (g.id === groupId ? { ...g, ...mapGroupPatch(patch) } : g)),
    );
    await fetch(`/api/broker/imports/${batchId}/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
  }

  async function patchFile(fileId: string, patch: Record<string, unknown>) {
    setFiles((fs) =>
      fs.map((f) => {
        if (f.id !== fileId) return f;
        const next = { ...f };
        if (typeof patch.decision === "string") next.decision = patch.decision;
        if (patch.groupId !== undefined)
          next.group_id = patch.groupId as string | null;
        if (typeof patch.category === "string")
          next.extracted = { ...readExtraction(f), doc_category: patch.category };
        return next;
      }),
    );
    await fetch(`/api/broker/imports/${batchId}/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
  }

  function confirmAll() {
    const pending = groups.filter((g) => g.status === "pending");
    setGroups((gs) =>
      gs.map((g) => (g.status === "pending" ? { ...g, status: "confirmed" } : g)),
    );
    void Promise.all(
      pending.map((g) =>
        fetch(`/api/broker/imports/${batchId}/groups/${g.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "confirmed" }),
        }).catch(() => null),
      ),
    );
  }

  // --- Commit loop ----------------------------------------------------------
  async function runCommit() {
    if (!batchId) return;
    const confirmedCount = groups.filter((g) => g.status === "confirmed").length;
    if (confirmedCount === 0) {
      toast.error("Confirmez au moins un dossier avant d’importer.");
      return;
    }
    setPhase("committing");
    let created = 0;
    let matched = 0;
    let filed = 0;
    let done = false;
    let guard = 0;
    while (!done && guard < confirmedCount + 10) {
      guard += 1;
      const res = await fetch(`/api/broker/imports/${batchId}/commit`, {
        method: "POST",
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | {
            success: true;
            done: boolean;
            createdClients: number;
            matchedClients: number;
            filedDocuments: number;
          }
        | { success: false; message?: string }
        | null;
      if (!data || !("success" in data) || !data.success) {
        toast.error(
          (data && "message" in data && data.message) ||
            "L’import n’a pas pu être finalisé.",
        );
        await loadReview(batchId);
        setPhase("review");
        return;
      }
      created += data.createdClients;
      matched += data.matchedClients;
      filed += data.filedDocuments;
      done = data.done;
    }
    setCommitResult({ created, matched, filed });
    setPhase("done");
    // Retrieve & file email attachments automatically — no manual step.
    void autoAttachEmails(batchId);
  }

  // --- Emails (automatic after import) --------------------------------------
  /**
   * Scans the connected Outlook for the just-imported clients and files every
   * relevant attachment into their dossier, directly. Tiny images (signature
   * logos) are skipped. Runs silently if Outlook isn't connected.
   */
  async function autoAttachEmails(id: string) {
    setEmailPhase("running");
    setEmailFiled(0);
    const scanRes = await fetch(`/api/broker/imports/${id}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan" }),
    }).catch(() => null);
    const scan = (await scanRes?.json().catch(() => null)) as
      | { clients: ScanClient[]; mailbox: string }
      | { success: false; message?: string }
      | null;
    if (!scan || "success" in scan) {
      // Outlook not connected / unavailable → nothing to do, stay silent.
      setEmailPhase("unavailable");
      return;
    }

    const items: {
      clientId: string;
      messageId: string;
      attachmentId: string;
      fileName: string;
      contentType: string;
      category: string;
    }[] = [];
    for (const c of scan.clients) {
      for (const a of c.attachments) {
        // Skip email-signature logos / tiny images.
        if (a.contentType?.startsWith("image/") && a.size < 15_000) continue;
        items.push({
          clientId: c.clientId,
          messageId: a.messageId,
          attachmentId: a.attachmentId,
          fileName: a.fileName,
          contentType: a.contentType,
          category: a.suggestedCategory,
        });
      }
    }
    if (items.length === 0) {
      setEmailFiled(0);
      setEmailPhase("done");
      return;
    }

    let filed = 0;
    for (let i = 0; i < items.length; i += 40) {
      const res = await fetch(`/api/broker/imports/${id}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach", items: items.slice(i, i + 40) }),
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | { success: true; filed: number }
        | { success: false; message?: string }
        | null;
      if (data && "success" in data && data.success) filed += data.filed;
    }
    setEmailFiled(filed);
    setEmailPhase("done");
    if (filed > 0) {
      toast.success(
        `${filed} pièce(s) jointe(s) d'emails rangée(s) automatiquement.`,
      );
    }
  }

  async function discardBatch(id: string) {
    await fetch(`/api/broker/imports/${id}`, { method: "DELETE" }).catch(() => null);
    void loadBatches();
  }

  function reset() {
    setBatchId(null);
    setGroups([]);
    setFiles([]);
    setCommitResult(null);
    setEmailPhase("idle");
    setEmailFiled(0);
    setPhase("home");
    void loadBatches();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (phase === "home") {
    return (
      <HomeScreen
        storageFull={storageFull}
        busy={busy}
        loading={loadingHome}
        batches={batches}
        folderInputRef={folderInputRef}
        zipInputRef={zipInputRef}
        onPickFolder={() => void chooseFolder()}
        onFolder={handleFolder}
        onZip={handleZip}
        onResume={async (b) => {
          setBatchId(b.id);
          if (b.status === "review") {
            const ok = await loadReview(b.id);
            if (ok) setPhase("review");
          }
        }}
        onDiscard={discardBatch}
      />
    );
  }

  if (phase === "uploading" || phase === "analyzing") {
    const isUpload = phase === "uploading";
    const done = isUpload ? uploadDone : analyzeDone;
    const total = isUpload ? uploadTotal : analyzeTotal;
    return (
      <ProgressScreen
        title={isUpload ? "Envoi des fichiers…" : "Lecture et classement…"}
        subtitle={
          isUpload
            ? "Vos documents sont transférés en sécurité."
            : "L’assistant lit chaque pièce pour identifier le client et la nature du document."
        }
        done={done}
        total={total}
      />
    );
  }

  if (phase === "committing") {
    return (
      <ProgressScreen
        title="Création des dossiers…"
        subtitle="Les clients sont créés et les pièces rangées dans leur dossier."
        done={0}
        total={0}
        indeterminate
      />
    );
  }

  if (phase === "done") {
    return (
      <DoneScreen
        result={commitResult}
        emailPhase={emailPhase}
        emailFiled={emailFiled}
        onDone={reset}
      />
    );
  }

  // review
  return (
    <ReviewScreen
      groups={groups}
      files={files}
      onPatchGroup={patchGroup}
      onPatchFile={patchFile}
      onConfirmAll={confirmAll}
      onCommit={runCommit}
      onCancel={reset}
    />
  );
}

/** Reflects a PATCH payload back onto a local group row. */
function mapGroupPatch(patch: Record<string, unknown>): Partial<BrokerImportGroupRow> {
  const out: Partial<BrokerImportGroupRow> = {};
  const s = (k: string) => (typeof patch[k] === "string" ? (patch[k] as string) : undefined);
  if ("clientType" in patch) out.client_type = s("clientType") ?? "individual";
  if ("firstName" in patch) out.first_name = (patch.firstName as string) || null;
  if ("lastName" in patch) out.last_name = (patch.lastName as string) || null;
  if ("companyName" in patch) out.company_name = (patch.companyName as string) || null;
  if ("email" in patch) out.email = (patch.email as string) || null;
  if ("insuranceType" in patch) out.insurance_type = (patch.insuranceType as string) || null;
  if ("status" in patch) out.status = s("status") ?? "pending";
  if ("matchClientId" in patch) out.match_client_id = (patch.matchClientId as string) || null;
  return out;
}

// ---------------------------------------------------------------------------
// Sub-screens
// ---------------------------------------------------------------------------
const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-1)",
  borderRadius: "12px",
};

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
      style={{
        background: "var(--brand-navy-800)",
        color: "#FFFFFF",
        border: "1px solid var(--brand-navy-800)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[13px] font-medium transition-colors disabled:opacity-50"
      style={{
        background: "transparent",
        color: "var(--fg-2)",
        border: "1px solid var(--border-1)",
      }}
    >
      {children}
    </button>
  );
}

function HomeScreen({
  storageFull,
  busy,
  loading,
  batches,
  folderInputRef,
  zipInputRef,
  onPickFolder,
  onFolder,
  onZip,
  onResume,
  onDiscard,
}: {
  storageFull: boolean;
  busy: boolean;
  loading: boolean;
  batches: BrokerImportBatchRow[];
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  zipInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFolder: () => void;
  onFolder: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZip: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResume: (b: BrokerImportBatchRow) => void;
  onDiscard: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {storageFull ? (
        <div
          className="flex items-center gap-2 rounded-lg border p-3 text-[13px]"
          style={{
            borderColor: "var(--border-1)",
            background: "var(--accent-soft)",
            color: "var(--accent-foreground)",
          }}
        >
          <AlertCircle className="size-4 shrink-0" strokeWidth={2} />
          Votre espace de stockage est plein. Libérez de la place avant d’importer.
        </div>
      ) : null}

      <div
        className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center"
        style={{ ...cardStyle, borderStyle: "dashed" }}
      >
        <div
          className="flex size-12 items-center justify-center rounded-full"
          style={{ background: "var(--accent-soft)", color: "var(--accent-foreground)" }}
        >
          <FolderInput className="size-6" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--fg-1)]">
            Déposez vos dossiers clients
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-[var(--fg-3)]">
            Déposez une archive{" "}
            <strong className="font-semibold text-[var(--fg-2)]">.zip</strong> de
            vos dossiers clients — ou un dossier entier. Peu importe
            l’organisation : l’assistant lit chaque pièce, regroupe par client et{" "}
            <strong className="font-semibold text-[var(--fg-2)]">
              reprend le nom de chaque sous-dossier comme nom du dossier client
            </strong>
            .
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <PrimaryButton
              onClick={() => zipInputRef.current?.click()}
              disabled={busy || storageFull}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Upload className="size-3.5" strokeWidth={2} />
              )}
              Importer un .zip
            </PrimaryButton>
            <GhostButton
              onClick={onPickFolder}
              disabled={busy || storageFull}
            >
              <FolderInput className="size-3.5" strokeWidth={2} />
              Choisir un dossier
            </GhostButton>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent-foreground)",
              border: "1px solid var(--brand-amber-200, rgba(184,146,42,0.25))",
            }}
          >
            <Sparkles className="size-3" strokeWidth={2} />
            .zip recommandé — reprise complète, rien n’est perdu
          </span>
        </div>
        <p className="text-[11px] text-[var(--fg-4)]">
          PDF, images, Word, Excel — jusqu’à {MAX_IMPORT_FILES} fichiers par import.
        </p>
        <p className="mx-auto max-w-md text-[11.5px] leading-5 text-[var(--fg-4)]">
          Les <strong className="font-medium">sous-dossiers vides</strong> nommés
          au nom d’un client créent quand même leur dossier — rien n’est perdu. Le{" "}
          <strong className="font-medium">.zip</strong> marche partout ;
          « Choisir un dossier » les récupère aussi sur Chrome et Edge.
        </p>
        <input
          ref={folderInputRef}
          type="file"
          multiple
          onChange={onFolder}
          className="hidden"
          {...directoryInputProps}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip"
          onChange={onZip}
          className="hidden"
        />
      </div>

      {!loading && batches.length > 0 ? (
        <div className="space-y-2.5">
          <p className="fd-eyebrow">Imports récents</p>
          <div style={cardStyle} className="divide-y" >
            {batches.map((b) => {
              const resumable = b.status === "review";
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ borderColor: "var(--border-1)" }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--fg-1)]">
                      {new Date(b.created_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {b.file_count} fichier{b.file_count > 1 ? "s" : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--fg-3)]">
                      {batchStatusLabels[b.status] ?? b.status}
                      {b.status === "completed" && b.group_count
                        ? ` · ${b.group_count} dossier${b.group_count > 1 ? "s" : ""}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {resumable ? (
                      <GhostButton onClick={() => onResume(b)}>
                        Reprendre <ArrowRight className="size-3.5" strokeWidth={2} />
                      </GhostButton>
                    ) : null}
                    {b.status !== "completed" && b.status !== "committing" ? (
                      <button
                        type="button"
                        onClick={() => onDiscard(b.id)}
                        className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-sunken)]"
                        style={{ color: "var(--fg-3)" }}
                        aria-label="Supprimer cet import"
                      >
                        <Trash2 className="size-3.5" strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProgressScreen({
  title,
  subtitle,
  done,
  total,
  indeterminate,
}: {
  title: string;
  subtitle: string;
  done: number;
  total: number;
  indeterminate?: boolean;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className="flex flex-col items-center gap-4 px-6 py-14 text-center"
      style={cardStyle}
    >
      <Loader2 className="size-7 animate-spin text-[var(--accent)]" strokeWidth={2} />
      <div>
        <h2 className="text-[16px] font-semibold text-[var(--fg-1)]">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-6 text-[var(--fg-3)]">
          {subtitle}
        </p>
      </div>
      <div
        className="h-2 w-full max-w-sm overflow-hidden rounded-full"
        style={{ background: "var(--bg-sunken)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: indeterminate ? "40%" : `${pct}%`,
            background: "var(--accent)",
            animation: indeterminate ? "pulse 1.4s ease-in-out infinite" : undefined,
          }}
        />
      </div>
      {!indeterminate ? (
        <p className="text-[12px] tabular-nums text-[var(--fg-3)]">
          {done} / {total}
        </p>
      ) : null}
    </div>
  );
}

function ReviewScreen({
  groups,
  files,
  onPatchGroup,
  onPatchFile,
  onConfirmAll,
  onCommit,
  onCancel,
}: {
  groups: BrokerImportGroupRow[];
  files: BrokerImportFileRow[];
  onPatchGroup: (id: string, patch: Record<string, unknown>) => void;
  onPatchFile: (id: string, patch: Record<string, unknown>) => void;
  onConfirmAll: () => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const filesByGroup = React.useMemo(() => {
    const map = new Map<string, BrokerImportFileRow[]>();
    for (const f of files) {
      if (!f.group_id) continue;
      const arr = map.get(f.group_id) ?? [];
      arr.push(f);
      map.set(f.group_id, arr);
    }
    return map;
  }, [files]);

  const ungrouped = files.filter((f) => !f.group_id);
  const confirmed = groups.filter((g) => g.status === "confirmed").length;
  const groupOptions = groups.map((g) => ({
    id: g.id,
    label: importGroupDisplayName(g),
  }));

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
        style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
      >
        <p className="text-[13px] text-[var(--fg-2)]">
          <span className="font-semibold text-[var(--fg-1)]">{groups.length}</span>{" "}
          dossier{groups.length > 1 ? "s" : ""} proposé{groups.length > 1 ? "s" : ""}
          {" · "}
          <span className="font-semibold text-[var(--fg-1)]">{confirmed}</span> confirmé
          {confirmed > 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <GhostButton onClick={onCancel}>Annuler</GhostButton>
          <GhostButton onClick={onConfirmAll}>
            <Check className="size-3.5" strokeWidth={2} /> Tout confirmer
          </GhostButton>
          <PrimaryButton onClick={onCommit} disabled={confirmed === 0}>
            Importer {confirmed > 0 ? `(${confirmed})` : ""}
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </PrimaryButton>
        </div>
      </div>

      {groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          files={filesByGroup.get(group.id) ?? []}
          groupOptions={groupOptions}
          onPatchGroup={onPatchGroup}
          onPatchFile={onPatchFile}
        />
      ))}

      {ungrouped.length > 0 ? (
        <div style={cardStyle} className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="size-4 text-[var(--fg-3)]" strokeWidth={2} />
            <h3 className="text-[14px] font-semibold text-[var(--fg-1)]">
              À trier — {ungrouped.length} fichier{ungrouped.length > 1 ? "s" : ""}
            </h3>
          </div>
          <p className="mb-3 text-[12px] text-[var(--fg-3)]">
            Ces pièces n’ont pas pu être rattachées automatiquement. Affectez-les à
            un dossier ou laissez-les de côté.
          </p>
          <div className="space-y-2">
            {ungrouped.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                groupOptions={groupOptions}
                onPatchFile={onPatchFile}
                showAssign
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupCard({
  group,
  files,
  groupOptions,
  onPatchGroup,
  onPatchFile,
}: {
  group: BrokerImportGroupRow;
  files: BrokerImportFileRow[];
  groupOptions: { id: string; label: string }[];
  onPatchGroup: (id: string, patch: Record<string, unknown>) => void;
  onPatchFile: (id: string, patch: Record<string, unknown>) => void;
}) {
  const matched = Boolean(group.match_client_id);
  const skipped = group.status === "skipped";
  const confirmed = group.status === "confirmed";

  return (
    <div
      style={{ ...cardStyle, opacity: skipped ? 0.55 : 1 }}
      className="overflow-hidden"
    >
      <div
        className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--border-1)" }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={
                matched
                  ? { background: "var(--success-soft, #F0FDF4)", color: "var(--success, #15803D)" }
                  : { background: "var(--accent-soft)", color: "var(--accent-foreground)" }
              }
            >
              {matched ? "Rattaché à un client" : "Nouveau dossier"}
            </span>
            {typeof group.confidence === "number" ? (
              <span className="text-[11px] text-[var(--fg-4)]">
                fiabilité {Math.round(group.confidence * 100)}%
              </span>
            ) : null}
            <span className="text-[11px] text-[var(--fg-4)]">
              {files.length} pièce{files.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={group.client_type}
              onChange={(e) =>
                onPatchGroup(group.id, { clientType: e.target.value })
              }
              className="h-8 rounded-md border px-2 text-[12px]"
              style={{ borderColor: "var(--border-1)", background: "var(--bg-canvas)", color: "var(--fg-1)" }}
            >
              <option value="individual">Particulier</option>
              <option value="company">Entreprise</option>
            </select>

            {group.client_type === "company" ? (
              <TextField
                value={group.company_name ?? ""}
                placeholder="Nom de l’entreprise"
                onCommit={(v) => onPatchGroup(group.id, { companyName: v })}
              />
            ) : (
              <>
                <TextField
                  value={group.first_name ?? ""}
                  placeholder="Prénom"
                  onCommit={(v) => onPatchGroup(group.id, { firstName: v })}
                />
                <TextField
                  value={group.last_name ?? ""}
                  placeholder="Nom"
                  onCommit={(v) => onPatchGroup(group.id, { lastName: v })}
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TextField
              value={group.email ?? ""}
              placeholder="email@client.fr"
              onCommit={(v) => onPatchGroup(group.id, { email: v })}
              width="w-56"
            />
            <select
              value={group.insurance_type ?? ""}
              onChange={(e) =>
                onPatchGroup(group.id, { insuranceType: e.target.value })
              }
              className="h-8 rounded-md border px-2 text-[12px]"
              style={{ borderColor: "var(--border-1)", background: "var(--bg-canvas)", color: "var(--fg-1)" }}
            >
              <option value="">Branche…</option>
              {brokerInsuranceTypes.map((t) => (
                <option key={t} value={t}>
                  {brokerInsuranceTypeLabels[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {confirmed ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--success,#15803D)]">
              <Check className="size-3.5" strokeWidth={2.5} /> Confirmé
            </span>
          ) : (
            <GhostButton onClick={() => onPatchGroup(group.id, { status: "confirmed" })}>
              Confirmer
            </GhostButton>
          )}
          <button
            type="button"
            onClick={() =>
              onPatchGroup(group.id, { status: skipped ? "pending" : "skipped" })
            }
            className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ color: "var(--fg-3)" }}
            aria-label={skipped ? "Réactiver" : "Ignorer ce dossier"}
          >
            {skipped ? <RefreshCw className="size-3.5" strokeWidth={2} /> : <X className="size-3.5" strokeWidth={2} />}
          </button>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        {files.map((f) => (
          <FileRow
            key={f.id}
            file={f}
            groupOptions={groupOptions}
            onPatchFile={onPatchFile}
          />
        ))}
      </div>
    </div>
  );
}

function FileRow({
  file,
  groupOptions,
  onPatchFile,
  showAssign,
}: {
  file: BrokerImportFileRow;
  groupOptions: { id: string; label: string }[];
  onPatchFile: (id: string, patch: Record<string, unknown>) => void;
  showAssign?: boolean;
}) {
  const ex = readExtraction(file);
  const excluded = file.decision === "exclude";
  const category =
    typeof ex.doc_category === "string" ? ex.doc_category : "other";

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5"
      style={{ background: excluded ? "transparent" : "var(--bg-canvas)", opacity: excluded ? 0.5 : 1 }}
    >
      <FileText className="size-4 shrink-0 text-[var(--fg-3)]" strokeWidth={2} />
      <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--fg-2)]" title={file.original_path}>
        {file.file_name}
      </span>

      <select
        value={category}
        onChange={(e) => onPatchFile(file.id, { category: e.target.value })}
        className="h-7 rounded-md border px-1.5 text-[11px]"
        style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)", color: "var(--fg-1)" }}
      >
        {brokerDocumentCategories.map((c) => (
          <option key={c} value={c}>
            {brokerDocumentCategoryLabels[c]}
          </option>
        ))}
      </select>

      {showAssign ? (
        <select
          value={file.group_id ?? ""}
          onChange={(e) =>
            onPatchFile(file.id, { groupId: e.target.value || null })
          }
          className="h-7 max-w-[160px] rounded-md border px-1.5 text-[11px]"
          style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)", color: "var(--fg-1)" }}
        >
          <option value="">Aucun dossier</option>
          {groupOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : null}

      <button
        type="button"
        onClick={() =>
          onPatchFile(file.id, { decision: excluded ? "include" : "exclude" })
        }
        className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-sunken)]"
        style={{ color: "var(--fg-3)" }}
        aria-label={excluded ? "Réinclure" : "Exclure"}
      >
        {excluded ? <RefreshCw className="size-3.5" strokeWidth={2} /> : <X className="size-3.5" strokeWidth={2} />}
      </button>
    </div>
  );
}

/** Small uncontrolled-on-blur text input (commits only when the value changes). */
function TextField({
  value,
  placeholder,
  onCommit,
  width = "w-40",
}: {
  value: string;
  placeholder: string;
  onCommit: (v: string) => void;
  width?: string;
}) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);
  return (
    <input
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local.trim())}
      className={`h-8 rounded-md border px-2 text-[12px] ${width}`}
      style={{ borderColor: "var(--border-1)", background: "var(--bg-canvas)", color: "var(--fg-1)" }}
    />
  );
}

function DoneScreen({
  result,
  emailPhase,
  emailFiled,
  onDone,
}: {
  result: { created: number; matched: number; filed: number } | null;
  emailPhase: "idle" | "running" | "done" | "unavailable";
  emailFiled: number;
  onDone: () => void;
}) {
  const running = emailPhase === "running";

  return (
    <div className="space-y-5">
      <div
        className="flex flex-col items-center gap-3 px-6 py-10 text-center"
        style={cardStyle}
      >
        <div
          className="flex size-12 items-center justify-center rounded-full"
          style={{ background: "var(--success-soft, #F0FDF4)", color: "var(--success, #15803D)" }}
        >
          <Check className="size-6" strokeWidth={2.5} />
        </div>
        <h2 className="text-[17px] font-semibold text-[var(--fg-1)]">
          Clients importés
        </h2>
        <p className="max-w-md text-[13px] leading-6 text-[var(--fg-3)]">
          {result
            ? `${result.created} dossier(s) créé(s), ${result.matched} rattaché(s) à un client existant, ${result.filed} pièce(s) rangée(s).`
            : "Vos dossiers ont été créés."}
        </p>
      </div>

      <div style={cardStyle} className="p-5">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-[var(--fg-1)]">
              Pièces jointes des emails
            </h3>
            {running ? (
              <p className="mt-1 flex items-center gap-2 text-[13px] leading-6 text-[var(--fg-3)]">
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                Recherche dans votre boîte Outlook et rangement automatique des
                pièces jointes dans les bons dossiers…
              </p>
            ) : emailPhase === "unavailable" ? (
              <p className="mt-1 text-[13px] leading-6 text-[var(--fg-3)]">
                Connectez votre boîte Outlook pour que les pièces jointes des
                emails de ces clients soient rangées automatiquement.
              </p>
            ) : emailPhase === "done" ? (
              <p className="mt-1 text-[13px] leading-6 text-[var(--fg-3)]">
                {emailFiled > 0
                  ? `${emailFiled} pièce(s) jointe(s) récupérée(s) dans les emails et rangée(s) automatiquement dans les dossiers.`
                  : "Aucune pièce jointe à récupérer dans les emails. Les emails, eux, apparaissent déjà dans chaque dossier."}
              </p>
            ) : (
              <p className="mt-1 text-[13px] leading-6 text-[var(--fg-3)]">
                Les pièces jointes des emails de ces clients sont rangées
                automatiquement dans les bons dossiers.
              </p>
            )}

            <div className="mt-4">
              <PrimaryButton onClick={onDone} disabled={running}>
                {running ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Check className="size-3.5" strokeWidth={2} />
                )}
                Terminer
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
