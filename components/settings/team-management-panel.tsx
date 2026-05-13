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
import {
  normalizeWorkspaceRole,
  workspaceMemberRoles,
  type WorkspaceMemberRole,
} from "@/lib/auth/workspace-permissions";
import { formatDateTime } from "@/lib/format";
import type { PendingInvitation, TeamMember } from "@/types/user";

type TeamManagementPanelProps = {
  organizationId: string | null;
  currentUserId: string;
  currentUserRole: string | null;
  canManageMembers: boolean;
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

type MemberMutationApiResponse =
  | {
      success: true;
      member: {
        id: string;
        userId: string;
        role: TeamMember["role"];
        roleKey: WorkspaceMemberRole;
        status: TeamMember["status"];
        lastActiveAt: string;
      };
    }
  | {
      success: false;
      message: string;
    };

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
  currentUserId,
  currentUserRole,
  canManageMembers,
  canManageInvitations,
  members: initialMembers,
  pendingInvitations: initialPendingInvitations,
}: TeamManagementPanelProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<InvitationRole>("member");
  const [isInviting, setIsInviting] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = React.useState<string | null>(
    null,
  );
  const [removingMemberId, setRemovingMemberId] = React.useState<string | null>(
    null,
  );
  const [members, setMembers] = React.useState(initialMembers);
  const [pendingInvitations, setPendingInvitations] = React.useState(
    initialPendingInvitations,
  );
  const [error, setError] = React.useState<string | null>(null);
  const currentRole = normalizeWorkspaceRole(currentUserRole);
  const activeManagerCount = members.filter(
    (member) => member.roleKey === "manager",
  ).length;

  function getMemberRoleOptions(member: TeamMember) {
    if (member.roleKey === "manager" && activeManagerCount <= 1) {
      return ["manager"] as const;
    }

    if (currentRole === "manager") {
      return workspaceMemberRoles;
    }

    return [];
  }

  function canEditMember(member: TeamMember) {
    if (!canManageMembers) {
      return false;
    }

    return getMemberRoleOptions(member).length > 0;
  }

  function canRemoveMember(member: TeamMember) {
    if (!canEditMember(member)) {
      return false;
    }

    return !(member.roleKey === "manager" && activeManagerCount <= 1);
  }

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

  async function handleRoleChange(
    member: TeamMember,
    nextRole: WorkspaceMemberRole,
  ) {
    if (!canEditMember(member) || nextRole === member.roleKey) {
      return;
    }

    setError(null);
    setUpdatingMemberId(member.id);

    const response = await fetch(`/api/organization-members/${member.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: nextRole,
      }),
    });
    const result = (await response.json().catch(() => ({
      success: false,
      message: "Modification impossible.",
    }))) as MemberMutationApiResponse;

    setUpdatingMemberId(null);

    if (!response.ok || !result.success) {
      const message =
        "message" in result ? result.message : "Modification impossible.";
      setError(message);
      toast.error("Rôle non modifié", {
        description: message,
      });
      return;
    }

    setMembers((current) =>
      current.map((currentMember) =>
        currentMember.id === member.id
          ? {
              ...currentMember,
              role: result.member.role,
              roleKey: result.member.roleKey,
              status: result.member.status,
              lastActiveAt: result.member.lastActiveAt,
            }
          : currentMember,
      ),
    );
    toast.success("Rôle mis à jour");
  }

  async function handleRemoveMember(member: TeamMember) {
    if (!canRemoveMember(member)) {
      return;
    }

    const confirmed = window.confirm(
      `Retirer ${member.name} de cet espace de travail ? Son accès sera désactivé.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setRemovingMemberId(member.id);

    const response = await fetch(`/api/organization-members/${member.id}`, {
      method: "DELETE",
    });
    const result = (await response.json().catch(() => ({
      success: false,
      message: "Retrait impossible.",
    }))) as { success: boolean; message?: string };

    setRemovingMemberId(null);

    if (!response.ok || !result.success) {
      const message = result.message ?? "Retrait impossible.";
      setError(message);
      toast.error("Membre conservé", {
        description: message,
      });
      return;
    }

    setMembers((current) =>
      current.filter((currentMember) => currentMember.id !== member.id),
    );
    toast.success("Membre retiré", {
      description: `${member.name} n’a plus accès à l’espace.`,
    });
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
                {canManageMembers ? (
                  <TableHead className="text-right">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const roleOptions = getMemberRoleOptions(member);
                const isUpdating = updatingMemberId === member.id;
                const isRemoving = removingMemberId === member.id;

                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.name}
                      {member.userId === currentUserId ? (
                        <span className="text-muted-foreground ml-2 text-xs">
                          Vous
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {canEditMember(member) ? (
                        <Select
                          value={member.roleKey}
                          disabled={isUpdating || isRemoving}
                          onValueChange={(value) =>
                            void handleRoleChange(
                              member,
                              value as WorkspaceMemberRole,
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((availableRole) => (
                              <SelectItem
                                key={availableRole}
                                value={availableRole}
                              >
                                {getWorkspaceRoleLabel(availableRole)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        member.role
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="bg-card border px-2 py-1 text-xs">
                        {member.status}
                      </span>
                    </TableCell>
                    <TableCell>{formatDateTime(member.lastActiveAt)}</TableCell>
                    {canManageMembers ? (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canRemoveMember(member) || isRemoving}
                          onClick={() => void handleRemoveMember(member)}
                        >
                          {isRemoving ? "Retrait..." : "Retirer"}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
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

      {error ? (
        <p className="text-destructive text-sm leading-6">{error}</p>
      ) : null}

      {canManageInvitations ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="bg-card/80 rounded-lg border p-4">
            <div>
              <h2 className="text-sm font-semibold">
                Inviter un collaborateur
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                Un lien privé est envoyé par email. Aucun accès public à la
                création de compte n’est ouvert.
              </p>
            </div>

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
              <Button
                type="submit"
                disabled={isInviting || !organizationId}
                className="w-full"
              >
                {isInviting ? "Envoi en cours..." : "Envoyer l’invitation"}
              </Button>
            </form>
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
                            Lecteur
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
      ) : null}
    </div>
  );
}
