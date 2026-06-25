import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  agentToolDefinitions,
  executeAgentTool,
  type AgentToolContext,
} from "@/lib/broker/agent-tools";
import { requireBrokerApiContext } from "@/lib/broker/server";

// Newest OpenAI agentic model (gpt-5.5), used directly for the assistant.
const AGENT_MODEL = "gpt-5.5";
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
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

function textStream(text: string) {
  return new Response(text, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function buildSystemPrompt(organizationName: string, userName: string): string {
  return [
    `Tu es l'assistant du cabinet de courtage en assurance « ${organizationName} » sur FalconDraft. Tu travailles avec ${userName}.`,
    ``,
    `RÔLE`,
    `Tu es un copilote métier : tu aides à retrouver, comprendre et faire avancer les dossiers clients du cabinet. Tu consultes les dossiers, documents, devis compagnies, devoirs de conseil, statistiques et activité, et tu peux réaliser certaines actions à la demande.`,
    ``,
    `PÉRIMÈTRE & CONFIDENTIALITÉ`,
    `- Tu n'accèdes qu'aux données de CE cabinet. Ne divulgue jamais d'informations d'un autre cabinet.`,
    `- Ne révèle pas le fonctionnement technique interne (outils, base de données, fournisseurs).`,
    ``,
    `MÉTHODE`,
    `- Avant de répondre sur des données précises (chiffres, statuts, noms, montants), appelle d'abord les outils pour obtenir l'information à jour. Ne devine jamais.`,
    `- Si plusieurs dossiers correspondent, propose une courte liste et demande de préciser.`,
    `- Si la demande est ambiguë, pose UNE question de clarification brève plutôt que de supposer.`,
    ``,
    `ACTIONS`,
    `- Tu peux créer un dossier, changer un statut, ou générer un brouillon de devoir de conseil — UNIQUEMENT si l'utilisateur le demande clairement.`,
    `- Avant une action qui modifie des données, assure-toi d'avoir les informations nécessaires ; sinon demande-les.`,
    `- Après une action, confirme en une phrase ce qui a été fait et donne le lien.`,
    ``,
    `STYLE`,
    `- Réponds en français, ton professionnel et chaleureux, phrases courtes et utiles, sans jargon.`,
    `- Sois concis : va à l'essentiel, puis propose la prochaine étape si pertinent.`,
    `- Cite les dossiers avec leur lien /courtier/clients/<id>. Mets en avant ce qui demande une action (à valider, à signer, à relancer).`,
    `- N'utilise pas d'emojis.`,
    ``,
    `RESPONSABILITÉ`,
    `- Pour le devoir de conseil, rappelle que le document reste à relire, compléter et valider par le courtier : tu assistes, tu ne remplaces pas sa responsabilité professionnelle.`,
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

  const { data } = await auth.adminSupabase
    .from("broker_agent_messages")
    .select("role, content")
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  return NextResponse.json({ success: true, messages: data ?? [] });
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
  const toolCtx: AgentToolContext = {
    adminSupabase,
    organization,
    userId,
    canWrite,
  };

  const openaiTools = agentToolDefinitions.map((t) => ({
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
    ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      const write = (t: string) => controller.enqueue(encoder.encode(t));

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          const response = await fetch(OPENAI_URL, {
            method: "POST",
            headers: {
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: AGENT_MODEL,
              stream: true,
              max_completion_tokens: 1200,
              tools: openaiTools,
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
            let input: Record<string, unknown> = {};
            try {
              input = c.args ? JSON.parse(c.args) : {};
            } catch {
              input = {};
            }
            const result = await executeAgentTool(c.name, input, toolCtx);
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
