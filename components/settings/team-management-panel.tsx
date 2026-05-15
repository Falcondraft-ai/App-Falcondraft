"use client";

import * as React from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/components/i18n/language-provider";
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
import { isProtectedAccountEmail } from "@/lib/protected-users";
import type { PendingInvitation, TeamMember } from "@/types/user";
import type { TranslationKey } from "@/lib/i18n/translations";

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
    roleKey: normalizeWorkspaceRole(invitation.role) ?? "member",
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
  const { t } = useI18n();
  const currentRole = normalizeWorkspaceRole(currentUserRole);
  const activeManagerCount = members.filter(
    (member) => member.roleKey === "manager",
  ).length;

  function roleLabel(roleKey: WorkspaceMemberRole) {
    return t(`roles.${roleKey}` as TranslationKey);
  }

  function memberStatusLabel(status: TeamMember["status"]) {
    return status === "Invitation envoyée"
      ? t("team.status.invited")
      : t("team.status.active");
  }

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

    if (isProtectedAccountEmail(member.email)) {
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
      message: t("team.invite.error"),
    }))) as InvitationApiResponse;

    setIsInviting(false);

    if (!response.ok || !result.success) {
      const message =
        "message" in result ? result.message : t("team.invite.error");
      setError(message);
      toast.error(t("team.invite.error"), {
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
    toast.success(t("team.invite.sent"), {
      description: t("team.invite.sentDescription", {
        email: result.invitation.email,
      }),
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
    toast.success(t("team.invitations.revoked"));
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
      toast.error(t("team.roleUpdateError"), {
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
    toast.success(t("team.roleUpdateSuccess"));
  }

  async function handleRemoveMember(member: TeamMember) {
    if (!canRemoveMember(member)) {
      return;
    }

    const confirmed = window.confirm(
      t("team.confirmRemove", { name: member.name }),
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
      message: t("team.errorRemove"),
    }))) as { success: boolean; message?: string };

    setRemovingMemberId(null);

    if (!response.ok || !result.success) {
      const message = result.message ?? t("team.errorRemove");
      setError(message);
      toast.error(t("team.kept"), {
        description: message,
      });
      return;
    }

    setMembers((current) =>
      current.filter((currentMember) => currentMember.id !== member.id),
    );
    toast.success(t("team.removed"), {
      description: t("team.removedDescription", { name: member.name }),
    });
  }

  return (
    <div className="space-y-6">
      <section className="bg-card/80 rounded-lg border">
        <div className="flex flex-col justify-between gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">{t("team.title")}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("team.description")}
            </p>
          </div>
        </div>
        {members.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("team.columns.name")}</TableHead>
                <TableHead>{t("team.columns.email")}</TableHead>
                <TableHead>{t("team.columns.role")}</TableHead>
                <TableHead>{t("team.columns.status")}</TableHead>
                <TableHead>{t("team.columns.lastActive")}</TableHead>
                {canManageMembers ? (
                  <TableHead className="text-right">
                    {t("team.columns.actions")}
                  </TableHead>
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
                          {t("team.you")}
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
                                {roleLabel(availableRole)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        roleLabel(member.roleKey)
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="bg-card border px-2 py-1 text-xs">
                        {memberStatusLabel(member.status)}
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
                          {isRemoving ? t("team.removing") : t("team.remove")}
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
              title={t("team.emptyTitle")}
              description={t("team.emptyDescription")}
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
                {t("team.invite.title")}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {t("team.invite.description")}
              </p>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleInvite}>
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t("team.invite.email")}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("team.invite.placeholder")}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">{t("team.invite.role")}</Label>
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
                        {roleLabel(availableRole)}
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
                {isInviting
                  ? t("team.invite.submitting")
                  : t("team.invite.submit")}
              </Button>
            </form>
          </div>

          <div className="bg-card/80 rounded-lg border">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">
                {t("team.invitations.title")}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("team.invitations.description")}
              </p>
            </div>
            {pendingInvitations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("team.columns.email")}</TableHead>
                    <TableHead>{t("team.columns.role")}</TableHead>
                    <TableHead>{t("team.invitations.expires")}</TableHead>
                    <TableHead className="text-right">
                      {t("team.invitations.action")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">
                        {invitation.email}
                      </TableCell>
                      <TableCell>{roleLabel(invitation.roleKey)}</TableCell>
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
                              ? t("team.invitations.revoking")
                              : t("team.invitations.revoke")}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {t("roles.viewer")}
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
                  title={t("team.invitations.emptyTitle")}
                  description={t("team.invitations.emptyDescription")}
                />
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
