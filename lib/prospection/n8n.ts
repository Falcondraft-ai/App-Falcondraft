import "server-only";

const N8N_WEBHOOK_URL = process.env.N8N_PROSPECTION_WEBHOOK_URL?.trim();
const N8N_SECRET = process.env.N8N_PROSPECTION_SECRET?.trim();

export function isProspectionN8nConfigured(): boolean {
  return Boolean(N8N_WEBHOOK_URL && N8N_SECRET);
}

export async function triggerProspectionSearch(
  searchId: string,
): Promise<{ success: boolean; message: string }> {
  if (!N8N_WEBHOOK_URL || !N8N_SECRET) {
    return {
      success: false,
      message: "Configuration n8n prospection manquante.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-falcondraft-secret": N8N_SECRET,
      },
      body: JSON.stringify({ search_id: searchId }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        success: false,
        message: `n8n a répondu avec le statut ${res.status}.`,
      };
    }

    return { success: true, message: "Recherche déclenchée avec succès." };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        success: true,
        message:
          "Recherche déclenchée (timeout atteint). Les résultats arrivent progressivement.",
      };
    }
    return {
      success: false,
      message: `Erreur réseau: ${(err as Error).message ?? String(err)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
