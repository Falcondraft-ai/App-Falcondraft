"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MeetingBotSettingsProps = {
  initialMeetingBotName: string;
};

type MeetingBotResponse =
  | {
      success: true;
      meeting_bot_name: string;
    }
  | {
      success: false;
      message: string;
    };

function getApiMessage(result: unknown, fallback: string) {
  if (
    result &&
    typeof result === "object" &&
    "message" in result &&
    typeof result.message === "string"
  ) {
    return result.message;
  }

  return fallback;
}

export function MeetingBotSettings({
  initialMeetingBotName,
}: MeetingBotSettingsProps) {
  const [meetingBotName, setMeetingBotName] = React.useState(
    initialMeetingBotName,
  );
  const [savedMeetingBotName, setSavedMeetingBotName] = React.useState(
    initialMeetingBotName,
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const normalizedName = meetingBotName.trim();
  const hasChanges = normalizedName !== savedMeetingBotName;
  const canSave = normalizedName.length >= 2 && normalizedName.length <= 60;

  async function handleSave() {
    setIsSaving(true);

    const response = await fetch("/api/organization-settings/meeting-bot", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_bot_name: normalizedName }),
    }).catch(() => null);

    const result = (await response?.json().catch(() => ({
      success: false,
      message: "Mise à jour impossible.",
    }))) as MeetingBotResponse | undefined;

    setIsSaving(false);

    if (!response?.ok || !result?.success) {
      toast.error("Nom non enregistré", {
        description: getApiMessage(
          result,
          "Vérifiez le nom puis réessayez.",
        ),
      });
      return;
    }

    setMeetingBotName(result.meeting_bot_name);
    setSavedMeetingBotName(result.meeting_bot_name);
    toast.success("Nom de l’assistant enregistré.", {
      description: "Il sera utilisé pour les prochaines réunions.",
    });
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Assistant de réunion
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Personnalisez le nom visible quand FalconDraft rejoint une réunion
            pour préparer le transcript du dossier.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || !canSave || isSaving}
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      <div className="mt-5 max-w-xl space-y-2">
        <label className="text-sm font-medium">
          Nom affiché dans la réunion
        </label>
        <Input
          value={meetingBotName}
          onChange={(event) => setMeetingBotName(event.target.value)}
          placeholder="FalconDraft"
          maxLength={60}
        />
        <p className="text-muted-foreground text-xs">
          Réservé aux gestionnaires. Ce nom s’applique aux prochaines réunions
          enregistrées depuis ce workspace.
        </p>
      </div>
    </div>
  );
}
