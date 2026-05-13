"use client";

import * as React from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getWorkspaceRoleLabel,
  invitationRoles,
  type InvitationRole,
} from "@/lib/invitations/shared";
import { formatDateTime } from "@/lib/format";
import type { PendingInvitation, TeamMember } from "@/types/user";

type TeamManagementPanelProps = {
  organizationId: string | null;
  canManageInvitations: boolean;
  members: TeamMember[];
  pendingInvitations: PendingInvitation[];
};

type InvitationApiResponse =
  | {
      success: true;
      invitation: {
        id: string;
        email: string;
        role: string;
        status: string;
        expires_at: string;
        created_at: string;
      };
    }
  | {
      success: false;
      message: string;
    };

type CreatedInvitation = Extract<
  InvitationApiResponse,
  { success: true }
>["invitation"];

function mapPendingInvitation(
  invitation: CreatedInvitation,
): PendingInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    role: getWorkspaceRoleLabel(invitation.role),
    status: "Invitation envoyée",
    expiresAt: invitation.expires_at,
    createdAt: invitation.created_at,
  };
}

export function TeamManagementPanel({
  organizationId,
  canManageInvitations,
  members,
  pendingInvitations: initialPendingInvitations,
}: TeamManagementPanelProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<InvitationRole>("member");
  const [isInviting, setIsInviting] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = React.useState(
    initialPendingInvitations,
  );
  const [error, setError] = React.useState<string | null>(null);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId || !canManageInvitations) {
      return;
    }

    setError(null);
    setIsInviting(true);

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organization_id: organizationId,
        email,
        role,
      }),
    });
    const result = (await response.json().catch(() => ({
      success: false,
      message: "Invitation impossible.",
    }))) as InvitationApiResponse;

    setIsInviting(false);

    if (!response.ok || !result.success) {
      const message =
        "message" in result ? result.message : "Invitation impossible.";
      setError(message);
      toast.error("Invitation non envoyée", {
        description: message,
      });
      return;
    }

    setPendingInvitations((current) => [
      mapPendingInvitation(result.invitation),
      ...current,
    ]);
    setEmail("");
    setRole("member");
    toast.success("Invitation envoyée", {
      description: `${result.invitation.email} a reçu son lien FalconDraft.`,
    });
  }

  async function handleRevoke(invitationId: string) {
    if (!canManageInvitations) {
      return;
    }

    setError(null);
    setRevokingId(invitationId);

    const response = await fetch("/api/invitations/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invitation_id: invitationId,
      }),
    });
    const result = (await response.json().catch(() => ({
      success: false,
      message: "Révocation impossible.",
    }))) as { success: boolean; message?: string };

    setRevokingId(null);

    if (!response.ok || !result.success) {
      const message = result.message ?? "Révocation impossible.";
      setError(message);
      toast.error("Invitation conservée", {
        description: message,
      });
      return;
    }

    setPendingInvitations((current) =>
      current.filter((invitation) => invitation.id !== invitationId),
    );
    toast.success("Invitation révoquée");
  }

  return (
    <div className="space-y-6">
      <section className="bg-card/80 rounded-lg border">
        <div className="flex flex-col justify-between gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">Collaborateurs</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Membres actifs, rôles et accès à l’espace de travail.
            </p>
          </div>
        </div>
        {members.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière activité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>
                    <span className="bg-card border px-2 py-1 text-xs">
                      {member.status}
                    </span>
                  </TableCell>
                  <TableCell>{formatDateTime(member.lastActiveAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4">
            <EmptyState
              title="Aucun membre"
              description="Les membres associés à cet espace client apparaîtront ici."
            />
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="bg-card/80 rounded-lg border p-4">
          <div>
            <h2 className="text-sm font-semibold">Inviter un collaborateur</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6">
              Un lien privé est envoyé par email. Aucun accès public à la
              création de compte n’est ouvert.
            </p>
          </div>

          {canManageInvitations ? (
            <form className="mt-5 space-y-4" onSubmit={handleInvite}>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email professionnel</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="collaborateur@cabinet.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Rôle</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as InvitationRole)}
                >
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue placeholder="Choisir un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    {invitationRoles.map((availableRole) => (
                      <SelectItem key={availableRole} value={availableRole}>
                        {getWorkspaceRoleLabel(availableRole)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error ? (
                <p className="text-destructive text-sm leading-6">{error}</p>
              ) : null}
              <Button
                type="submit"
                disabled={isInviting || !organizationId}
                className="w-full"
              >
                {isInviting ? "Envoi en cours..." : "Envoyer l’invitation"}
              </Button>
            </form>
          ) : (
            <div className="bg-background/70 mt-5 rounded-lg border p-4">
              <p className="text-sm font-medium">Accès limité</p>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                Seuls les propriétaires et gestionnaires actifs peuvent inviter
                ou révoquer des collaborateurs.
              </p>
            </div>
          )}
        </div>

        <div className="bg-card/80 rounded-lg border">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Invitations en attente</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Liens actifs qui n’ont pas encore été acceptés.
            </p>
          </div>
          {pendingInvitations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.email}
                    </TableCell>
                    <TableCell>{invitation.role}</TableCell>
                    <TableCell>
                      {formatDateTime(invitation.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageInvitations ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={revokingId === invitation.id}
                          onClick={() => void handleRevoke(invitation.id)}
                        >
                          {revokingId === invitation.id
                            ? "Révocation..."
                            : "Révoquer"}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Lecture seule
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-4">
              <EmptyState
                title="Aucune invitation en attente"
                description="Les invitations envoyées et non acceptées apparaîtront ici."
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
