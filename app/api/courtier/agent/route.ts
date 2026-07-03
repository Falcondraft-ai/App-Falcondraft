import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  agentToolDefinitions,
  executeAgentTool,
  type AgentToolContext,
} from "@/lib/broker/agent-tools";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { hasProposalAutomation } from "@/lib/billing/entitlements";

export const runtime = "nodejs";
// Up to 6 tool rounds, vision document reads and an advice generation can run
// inside one turn — same budget as the Outlook digest.
export const maxDuration = 120;

// Tools that only make sense for the SaaS broker offering (commissions &
// sinistres modules). The bespoke broker never sees them.
const SAAS_ONLY_TOOLS = new Set(["get_commission_summary", "get_open_claims"]);

// Tools that modify data. Hidden from read-only roles so the model never
// plans (and pays tool rounds for) an action the executor would refuse.
const WRITE_TOOLS = new Set([
  "create_client",
  "update_client_status",
  "update_client",
  "attach_email_attachment_to_client",
  "attach_uploaded_file_to_client",
  "generate_advice",
]);

// OpenAI agentic model for the assistant (function calling + streaming).
// Configurable via env so the model/cost can be tuned without a code change.
const AGENT_MODEL = process.env.COURTIER_AGENT_MODEL || "gpt-5.5";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_TOOL_ROUNDS = 6;
const HISTORY_LIMIT = 40;
const RETENTION_DAYS = 90;

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
  attachments: z
    .array(
      z.object({
        uploadId: z.string().min(1).max(100),
        storagePath: z.string().min(1).max(400),
        fileName: z.string().min(1).max(300),
        mimeType: z.string().min(1).max(150),
        sizeBytes: z.number().int().nonnegative(),
      }),
    )
    .max(5)
    .optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

// [[suggestions: …]] and [[tool:…]] blocks are UI-only (quick-reply chips and
// live activity trace rendered by agent-chat). Stripped from the history sent
// to the model so it doesn't re-read its own past markers on every turn.
function stripSuggestions(content: string): string {
  const stripped = content
    .replace(/\[\[tool:[\w-]*\]\]/g, "")
    .replace(/\n?\[\[suggestions:[\s\S]*?\]\]\s*$/, "")
    .trimEnd();
  return stripped || content;
}

function textStream(text: string) {
  return new Response(text, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function buildSystemPrompt(organizationName: string, userName: string): string {
  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date());
  return [
    `Tu es l'assistant du cabinet de courtage en assurance « ${organizationName} » sur FalconDraft. Tu travailles avec ${userName}. Nous sommes le ${today}.`,
    ``,
    `RÔLE`,
    `Tu es un copilote métier : tu aides à retrouver, comprendre et faire avancer les dossiers clients du cabinet. Tu consultes les dossiers, contrats, documents, devis compagnies, devoirs de conseil, statistiques, activité et la boîte Outlook connectée du courtier, et tu peux réaliser certaines actions à la demande.`,
    ``,
    `PÉRIMÈTRE & CONFIDENTIALITÉ`,
    `- Tu n'accèdes qu'aux données de CE cabinet. Ne divulgue jamais d'informations d'un autre cabinet.`,
    `- Ne révèle pas le fonctionnement technique interne (outils, base de données, fournisseurs).`,
    ``,
    `MÉTHODE`,
    `- Avant de répondre sur des données précises (chiffres, statuts, noms, montants), appelle d'abord les outils pour obtenir l'information à jour. Ne devine jamais.`,
    `- ENCHAÎNE les outils sans t'arrêter à mi-chemin : pour une question sur un dossier, commence par le retrouver (list_clients ou find_client_by_email), puis ouvre-le (get_client) avant de répondre ou d'agir. Ne réponds pas à partir d'un simple résultat de liste.`,
    `- Pour faire le POINT sur un dossier (« où en est-on ? »), croise get_client (notes, contrats, devis, devoir de conseil, activité) avec list_client_emails (les échanges qui le concernent) : c'est l'historique complet du dossier.`,
    `- Un résultat d'outil avec "error" n'est pas une fin : explique simplement le blocage ou essaie une autre approche (autre recherche, autre orthographe). Ne montre jamais un message d'erreur technique brut.`,
    `- Si plusieurs dossiers correspondent, propose une courte liste et demande de préciser.`,
    `- Si la demande est ambiguë, pose UNE question de clarification brève plutôt que de supposer.`,
    ``,
    `ACTIONS`,
    `- Tu peux créer un dossier, mettre à jour ses informations (update_client), changer un statut, générer un devoir de conseil, ranger une pièce jointe d'email dans un dossier (attach_email_attachment_to_client), et lister les contrats d'un dossier — UNIQUEMENT si l'utilisateur le demande clairement.`,
    `- Reconnaître un client connu : devant un email, utilise find_client_by_email pour vérifier s'il s'agit d'un dossier existant AVANT de proposer d'en créer un. Si le client existe, propose plutôt de mettre à jour son dossier ou d'y ranger les pièces.`,
    `- IDENTIFIER LE BON CLIENT : le dossier concerne la personne (ou l'entreprise) ASSURÉE, pas forcément l'expéditeur de l'email. Un email peut être envoyé par un apporteur, un collègue ou un intermédiaire AU SUJET d'un tiers : dans ce cas, le dossier est au nom de ce tiers, avec SES coordonnées, jamais celles de l'expéditeur. Lis le contenu pour déterminer qui est réellement le client avant de créer un dossier. Ne crée jamais un dossier au nom de l'expéditeur s'il n'est pas lui-même l'assuré.`,
    `- LIRE LES FICHIERS : tu peux réellement ouvrir et lire un PDF ou une image. Si l'utilisateur joint un document (ou demande « c'est quoi ce fichier »), utilise inspect_uploaded_file avec son upload_id pour dire ce que c'est. Pour une pièce jointe d'email, utilise inspect_email_attachment. Sers-t'en pour identifier la nature du document, le résumer, et choisir la bonne catégorie avant de le ranger.`,
    `- Tu peux consulter la boîte Outlook : lister les emails récents, lire un email, lister ses pièces jointes (list_email_attachments), inspecter leur contenu (inspect_email_attachment), et préparer un BROUILLON de réponse (jamais d'envoi automatique — le courtier relit et envoie). Avant de rédiger une réponse, lis l'email concerné.`,
    `- Si l'utilisateur joint un fichier au message (ex. un PDF) et demande de le ranger, inspecte-le si besoin puis utilise attach_uploaded_file_to_client avec l'upload_id indiqué à côté du fichier, le bon client_id et la category détectée. Si le dossier n'est pas évident, demande-lui de préciser lequel avant de ranger.`,
    `- Avant une action qui modifie des données, assure-toi d'avoir les informations nécessaires ; sinon demande-les. Pour ranger une pièce jointe d'email, liste d'abord les pièces de l'email pour obtenir l'attachment_id.`,
    `- Après une action, confirme en une phrase ce qui a été fait et donne le lien.`,
    ``,
    `STYLE`,
    `- Réponds en français, ton professionnel et chaleureux, phrases courtes et utiles, sans jargon.`,
    `- Sois concis : va à l'essentiel, puis propose la prochaine étape si pertinent.`,
    `- Cite les dossiers sous forme de lien markdown [Nom du client](/courtier/clients/<id>) — jamais l'URL brute. Mets en avant ce qui demande une action (à valider, à signer, à relancer).`,
    `- Tu peux structurer avec du gras (**texte**) et des listes à puces (- item) quand cela aide la lecture. Pas de titres, pas de tableaux.`,
    `- N'utilise pas d'emojis.`,
    ``,
    `RESPONSABILITÉ`,
    `- Pour le devoir de conseil, rappelle que le document reste à relire, compléter et valider par le courtier : tu assistes, tu ne remplaces pas sa responsabilité professionnelle.`,
    ``,
    `SUGGESTIONS`,
    `- Termine chaque réponse par 2 à 3 suites pertinentes et contextuelles que le courtier pourrait vouloir ensuite, sur une DERNIÈRE ligne au format EXACT : [[suggestions: Première suite | Deuxième suite | Troisième suite]]`,
    `- Formule-les comme des actions courtes et concrètes ("Préparer la relance", "Voir ses contrats", "Rédiger la réponse"). Adapte-les à ce qui vient d'être dit.`,
    `- N'ajoute ce bloc QUE si une suite a du sens. N'écris rien après ce bloc.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// GET — conversation history (+ 90-day retention prune for this user)
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await auth.adminSupabase
    .from("broker_agent_messages")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.user.id)
    .lt("created_at", cutoff);

  // Most RECENT messages (a long conversation must not pin the view to its
  // oldest turns), re-ordered chronologically for display.
  const { data } = await auth.adminSupabase
    .from("broker_agent_messages")
    .select("role, content")
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  return NextResponse.json({ success: true, messages: (data ?? []).reverse() });
}

// ---------------------------------------------------------------------------
// DELETE — clear this user's conversation
// ---------------------------------------------------------------------------
export async function DELETE() {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  await auth.adminSupabase
    .from("broker_agent_messages")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.user.id);

  return NextResponse.json({ success: true });
}

// ---------------------------------------------------------------------------
// POST — stream an assistant reply (with function calling) and persist it
// ---------------------------------------------------------------------------
type ToolCallAccum = { id: string; name: string; args: string };

export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Message invalide.", 400, "invalid_payload");

  const adminSupabase = auth.adminSupabase;
  const userId = auth.user.id;
  const organization = auth.context.organization!;
  const userName = auth.context.profile?.full_name?.split(" ")[0] ?? "le courtier";
  const lastUser = parsed.data.messages[parsed.data.messages.length - 1];

  async function persist(assistantText: string) {
    await adminSupabase.from("broker_agent_messages").insert([
      {
        organization_id: organization.id,
        user_id: userId,
        role: "user",
        content: lastUser.content.slice(0, 8000),
      },
      {
        organization_id: organization.id,
        user_id: userId,
        role: "assistant",
        content: assistantText.slice(0, 8000) || "—",
      },
    ]);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return textStream(
      "L'assistant n'est pas encore activé. Ajoutez OPENAI_API_KEY pour l'activer.",
    );
  }

  const canWrite = canCreateWorkspaceRecords(auth.context.membership?.role);

  // Files attached to this turn (staged via /agent/upload), exposed to the tool
  // that files them into a dossier.
  const attachments = parsed.data.attachments ?? [];
  const pendingUploads = new Map(
    attachments.map((a) => [
      a.uploadId,
      {
        storagePath: a.storagePath,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      },
    ]),
  );

  const toolCtx: AgentToolContext = {
    adminSupabase,
    organization,
    userId,
    canWrite,
    pendingUploads,
  };

  const includeSaasTools = hasProposalAutomation(organization);
  const openaiTools = agentToolDefinitions
    .filter((t) => includeSaasTools || !SAAS_ONLY_TOOLS.has(t.name))
    .filter((t) => canWrite || !WRITE_TOOLS.has(t.name))
    .map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

  // OpenAI Chat Completions takes the system prompt as the first message.
  const messages: Record<string, unknown>[] = [
    { role: "system", content: buildSystemPrompt(organization.name, userName) },
    ...parsed.data.messages.map((m) => ({
      role: m.role,
      content: m.role === "assistant" ? stripSuggestions(m.content) : m.content,
    })),
  ];

  // Surface attached files (and their upload_id) to the model on the last turn.
  if (attachments.length > 0) {
    const note =
      "\n\n[Pièces jointes fournies dans ce message :\n" +
      attachments
        .map((a) => `- ${a.fileName} (${a.mimeType}) — upload_id: ${a.uploadId}`)
        .join("\n") +
      "\nPour SAVOIR ce qu'est un fichier (le lire, le résumer, le classer), appelle inspect_uploaded_file avec son upload_id. Pour le ranger dans un dossier, appelle attach_uploaded_file_to_client avec son upload_id.]";
    const last = messages[messages.length - 1];
    last.content = `${String(last.content ?? "")}${note}`;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      const write = (t: string) => controller.enqueue(encoder.encode(t));

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          // Last allowed round: force a final text answer so the user never
          // ends up with silence because the tool budget ran out mid-plan.
          const isLastRound = round === MAX_TOOL_ROUNDS - 1;
          const response = await fetch(OPENAI_URL, {
            method: "POST",
            headers: {
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: AGENT_MODEL,
              stream: true,
              max_completion_tokens: 2000,
              // Routes every request of the same user to the same prompt-cache
              // shard: the stable prefix (system + tools + history) is then
              // billed at the cached-input rate instead of full price.
              prompt_cache_key: `courtier-agent-${userId}`,
              tools: openaiTools,
              ...(isLastRound ? { tool_choice: "none" } : {}),
              messages,
            }),
          });

          if (!response.ok || !response.body) {
            const detail = await response.text().catch(() => "");
            console.error("[agent] openai error", response.status, detail);
            write("\nL'assistant est momentanément indisponible.");
            break;
          }

          const toolCalls = new Map<number, ToolCallAccum>();
          let assistantContent = "";
          let finishReason: string | null = null;

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              let evt: {
                choices?: {
                  delta?: {
                    content?: string;
                    tool_calls?: {
                      index: number;
                      id?: string;
                      function?: { name?: string; arguments?: string };
                    }[];
                  };
                  finish_reason?: string | null;
                }[];
              };
              try {
                evt = JSON.parse(payload);
              } catch {
                continue;
              }
              const choice = evt.choices?.[0];
              if (!choice) continue;
              const delta = choice.delta;
              if (delta?.content) {
                assistantContent += delta.content;
                fullText += delta.content;
                write(delta.content);
              }
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const existing = toolCalls.get(tc.index) ?? {
                    id: "",
                    name: "",
                    args: "",
                  };
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name += tc.function.name;
                  if (tc.function?.arguments)
                    existing.args += tc.function.arguments;
                  toolCalls.set(tc.index, existing);
                }
              }
              if (choice.finish_reason) finishReason = choice.finish_reason;
            }
          }

          if (finishReason !== "tool_calls" || toolCalls.size === 0) break;

          // Append the assistant turn with its tool calls, then the results.
          const calls = [...toolCalls.entries()].sort((a, b) => a[0] - b[0]).map(
            ([, c]) => c,
          );
          messages.push({
            role: "assistant",
            content: assistantContent || null,
            tool_calls: calls.map((c) => ({
              id: c.id,
              type: "function",
              function: { name: c.name, arguments: c.args || "{}" },
            })),
          });

          for (const c of calls) {
            // UI-only activity marker: lets the chat display a live French
            // label ("Recherche dans vos dossiers…") while the tool runs.
            // Written to the wire only — never persisted (fullText excludes it).
            write(`[[tool:${c.name}]]`);
            let input: Record<string, unknown> = {};
            try {
              input = c.args ? JSON.parse(c.args) : {};
            } catch {
              input = {};
            }
            // A failing tool (Outlook down, Storage hiccup…) must not kill the
            // whole reply: surface the error to the model so it can adapt.
            let result: unknown;
            try {
              result = await executeAgentTool(c.name, input, toolCtx);
            } catch (toolError) {
              console.error(`[agent] tool ${c.name} failed:`, toolError);
              result = {
                error:
                  "L'outil n'a pas pu aboutir. Explique le blocage à l'utilisateur ou essaie autrement.",
              };
            }
            messages.push({
              role: "tool",
              tool_call_id: c.id,
              content: JSON.stringify(result),
            });
          }
        }
      } catch (error) {
        console.error("[agent] stream failed:", error);
        write("\nUne erreur est survenue.");
      }

      await persist(fullText).catch((e) =>
        console.error("[agent] persist failed:", e),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
