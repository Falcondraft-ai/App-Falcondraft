"use client";

import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type QontoStatus = "non_configuré" | "connecté" | "erreur";

interface BillingConfig {
  provider: "none" | "qonto";
  qonto: {
    status: QontoStatus;
    masked_login: string;
    last_tested_at: string | null;
    last_error: string | null;
    provider_account_id: string | null;
  } | null;
}

const statusLabels: Record<QontoStatus, string> = {
  non_configuré: "Non configuré",
  connecté: "Connecté",
  erreur: "Erreur",
};

const statusStyles: Record<QontoStatus, string> = {
  non_configuré: "bg-muted text-muted-foreground",
  connecté:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  erreur: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface Props {
  organizationId: string;
  visible: boolean;
}

export function InternalAdminBillingProvider({ organizationId, visible }: Props) {
  const [config, setConfig] = React.useState<BillingConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [provider, setProvider] = React.useState<"none" | "qonto">("none");
  const [qontoLogin, setQontoLogin] = React.useState("");
  const [qontoSecretKey, setQontoSecretKey] = React.useState("");
  const [qontoBaseUrl, setQontoBaseUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetch(`/api/internal-admin/organizations/${organizationId}/billing`)
      .then((r) => r.json())
      .then((data: BillingConfig & { success: boolean }) => {
        if (data.provider) {
          setConfig(data);
          setProvider(data.provider);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [organizationId, visible]);

  async function handleSave() {
    setSaving(true);

    const body: Record<string, unknown> = { provider };

    if (provider === "qonto") {
      if (!qontoLogin.trim() || !qontoSecretKey.trim()) {
        toast.error("Champs requis.", {
          description: "Le login API et la clé secrète Qonto sont requis.",
        });
        setSaving(false);
        return;
      }

      body.qonto = {
        api_login: qontoLogin.trim(),
        api_secret_key: qontoSecretKey.trim(),
        ...(qontoBaseUrl.trim() ? { api_base_url: qontoBaseUrl.trim() } : {}),
      };
    }

    const response = await fetch(
      `/api/internal-admin/organizations/${organizationId}/billing`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ).catch(() => null);

    setSaving(false);

    if (!response) {
      toast.error("Échec de l'enregistrement.", {
        description: "Impossible de contacter le serveur.",
      });
      return;
    }

    if (!response.ok) {
      let description = "Vérifiez les paramètres puis réessayez.";
      try {
        const json = await response.json();
        if (json.message) description = json.message;
      } catch {}
      toast.error("Échec de l'enregistrement.", { description });
      return;
    }

    const data = (await response.json()) as BillingConfig & {
      success: boolean;
    };

    if (data.provider) {
      setConfig(data);
      setProvider(data.provider);
    }

    setQontoLogin("");
    setQontoSecretKey("");
    setQontoBaseUrl("");

    if (provider === "qonto") {
      toast.success("Connexion Qonto configurée.");
    } else {
      toast.success("Provider désactivé.");
    }
  }

  if (!visible) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Fournisseur de devis</h3>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement...</p>
      ) : (
        <>
          {config?.qonto && (
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/50 p-3 text-sm">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  statusStyles[config.qonto.status],
                )}
              >
                {statusLabels[config.qonto.status]}
              </span>
              <span className="text-muted-foreground">
                Login :{" "}
                <span className="font-mono text-foreground">
                  {config.qonto.masked_login}
                </span>
              </span>
              {config.qonto.last_tested_at && (
                <span className="text-muted-foreground">
                  Testé :{" "}
                  {new Date(config.qonto.last_tested_at).toLocaleDateString(
                    "fr-FR",
                    {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </span>
              )}
              {config.qonto.last_error && (
                <Badge variant="destructive">{config.qonto.last_error}</Badge>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as "none" | "qonto")}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                <SelectItem value="qonto">Qonto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider === "qonto" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Login API Qonto</Label>
                <Input
                  type="text"
                  placeholder="ei-moncompte-falcondraft-7969"
                  value={qontoLogin}
                  onChange={(e) => setQontoLogin(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Clé secrète Qonto</Label>
                <Input
                  type="password"
                  placeholder="Clé secrète API"
                  value={qontoSecretKey}
                  onChange={(e) => setQontoSecretKey(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>URL de base API Qonto (optionnel)</Label>
                <Input
                  type="url"
                  placeholder="https://thirdparty.qonto.com"
                  value={qontoBaseUrl}
                  onChange={(e) => setQontoBaseUrl(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving
                ? "Test et enregistrement..."
                : "Tester et enregistrer"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
