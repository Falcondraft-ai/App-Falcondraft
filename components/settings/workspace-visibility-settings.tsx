"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";

type WorkspaceVisibilitySettingsProps = {
  initialAllowMemberCompanyVisibility: boolean;
};

type VisibilityApiResponse =
  | {
      success: true;
      allow_member_company_visibility: boolean;
    }
  | {
      success: false;
      message: string;
    };

export function WorkspaceVisibilitySettings({
  initialAllowMemberCompanyVisibility,
}: WorkspaceVisibilitySettingsProps) {
  const [allowMemberCompanyVisibility, setAllowMemberCompanyVisibility] =
    React.useState(initialAllowMemberCompanyVisibility);
  const [isSaving, setIsSaving] = React.useState(false);
  const { t } = useI18n();

  async function saveVisibilityPreference() {
    setIsSaving(true);

    const response = await fetch("/api/organization-settings/visibility", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        allow_member_company_visibility: allowMemberCompanyVisibility,
      }),
    });
    const result = (await response.json().catch(() => ({
      success: false,
      message: t("visibility.saveError"),
    }))) as VisibilityApiResponse;

    setIsSaving(false);

    if (!response.ok || !result.success) {
      const message =
        "message" in result ? result.message : t("visibility.saveError");
      toast.error(t("visibility.notSaved"), {
        description: message,
      });
      return;
    }

    setAllowMemberCompanyVisibility(result.allow_member_company_visibility);
    toast.success(t("visibility.saved"), {
      description: result.allow_member_company_visibility
        ? t("visibility.savedOpen")
        : t("visibility.savedRestricted"),
    });
  }

  return (
    <section className="bg-card/80 rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("visibility.title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("visibility.description")}
        </p>
      </div>
      <div className="space-y-4 p-4">
        <label
          htmlFor="allow-member-company-visibility"
          className="bg-secondary/30 flex items-start gap-3 rounded-md border p-3"
        >
          <input
            id="allow-member-company-visibility"
            type="checkbox"
            className="accent-primary mt-1 size-4"
            checked={allowMemberCompanyVisibility}
            onChange={(event) =>
              setAllowMemberCompanyVisibility(event.target.checked)
            }
          />
          <span>
            <span className="block text-sm font-medium">
              {t("visibility.option")}
            </span>
            <span className="text-muted-foreground mt-1 block text-sm leading-5">
              {t("visibility.optionDescription")}
            </span>
          </span>
        </label>
      </div>
      <div className="flex justify-end border-t p-4">
        <Button
          type="button"
          onClick={saveVisibilityPreference}
          disabled={isSaving}
        >
          {isSaving ? t("common.actions.saving") : t("common.actions.save")}
        </Button>
      </div>
    </section>
  );
}
