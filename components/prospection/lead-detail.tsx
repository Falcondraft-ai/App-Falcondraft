"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Phone,
  Calendar,
  MapPin,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ProspectionStatusDropdown,
} from "@/components/prospection/status-badge";
import { DocumentsSection } from "@/components/prospection/documents-section";
import type {
  ProspectCompanyRow,
  ProspectInteractionRow,
  ProspectTaskRow,
  ProspectDocumentRow,
} from "@/types/database";

type ProspectTaskWithCompany = ProspectTaskRow & {
  company_name?: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "\u2013";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value: string | null): string {
  if (!value) return "\u2013";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const interactionTypeIcons: Record<string, string> = {
  call: "📞",
  note: "📝",
  status_change: "🔄",
  system: "⚙️",
};

const taskTypeLabels: Record<string, string> = {
  call: "Appel",
  email: "Email",
  follow_up: "Relance",
  meeting: "RDV",
  qualification: "Qualification",
};

export function LeadDetail({
  company,
  initialInteractions,
  initialTasks,
  initialDocuments,
  isManager,
}: {
  company: ProspectCompanyRow;
  initialInteractions: ProspectInteractionRow[];
  initialTasks: ProspectTaskWithCompany[];
  initialDocuments: ProspectDocumentRow[];
  isManager: boolean;
}) {
  const [data, setData] = React.useState(company);
  const [interactions, setInteractions] = React.useState(initialInteractions);
  const [tasks, setTasks] = React.useState(initialTasks);
  const [saving, setSaving] = React.useState(false);

  const [meetingUrl, setMeetingUrl] = React.useState(
    data.meeting_url ?? "",
  );
  const [meetingPlatform, setMeetingPlatform] = React.useState(
    data.meeting_platform ?? "",
  );
  const [noteText, setNoteText] = React.useState("");
  const [addingNote, setAddingNote] = React.useState(false);

  async function handleApi(body: Record<string, string>) {
    setSaving(true);
    try {
      const res = await fetch("/api/prospection/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: data.id, ...body }),
      });
      return await res.json();
    } catch {
      return { success: false };
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    const result = await handleApi({ action: "change_status", status: newStatus });
    if (result.success) {
      setData((prev) => ({ ...prev, status: newStatus }));
    }
  }

  async function handleAssignCloser(closer: string) {
    const result = await handleApi({ action: "assign_closer", closer });
    if (result.success) {
      setData((prev) => ({ ...prev, assigned_closer: closer }));
    }
  }

  async function handleMarkCalled() {
    const result = await handleApi({ action: "mark_called" });
    if (result.success) {
      setData((prev) => ({
        ...prev,
        status: "called",
        last_called_at: new Date().toISOString(),
      }));
    }
  }

  async function handleArchive() {
    const result = await handleApi({ action: "archive" });
    if (result.success) {
      setData((prev) => ({ ...prev, status: "archived" }));
    }
  }

  async function handleSaveMeeting() {
    const result = await handleApi({
      action: "update_meeting",
      meetingUrl: meetingUrl,
      meetingPlatform: meetingPlatform,
    });
    if (result.success) {
      setData((prev) => ({
        ...prev,
        meeting_url: meetingUrl || null,
        meeting_platform: meetingPlatform || null,
      }));
      if (meetingUrl || meetingPlatform) {
        setSaving(false);
      }
    }
  }

  async function handleAddNote() {
    if (!noteText.trim() || addingNote) return;
    setAddingNote(true);
    try {
      const res = await fetch("/api/prospection/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: data.id,
          action: "add_note",
          content: noteText.trim(),
        }),
      });
      const result = await res.json();
      if (result.success) {
        setInteractions((prev) => [
          {
            id: `temp-${Date.now()}`,
            organization_id: "",
            company_id: data.id,
            contact_id: null,
            type: "note",
            channel: "manual",
            content: noteText.trim(),
            result: "noted",
            created_by: null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setNoteText("");
      }
    } catch {
      // silently fail
    } finally {
      setAddingNote(false);
    }
  }

  async function handleMarkTaskDone(taskId: string) {
    try {
      const res = await fetch("/api/prospection/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: "mark_task_done" }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: "done" } : t,
          ),
        );
      }
    } catch {
      // silently fail
    }
  }

  const pendingTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/prospection">
            <ArrowLeft className="size-4 mr-1.5" />
            Retour
          </Link>
        </Button>
      </div>

      <div className="border border-slate-900/15 bg-slate-950 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/72">
              Détail du lead
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {data.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ProspectionStatusDropdown
              status={data.status}
              onStatusChange={handleStatusChange}
              disabled={saving}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border rounded-lg overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Informations
              </h2>
            </div>
            <div className="p-4 grid gap-4 sm:grid-cols-2">
              {data.website && (
                <div className="flex items-start gap-2">
                  <Globe className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Site web</p>
                    <a
                      href={
                        data.website.startsWith("http")
                          ? data.website
                          : `https://${data.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline truncate block"
                    >
                      {data.website_domain ?? data.website}
                      <ExternalLink className="size-3 inline ml-1" />
                    </a>
                  </div>
                </div>
              )}
              {data.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Téléphone</p>
                    <p className="text-sm font-medium">{data.phone}</p>
                  </div>
                </div>
              )}
              {data.formatted_address && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Adresse</p>
                    <p className="text-sm">{data.formatted_address}</p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Ville</p>
                <p className="text-sm">{data.city ?? "\u2013"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Région</p>
                <p className="text-sm">{data.region ?? "\u2013"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pays</p>
                <p className="text-sm">{data.country ?? "\u2013"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Niche</p>
                <p className="text-sm">{data.niche ?? "\u2013"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Catégorie</p>
                <p className="text-sm">
                  {data.category_query ?? "\u2013"}
                </p>
              </div>
              {data.google_primary_type_display_name && (
                <div>
                  <p className="text-xs text-muted-foreground">Type Google</p>
                  <p className="text-sm">
                    {data.google_primary_type_display_name}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Note Google</p>
                <p className="text-sm">
                  {data.rating != null
                    ? `${data.rating} (${data.user_rating_count ?? 0} avis)`
                    : "\u2013"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fit score</p>
                <p className="text-sm">
                  {data.fit_score != null ? `${data.fit_score}/100` : "Non scoré"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Priorité</p>
                <p className="text-sm">
                  {data.priority ?? "Non définie"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Dates</p>
                <p className="text-sm text-muted-foreground">
                  Dernier appel: {formatShortDate(data.last_called_at)}
                  {" · "}
                  Dernier contact: {formatShortDate(data.last_contacted_at)}
                  {" · "}
                  Prochaine action: {formatShortDate(data.next_action_at)}
                </p>
              </div>
            </div>
          </Card>

          {data.reason_for_fit && (
            <Card className="border rounded-lg overflow-hidden">
              <div className="border-b bg-muted/40 px-4 py-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Analyse du fit
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Raison du fit
                  </p>
                  <p className="text-sm mt-0.5">{data.reason_for_fit}</p>
                </div>
                {data.recommended_angle && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Angle recommandé
                    </p>
                    <p className="text-sm mt-0.5">
                      {data.recommended_angle}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="border rounded-lg overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Notes
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Ajouter une note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="min-h-20 text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) {
                      handleAddNote();
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="shrink-0 self-end"
                  disabled={!noteText.trim() || addingNote}
                  onClick={handleAddNote}
                >
                  {addingNote ? "..." : "Ajouter"}
                </Button>
              </div>

              {interactions.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Historique
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {interactions.map((ix) => (
                      <div
                        key={ix.id}
                        className="flex items-start gap-3 text-sm border-b border-muted pb-2 last:border-0"
                      >
                        <span className="text-base mt-0.5 shrink-0">
                          {interactionTypeIcons[ix.type] ?? "📌"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {ix.type === "note"
                                ? "Note"
                                : ix.type === "call"
                                  ? "Appel"
                                  : ix.type === "status_change"
                                    ? "Changement statut"
                                    : ix.type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(ix.created_at)}
                            </span>
                          </div>
                          {ix.content && (
                            <p className="text-sm mt-0.5 whitespace-pre-wrap">
                              {ix.content}
                            </p>
                          )}
                          {ix.result && !ix.content && (
                            <p className="text-sm mt-0.5 text-muted-foreground">
                              Résultat: {ix.result}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {tasks.length > 0 && (
            <Card className="border rounded-lg overflow-hidden">
              <div className="border-b bg-muted/40 px-4 py-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Tâches
                </h2>
              </div>
              <div className="divide-y">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="mt-0.5 shrink-0"
                      onClick={() => handleMarkTaskDone(task.id)}
                    >
                      <Check className="size-3.5" />
                    </Button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                        {task.type && (
                          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                            {taskTypeLabels[task.type] ?? task.type}
                          </span>
                        )}
                        {task.due_at && (
                          <span>{formatShortDate(task.due_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.filter((t) => t.status === "done").map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 px-4 py-3 opacity-50"
                  >
                    <div className="mt-0.5 shrink-0 rounded border p-1 text-emerald-600">
                      <Check className="size-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm line-through">
                        {task.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <DocumentsSection
            initialDocuments={initialDocuments}
            companyId={company.id}
            isManager={isManager}
          />
        </div>

        <div className="space-y-4">
          <Card className="border rounded-lg overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Actions
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Closer
                </p>
                <Select
                  value={data.assigned_closer ?? ""}
                  onValueChange={handleAssignCloser}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Non assigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Timéo">Timéo</SelectItem>
                    <SelectItem value="Enzo">Enzo</SelectItem>
                    <SelectItem value="Margot">Margot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleMarkCalled}
                disabled={saving}
              >
                <Phone className="size-3.5 mr-2" />
                Marquer comme appelé
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-red-600 hover:text-red-700 dark:text-red-400"
                onClick={handleArchive}
                disabled={saving}
              >
                Archiver le lead
              </Button>
            </div>
          </Card>

          <Card className="border rounded-lg overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Réunion
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Lien de réunion</Label>
                <Input
                  placeholder="https://meet.google.com/..."
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Plateforme</Label>
                <Select
                  value={meetingPlatform}
                  onValueChange={setMeetingPlatform}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Non définie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Calendly">Calendly</SelectItem>
                    <SelectItem value="Google Meet">Google Meet</SelectItem>
                    <SelectItem value="Zoom">Zoom</SelectItem>
                    <SelectItem value="Microsoft Teams">
                      Microsoft Teams
                    </SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={handleSaveMeeting}
                disabled={saving || (!meetingUrl && !meetingPlatform)}
              >
                Enregistrer
              </Button>
              {(data.meeting_url || data.meeting_platform) && (
                <div className="border-t pt-3 text-sm">
                  {data.meeting_url && (
                    <a
                      href={data.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <Calendar className="size-3.5" />
                      {data.meeting_platform
                        ? `Réunion ${data.meeting_platform}`
                        : "Lien de réunion"}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
