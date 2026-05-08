"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  PROFILE_PHOTO_STORAGE_KEY,
  PROFILE_PHOTO_UPDATED_EVENT,
} from "@/lib/profile-photo";
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
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setPhotoUrl(window.localStorage.getItem(PROFILE_PHOTO_STORAGE_KEY));
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Format non pris en charge", {
        description: "Choisissez une image au format PNG, JPG ou WebP.",
      });
      event.currentTarget.value = "";
      return;
    }

    if (file.size > maxProfilePhotoSize) {
      toast.error("Image trop lourde", {
        description: "La photo doit rester sous 2 Mo.",
      });
      event.currentTarget.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        toast.error("Lecture impossible", {
          description: "La photo n’a pas pu être préparée.",
        });
        return;
      }

      window.localStorage.setItem(PROFILE_PHOTO_STORAGE_KEY, result);
      setPhotoUrl(result);
      setIsDialogOpen(false);
      notifyProfilePhotoUpdated();
      toast.success("Photo de profil mise à jour.");
    };

    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  }

  function removePhoto() {
    window.localStorage.removeItem(PROFILE_PHOTO_STORAGE_KEY);
    setPhotoUrl(null);
    notifyProfilePhotoUpdated();
    toast.success("Photo de profil retirée.");
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
              Choisir une photo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Photo de profil</DialogTitle>
              <DialogDescription>
                Choisissez une image professionnelle, nette et centrée sur le
                visage.
              </DialogDescription>
            </DialogHeader>
            <div className="border bg-muted/45 p-3 text-sm">
              <p className="font-medium">Formats acceptés</p>
              <p className="text-muted-foreground mt-1">
                PNG, JPG ou WebP. Taille maximale : 2 Mo.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => inputRef.current?.click()}>
                Sélectionner une image
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {photoUrl ? (
          <Button type="button" variant="ghost" onClick={removePhoto}>
            Retirer
          </Button>
        ) : null}
      </div>
    </div>
  );
}
