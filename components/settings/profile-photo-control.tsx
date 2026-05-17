"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  fetchProfilePhotoUrl,
  LEGACY_PROFILE_PHOTO_STORAGE_KEY,
  PROFILE_PHOTO_UPDATED_EVENT,
  type ProfilePhotoResponse,
} from "@/lib/profile-photo";
import { useI18n } from "@/components/i18n/language-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const maxProfilePhotoSize = 2 * 1024 * 1024;

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase() ?? "")
    .join("");
}

function notifyProfilePhotoUpdated() {
  window.dispatchEvent(new Event(PROFILE_PHOTO_UPDATED_EVENT));
}

export function ProfilePhotoControl({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    window.localStorage.removeItem(LEGACY_PROFILE_PHOTO_STORAGE_KEY);

    void fetchProfilePhotoUrl().then((url) => {
      setPhotoUrl(url);
    });
  }, []);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.photo.errorFormatTitle"), {
        description: t("settings.photo.errorFormat"),
      });
      return;
    }

    if (file.size > maxProfilePhotoSize) {
      toast.error(t("settings.photo.errorSizeTitle"), {
        description: t("settings.photo.errorSize"),
      });
      return;
    }

    const formData = new FormData();
    formData.set("photo", file);
    setIsUpdating(true);

    const response = await fetch("/api/profile-photo", {
      method: "POST",
      body: formData,
    }).catch(() => null);

    const result = (await response?.json().catch(() => ({
      success: false,
      message: t("settings.photo.errorDescription"),
    }))) as ProfilePhotoResponse | undefined;

    setIsUpdating(false);

    if (!response?.ok || !result?.success) {
      toast.error(t("settings.photo.errorTitle"), {
        description:
          result && "message" in result
            ? result.message
            : t("settings.photo.errorDescription"),
      });
      return;
    }

    setPhotoUrl(result.url);
    setIsDialogOpen(false);
    notifyProfilePhotoUpdated();
    toast.success(t("settings.photo.successUpdated"));
  }

  async function removePhoto() {
    setIsUpdating(true);

    const response = await fetch("/api/profile-photo", {
      method: "DELETE",
    }).catch(() => null);

    setIsUpdating(false);

    if (!response?.ok) {
      toast.error(t("settings.photo.removeErrorTitle"), {
        description: t("settings.photo.removeErrorDescription"),
      });
      return;
    }

    setPhotoUrl(null);
    notifyProfilePhotoUpdated();
    toast.success(t("settings.photo.successRemoved"));
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="size-16 rounded-lg after:rounded-lg">
          {photoUrl ? (
            <AvatarImage
              src={photoUrl}
              alt=""
              className="rounded-lg"
            />
          ) : null}
          <AvatarFallback className="rounded-lg text-base">
            {getInitials(userName) || "FD"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{userName}</p>
          <p className="text-muted-foreground mt-1 text-sm">{userEmail}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={handleFileChange}
        />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              {t("settings.photo.choose")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("settings.photo.dialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("settings.photo.dialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted/45 p-3 text-sm">
              <p className="font-medium">{t("settings.photo.formats")}</p>
              <p className="text-muted-foreground mt-1">
                {t("settings.photo.formatsDetail")}
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => inputRef.current?.click()}>
                {isUpdating ? t("settings.photo.saving") : t("settings.photo.select")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {photoUrl ? (
          <Button
            type="button"
            variant="ghost"
            disabled={isUpdating}
            onClick={() => void removePhoto()}
          >
            {isUpdating ? t("settings.photo.updating") : t("settings.photo.remove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
