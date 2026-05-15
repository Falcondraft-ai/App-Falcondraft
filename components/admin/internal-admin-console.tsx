"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Plus,
  Save,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ActionCard } from "@/components/common/action-card";
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle";
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
import {
  managedWorkflowLabels,
  managedWorkflowTypes,
  type ManagedWorkflowType,
  type WorkflowConfigStatus,
} from "@/lib/internal-admin/workflows";
import { cn } from "@/lib/utils";
import type {
  InternalAdminOrganization,
  InternalAdminWorkspaceAccount,
  InternalAdminWorkspaceInvitation,
} from "@/lib/internal-admin/data";

type InternalAdminConsoleProps = {
  initialOrganizations: InternalAdminOrganization[];
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
};

type ApiErrorResponse = {
  success: false;
  message: string;
};

type OrganizationCreateResponse =
  | {
      success: true;
      organization: InternalAdminOrganization;
    }
  | ApiErrorResponse;

type OrganizationUpdateResponse =
  | {
      success: true;
      organization: Pick<
        InternalAdminOrganization,
        | "id"
        | "name"
        | "slug"
        | "billingStatus"
        | "setupAmount"
        | "monthlySubscriptionAmount"
        | "allowMemberCompanyVisibility"
        | "createdAt"
        | "isInternalWorkspace"
        | "workflowConfigs"
      >;
    }
  | ApiErrorResponse;

type MemberUpdateResponse =
  | {
      success: true;
      member: InternalAdminWorkspaceAccount;
    }
  | ApiErrorResponse;

type InvitationResponse =
  | {
      success: true;
      invitation: InternalAdminWorkspaceInvitation;
    }
  | ApiErrorResponse;

type DeleteInvitationResponse =
  | {
      success: true;
      invitationId: string;
      email: string;
    }
  | ApiErrorResponse;

type MemberCreateResponse =
  | {
      success: true;
      member: InternalAdminWorkspaceAccount;
    }
  | ApiErrorResponse;

type DeleteMemberResponse =
  | {
      success: true;
      memberId: string;
    }
  | ApiErrorResponse;

type DeleteOrganizationResponse =
  | {
      success: true;
      organizationId: string;
    }
  | ApiErrorResponse;

type WorkspaceDraft = {
  billingStatus: string;
  setupAmount: string;
  monthlySubscriptionAmount: string;
  allowMemberCompanyVisibility: boolean;
  workflowStatus: WorkflowConfigStatus;
  workflowUrls: Record<ManagedWorkflowType, string>;
};

type AccessForm = {
  mode: "invite" | "create";
  email: string;
  firstName: string;
  lastName: string;
  role: "manager" | "member" | "viewer";
  password: string;
};

const billingStatusLabels: Record<string, string> = {
  active: "Actif",
  pending: "En attente",
  trial: "Essai",
  suspended: "Suspendu",
};

const roleLabels: Record<AccessForm["role"], string> = {
  manager: "Gestionnaire",
  member: "Membre",
  viewer: "Lecture seule",
};

const protectedAccountEmails = new Set(["timdefabron@gmail.com"]);

const workflowFieldLabels: Record<ManagedWorkflowType, string> = {
  call_summary: "Webhook CR appel",
  proposal_generation: "Webhook génération proposition",
  proposal_validation: "Webhook validation / document final",
  email_draft_generation: "Webhook email draft",
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function emptyWorkflowUrls(): Record<ManagedWorkflowType, string> {
  return {
    call_summary: "",
    proposal_generation: "",
    proposal_validation: "",
    email_draft_generation: "",
  };
}

function getWorkspaceDraft(
  organization: InternalAdminOrganization,
): WorkspaceDraft {
  const workflowUrls = emptyWorkflowUrls();

  for (const config of organization.workflowConfigs) {
    if (
      managedWorkflowTypes.includes(config.workflowType as ManagedWorkflowType)
    ) {
      workflowUrls[config.workflowType as ManagedWorkflowType] =
        config.n8nWebhookUrl;
    }
  }

  return {
    billingStatus: organization.billingStatus,
    setupAmount:
      organization.setupAmount === null ? "" : String(organization.setupAmount),
    monthlySubscriptionAmount:
      organization.monthlySubscriptionAmount === null
        ? ""
        : String(organization.monthlySubscriptionAmount),
    allowMemberCompanyVisibility: organization.allowMemberCompanyVisibility,
    workflowStatus: organization.workflowConfigs.some(
      (config) => config.status === "active",
    )
      ? "active"
      : "inactive",
    workflowUrls,
  };
}

function emptyAccessForm(): AccessForm {
  return {
    mode: "invite",
    email: "",
    firstName: "",
    lastName: "",
    role: "manager",
    password: "",
  };
}

function amountFromInput(value: string) {
  const normalizedValue = value.trim().replace(",", ".");
  return normalizedValue ? Number(normalizedValue) : null;
}

function formatAmount(value: number | null) {
  if (value === null) {
    return "Non renseigné";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getAutomationState(organization: InternalAdminOrganization) {
  const activeConfigs = organization.workflowConfigs.filter(
    (config) => config.status === "active" && config.n8nWebhookUrl,
  );

  if (activeConfigs.length === 0) {
    return {
      label: "N8N inactif",
      className: "bg-muted-foreground",
      badge: "outline" as const,
    };
  }

  if (activeConfigs.length === managedWorkflowTypes.length) {
    return {
      label: "N8N actif",
      className: "bg-emerald-500",
      badge: "default" as const,
    };
  }

  return {
    label: "N8N partiel",
    className: "bg-amber-500",
    badge: "outline" as const,
  };
}

function buildWorkflowPayload(
  workflowUrls: Record<ManagedWorkflowType, string>,
  workflowStatus: WorkflowConfigStatus,
) {
  return managedWorkflowTypes
    .map((workflowType) => ({
      workflow_type: workflowType,
      n8n_webhook_url: workflowUrls[workflowType].trim(),
      status: workflowStatus,
    }))
    .filter((config) => config.n8n_webhook_url.length > 0);
}

function shouldSendFirstManagerInvitation(
  organization: InternalAdminOrganization,
  form: AccessForm,
) {
  return (
    form.mode === "invite" &&
    form.role === "manager" &&
    !organization.isInternalWorkspace &&
    organization.activeMemberCount === 0
  );
}

export function InternalAdminConsole({
  initialOrganizations,
  metrics,
}: InternalAdminConsoleProps) {
  const router = useRouter();
  const [organizations, setOrganizations] =
    React.useState(initialOrganizations);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [workspaceDrafts, setWorkspaceDrafts] = React.useState<
    Record<string, WorkspaceDraft>
  >(() =>
    Object.fromEntries(
      initialOrganizations.map((organization) => [
        organization.id,
        getWorkspaceDraft(organization),
      ]),
    ),
  );
  const [accessForms, setAccessForms] = React.useState<
    Record<string, AccessForm>
  >({});
  const [visiblePasswordOrganizationIds, setVisiblePasswordOrganizationIds] =
    React.useState<Set<string>>(() => new Set());
  const [workspaceForm, setWorkspaceForm] = React.useState({
    name: "",
    slug: "",
    billingStatus: "pending",
    setupAmount: "",
    monthlySubscriptionAmount: "",
    workflowStatus: "inactive" as WorkflowConfigStatus,
    workflowUrls: emptyWorkflowUrls(),
    allowMemberCompanyVisibility: true,
  });
  const [isCreatePanelOpen, setIsCreatePanelOpen] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = React.useState(false);
  const [savingOrganizationId, setSavingOrganizationId] = React.useState<
    string | null
  >(null);
  const [updatingAccessOrganizationId, setUpdatingAccessOrganizationId] =
    React.useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = React.useState<string | null>(
    null,
  );
  const [deletingInvitationId, setDeletingInvitationId] = React.useState<
    string | null
  >(null);
  const [deletingOrganizationId, setDeletingOrganizationId] = React.useState<
    string | null
  >(null);

  function toggleWorkspace(organizationId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(organizationId)) {
        next.delete(organizationId);
      } else {
        next.add(organizationId);
      }

      return next;
    });
  }

  function updateOrganization(updatedOrganization: InternalAdminOrganization) {
    setOrganizations((current) =>
      current.map((organization) =>
        organization.id === updatedOrganization.id
          ? updatedOrganization
          : organization,
      ),
    );
    setWorkspaceDrafts((current) => ({
      ...current,
      [updatedOrganization.id]: getWorkspaceDraft(updatedOrganization),
    }));
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingWorkspace(true);

    const response = await fetch("/api/internal-admin/organizations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: workspaceForm.name,
        slug: workspaceForm.slug,
        billing_status: workspaceForm.billingStatus,
        setup_amount: amountFromInput(workspaceForm.setupAmount),
        monthly_subscription_amount: amountFromInput(
          workspaceForm.monthlySubscriptionAmount,
        ),
        allow_member_company_visibility:
          workspaceForm.allowMemberCompanyVisibility,
        workflow_status: workspaceForm.workflowStatus,
        workflow_configs: buildWorkflowPayload(
          workspaceForm.workflowUrls,
          workspaceForm.workflowStatus,
        ),
      }),
    }).catch(() => null);

    const result = (await response?.json().catch(() => ({
      success: false,
      message: "Création du workspace impossible.",
    }))) as OrganizationCreateResponse | undefined;

    setIsCreatingWorkspace(false);

    if (!response?.ok || !result?.success) {
      const message = getApiMessage(
        result,
        "Création du workspace impossible.",
      );
      toast.error("Workspace non créé", {
        description: message,
      });
      return;
    }

    setOrganizations((current) => [result.organization, ...current]);
    setWorkspaceDrafts((current) => ({
      ...current,
      [result.organization.id]: getWorkspaceDraft(result.organization),
    }));
    setExpandedIds((current) => new Set(current).add(result.organization.id));
    setWorkspaceForm({
      name: "",
      slug: "",
      billingStatus: "pending",
      setupAmount: "",
      monthlySubscriptionAmount: "",
      workflowStatus: "inactive",
      workflowUrls: emptyWorkflowUrls(),
      allowMemberCompanyVisibility: true,
    });
    setSlugTouched(false);
    setIsCreatePanelOpen(false);
    toast.success("Workspace client créé.");
    router.refresh();
  }

  async function saveWorkspace(organization: InternalAdminOrganization) {
    const draft = workspaceDrafts[organization.id];

    if (!draft) {
      return;
    }

    setSavingOrganizationId(organization.id);

    const response = await fetch(
      `/api/internal-admin/organizations/${organization.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billing_status: draft.billingStatus,
          setup_amount: amountFromInput(draft.setupAmount),
          monthly_subscription_amount: amountFromInput(
            draft.monthlySubscriptionAmount,
          ),
          allow_member_company_visibility: draft.allowMemberCompanyVisibility,
          workflow_status: draft.workflowStatus,
          workflow_configs: buildWorkflowPayload(
            draft.workflowUrls,
            draft.workflowStatus,
          ),
        }),
      },
    ).catch(() => null);

    const result = (await response?.json().catch(() => ({
      success: false,
      message: "Enregistrement impossible.",
    }))) as OrganizationUpdateResponse | undefined;

    setSavingOrganizationId(null);

    if (!response?.ok || !result?.success) {
      const message = getApiMessage(result, "Enregistrement impossible.");
      toast.error("Workspace non enregistré", {
        description: message,
      });
      return;
    }

    updateOrganization({
      ...organization,
      ...result.organization,
      activeMemberCount: organization.activeMemberCount,
      pendingInvitationCount: organization.pendingInvitationCount,
      accounts: organization.accounts,
      pendingInvitations: organization.pendingInvitations,
    });
    toast.success("Workspace enregistré.");
    router.refresh();
  }

  async function submitAccess(organization: InternalAdminOrganization) {
    const form = accessForms[organization.id] ?? emptyAccessForm();
    const isDirectCreate = form.mode === "create";
    const isFirstManagerInvite = shouldSendFirstManagerInvitation(
      organization,
      form,
    );

    if (!form.email.trim()) {
      toast.error("Email requis.");
      return;
    }

    if (isDirectCreate && form.password.length < 8) {
      toast.error("Mot de passe temporaire requis.", {
        description: "Utilise au moins 8 caractères.",
      });
      return;
    }

    setUpdatingAccessOrganizationId(organization.id);

    const accessRoute = isDirectCreate
      ? "members"
      : isFirstManagerInvite
        ? "first-manager-invitation"
        : "invitations";

    const response = await fetch(
      `/api/internal-admin/organizations/${organization.id}/${accessRoute}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          role: form.role,
          password: form.password,
        }),
      },
    ).catch(() => null);

    const result = (await response?.json().catch(() => ({
      success: false,
      message: isDirectCreate
        ? "Création du compte impossible."
        : "Invitation impossible.",
    }))) as InvitationResponse | MemberCreateResponse | undefined;

    setUpdatingAccessOrganizationId(null);

    if (!response?.ok || !result?.success) {
      const message = getApiMessage(
        result,
        isDirectCreate
          ? "Création du compte impossible."
          : "Invitation impossible.",
      );
      toast.error(
        isDirectCreate ? "Compte non créé" : "Invitation non envoyée",
        {
          description: message,
        },
      );
      return;
    }

    setAccessForms((current) => ({
      ...current,
      [organization.id]: emptyAccessForm(),
    }));

    if ("member" in result) {
      updateOrganization({
        ...organization,
        activeMemberCount: organization.activeMemberCount + 1,
        accounts: [...organization.accounts, result.member],
      });
      toast.success("Compte client créé.", {
        description: result.member.email,
      });
      return;
    }

    updateOrganization({
      ...organization,
      pendingInvitationCount: organization.pendingInvitationCount + 1,
      pendingInvitations: [
        ...organization.pendingInvitations,
        result.invitation,
      ],
    });
    toast.success("Invitation envoyée.", {
      description: isFirstManagerInvite
        ? `${result.invitation.email} · email de bienvenue`
        : result.invitation.email,
    });
  }

  async function deleteAccount(
    organization: InternalAdminOrganization,
    account: InternalAdminWorkspaceAccount,
  ) {
    const confirmed = window.confirm(
      `Supprimer le compte ${account.email} de ce workspace ?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingMemberId(account.id);

    const response = await fetch(
      `/api/internal-admin/organizations/${organization.id}/members/${account.id}`,
      {
        method: "DELETE",
      },
    ).catch(() => null);

    const result = (await response?.json().catch(() => ({
      success: false,
      message: "Suppression du compte impossible.",
    }))) as DeleteMemberResponse | undefined;

    setDeletingMemberId(null);

    if (!response?.ok || !result?.success) {
      const message = getApiMessage(
        result,
        "Suppression du compte impossible.",
      );
      toast.error("Compte non supprimé", {
        description: message,
      });
      return;
    }

    updateOrganization({
      ...organization,
      activeMemberCount: Math.max(0, organization.activeMemberCount - 1),
      accounts: organization.accounts.filter(
        (currentAccount) => currentAccount.id !== account.id,
      ),
    });
    toast.success("Compte supprimé de Supabase Auth.", {
      description: account.email,
    });
    router.refresh();
  }

  async function deleteInvitation(
    organization: InternalAdminOrganization,
    invitation: InternalAdminWorkspaceInvitation,
  ) {
    const confirmed = window.confirm(
      `Supprimer l’invitation envoyée à ${invitation.email} ? Le lien d’invitation ne fonctionnera plus.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingInvitationId(invitation.id);

    const response = await fetch(
      `/api/internal-admin/organizations/${organization.id}/invitations/${invitation.id}`,
      {
        method: "DELETE",
      },
    ).catch(() => null);

    const result = (await response?.json().catch(() => ({
      success: false,
      message: "Suppression de l’invitation impossible.",
    }))) as DeleteInvitationResponse | undefined;

    setDeletingInvitationId(null);

    if (!response?.ok || !result?.success) {
      const message = getApiMessage(
        result,
        "Suppression de l’invitation impossible.",
      );
      toast.error("Invitation non supprimée", {
        description: message,
      });
      return;
    }

    updateOrganization({
      ...organization,
      pendingInvitationCount: Math.max(
        0,
        organization.pendingInvitationCount - 1,
      ),
      pendingInvitations: organization.pendingInvitations.filter(
        (currentInvitation) => currentInvitation.id !== result.invitationId,
      ),
    });
    toast.success("Invitation supprimée.", {
      description: result.email,
    });
    router.refresh();
  }

  async function updateAccountRole(
    organization: InternalAdminOrganization,
    account: InternalAdminWorkspaceAccount,
    role: AccessForm["role"],
  ) {
    if (role === account.role) {
      return;
    }

    setUpdatingAccessOrganizationId(organization.id);

    const response = await fetch(
      `/api/internal-admin/organizations/${organization.id}/members/${account.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      },
    ).catch(() => null);

    const result = (await response?.json().catch(() => ({
      success: false,
      message: "Mise à jour du rôle impossible.",
    }))) as MemberUpdateResponse | undefined;

    setUpdatingAccessOrganizationId(null);

    if (!response?.ok || !result?.success) {
      const message = getApiMessage(result, "Mise à jour du rôle impossible.");
      toast.error("Rôle non modifié", {
        description: message,
      });
      return;
    }

    updateOrganization({
      ...organization,
      accounts: organization.accounts.map((currentAccount) =>
        currentAccount.id === account.id ? result.member : currentAccount,
      ),
    });
    toast.success("Rôle mis à jour.", {
      description: account.email,
    });
    router.refresh();
  }

  async function deleteWorkspace(organization: InternalAdminOrganization) {
    if (organization.isInternalWorkspace) {
      toast.error("Workspace protégé", {
        description:
          "Le workspace interne FalconDraft ne peut pas être supprimé.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement le workspace ${organization.name} ? Cette action supprimera ses données liées.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingOrganizationId(organization.id);

    const response = await fetch(
      `/api/internal-admin/organizations/${organization.id}`,
      {
        method: "DELETE",
      },
    ).catch(() => null);

    const result = (await response?.json().catch(() => ({
      success: false,
      message: "Suppression du workspace impossible.",
    }))) as DeleteOrganizationResponse | undefined;

    setDeletingOrganizationId(null);

    if (!response?.ok || !result?.success) {
      const message = getApiMessage(
        result,
        "Suppression du workspace impossible.",
      );
      toast.error("Workspace non supprimé", {
        description: message,
      });
      return;
    }

    setOrganizations((current) =>
      current.filter(
        (currentOrganization) => currentOrganization.id !== organization.id,
      ),
    );
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(organization.id);
      return next;
    });
    setWorkspaceDrafts((current) => {
      const next = { ...current };
      delete next[organization.id];
      return next;
    });
    setAccessForms((current) => {
      const next = { ...current };
      delete next[organization.id];
      return next;
    });
    toast.success("Workspace supprimé.", {
      description: organization.name,
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-card rounded-lg border p-4">
            <p className="text-muted-foreground text-xs font-medium">
              {metric.label}
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold">
              {metric.value}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {metric.detail}
            </p>
          </div>
        ))}
      </section>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => setIsCreatePanelOpen((current) => !current)}
          variant={isCreatePanelOpen ? "secondary" : "default"}
        >
          {isCreatePanelOpen ? <X /> : <Plus />}
          {isCreatePanelOpen ? "Fermer" : "Nouveau client"}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {isCreatePanelOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <ActionCard
              title="NOUVEAU CLIENT FALCONDRAFT"
              description="Créez d’abord le workspace, puis ouvrez sa fiche pour inviter les gestionnaires et membres."
            >
              <form onSubmit={(event) => void createWorkspace(event)}>
                <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                  <section className="space-y-3">
                    <div>
                      <p className="text-muted-foreground text-xs font-semibold uppercase">
                        1. Organisation
                      </p>
                      <h3 className="mt-1 text-sm font-semibold">
                        Identité client
                      </h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="workspace-name">
                          Nom du client ou de l’organisation
                        </Label>
                        <Input
                          id="workspace-name"
                          value={workspaceForm.name}
                          onChange={(event) => {
                            const name = event.target.value;
                            setWorkspaceForm((current) => ({
                              ...current,
                              name,
                              slug: slugTouched ? current.slug : slugify(name),
                            }));
                          }}
                          placeholder="Ex. Cabinet Martin, Association Horizon"
                          required
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="workspace-slug">Slug workspace</Label>
                        <Input
                          id="workspace-slug"
                          value={workspaceForm.slug}
                          onChange={(event) => {
                            setSlugTouched(true);
                            setWorkspaceForm((current) => ({
                              ...current,
                              slug: slugify(event.target.value),
                            }));
                          }}
                          placeholder="cabinet-martin"
                          required
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div>
                      <p className="text-muted-foreground text-xs font-semibold uppercase">
                        2. Facturation FalconDraft
                      </p>
                      <h3 className="mt-1 text-sm font-semibold">
                        Facturation
                      </h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="setup-amount">Montant setup</Label>
                        <Input
                          id="setup-amount"
                          inputMode="decimal"
                          value={workspaceForm.setupAmount}
                          onChange={(event) =>
                            setWorkspaceForm((current) => ({
                              ...current,
                              setupAmount: event.target.value,
                            }))
                          }
                          placeholder="2500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="monthly-amount">
                          Abonnement mensuel
                        </Label>
                        <Input
                          id="monthly-amount"
                          inputMode="decimal"
                          value={workspaceForm.monthlySubscriptionAmount}
                          onChange={(event) =>
                            setWorkspaceForm((current) => ({
                              ...current,
                              monthlySubscriptionAmount: event.target.value,
                            }))
                          }
                          placeholder="490"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Statut billing</Label>
                        <Select
                          value={workspaceForm.billingStatus}
                          onValueChange={(billingStatus) =>
                            setWorkspaceForm((current) => ({
                              ...current,
                              billingStatus,
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(billingStatusLabels).map(
                              ([status, label]) => (
                                <SelectItem key={status} value={status}>
                                  {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="mt-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-muted-foreground text-xs font-semibold uppercase">
                        4. N8N
                      </p>
                      <h3 className="mt-1 text-sm font-semibold">
                        Webhooks du workflow client
                      </h3>
                    </div>
                    <Select
                      value={workspaceForm.workflowStatus}
                      onValueChange={(workflowStatus) =>
                        setWorkspaceForm((current) => ({
                          ...current,
                          workflowStatus:
                            workflowStatus as WorkflowConfigStatus,
                        }))
                      }
                    >
                      <SelectTrigger className="w-[10rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {managedWorkflowTypes.map((workflowType) => (
                      <div key={workflowType} className="space-y-1.5">
                        <Label htmlFor={`new-${workflowType}`}>
                          {workflowFieldLabels[workflowType]}
                        </Label>
                        <Input
                          id={`new-${workflowType}`}
                          value={workspaceForm.workflowUrls[workflowType]}
                          onChange={(event) =>
                            setWorkspaceForm((current) => ({
                              ...current,
                              workflowUrls: {
                                ...current.workflowUrls,
                                [workflowType]: event.target.value,
                              },
                            }))
                          }
                          placeholder="https://..."
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <div className="mt-5 flex justify-end">
                  <Button type="submit" disabled={isCreatingWorkspace}>
                    {isCreatingWorkspace ? "Création..." : "Créer le workspace"}
                  </Button>
                </div>
              </form>
            </ActionCard>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="space-y-3">
        {organizations.length === 0 ? (
          <ActionCard title="Workspaces client">
            <p className="text-muted-foreground text-sm">
              Aucun workspace disponible.
            </p>
          </ActionCard>
        ) : (
          <AnimatePresence initial={false}>
            {organizations.map((organization) => {
              const isExpanded = expandedIds.has(organization.id);
              const draft =
                workspaceDrafts[organization.id] ??
                getWorkspaceDraft(organization);
              const accessForm =
                accessForms[organization.id] ?? emptyAccessForm();
              const automationState = getAutomationState(organization);

              return (
                <motion.section
                  layout
                  key={organization.id}
                  initial={{ opacity: 0, y: 10, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.99 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="bg-card/80 overflow-hidden rounded-lg border"
                >
                  <div className="hover:bg-muted/40 grid gap-4 px-4 py-4 transition lg:grid-cols-[1fr_auto] lg:items-center">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => toggleWorkspace(organization.id)}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <motion.span
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.18 }}
                            className="inline-flex"
                          >
                            <ChevronRight className="text-muted-foreground size-4" />
                          </motion.span>
                          <h2 className="text-base font-semibold tracking-tight">
                            {organization.name}
                          </h2>
                          {organization.isInternalWorkspace ? (
                            <Badge variant="outline">Interne FalconDraft</Badge>
                          ) : null}
                          <Badge
                            variant={
                              organization.billingStatus === "active"
                                ? "default"
                                : "outline"
                            }
                          >
                            {billingStatusLabels[organization.billingStatus] ??
                              organization.billingStatus}
                          </Badge>
                          <Badge variant={automationState.badge}>
                            <span
                              className={cn(
                                "mr-1.5 inline-block size-2 rounded-full",
                                automationState.className,
                              )}
                            />
                            {automationState.label}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 truncate text-sm">
                          /{organization.slug} · setup{" "}
                          {formatAmount(organization.setupAmount)} · mensuel{" "}
                          {formatAmount(organization.monthlySubscriptionAmount)}
                        </p>
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Badge variant="secondary">
                        {organization.activeMemberCount} compte
                        {organization.activeMemberCount > 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="secondary">
                        {organization.pendingInvitationCount} invitation
                        {organization.pendingInvitationCount > 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="secondary">
                        {organization.workflowConfigs.length} webhook
                        {organization.workflowConfigs.length > 1 ? "s" : ""}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={
                          organization.isInternalWorkspace ||
                          deletingOrganizationId === organization.id
                        }
                        onClick={() => void deleteWorkspace(organization)}
                      >
                        <Trash2 />
                        {deletingOrganizationId === organization.id
                          ? "Suppression..."
                          : "Supprimer"}
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden border-t"
                      >
                        <div className="space-y-6 p-4">
                          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                            <section className="space-y-3">
                              <h3 className="text-sm font-semibold">
                                Facturation et visibilité
                              </h3>
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="space-y-1.5">
                                  <Label>Montant setup</Label>
                                  <Input
                                    inputMode="decimal"
                                    value={draft.setupAmount}
                                    onChange={(event) =>
                                      setWorkspaceDrafts((current) => ({
                                        ...current,
                                        [organization.id]: {
                                          ...draft,
                                          setupAmount: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Abonnement mensuel</Label>
                                  <Input
                                    inputMode="decimal"
                                    value={draft.monthlySubscriptionAmount}
                                    onChange={(event) =>
                                      setWorkspaceDrafts((current) => ({
                                        ...current,
                                        [organization.id]: {
                                          ...draft,
                                          monthlySubscriptionAmount:
                                            event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Statut billing</Label>
                                  <Select
                                    value={draft.billingStatus}
                                    onValueChange={(billingStatus) =>
                                      setWorkspaceDrafts((current) => ({
                                        ...current,
                                        [organization.id]: {
                                          ...draft,
                                          billingStatus,
                                        },
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(billingStatusLabels).map(
                                        ([status, label]) => (
                                          <SelectItem
                                            key={status}
                                            value={status}
                                          >
                                            {label}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <label className="bg-secondary/30 flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="accent-primary size-4"
                                  checked={draft.allowMemberCompanyVisibility}
                                  onChange={(event) =>
                                    setWorkspaceDrafts((current) => ({
                                      ...current,
                                      [organization.id]: {
                                        ...draft,
                                        allowMemberCompanyVisibility:
                                          event.target.checked,
                                      },
                                    }))
                                  }
                                />
                                Vue équipe active
                              </label>
                            </section>

                            <section className="space-y-3">
                              <h3 className="text-sm font-semibold">
                                Webhooks n8n
                              </h3>
                              <div className="space-y-1.5">
                                <Label>Statut n8n</Label>
                                <Select
                                  value={draft.workflowStatus}
                                  onValueChange={(workflowStatus) =>
                                    setWorkspaceDrafts((current) => ({
                                      ...current,
                                      [organization.id]: {
                                        ...draft,
                                        workflowStatus:
                                          workflowStatus as WorkflowConfigStatus,
                                      },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-full md:w-44">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">
                                      Actif
                                    </SelectItem>
                                    <SelectItem value="inactive">
                                      Inactif
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {managedWorkflowTypes.map((workflowType) => (
                                  <div
                                    key={workflowType}
                                    className="space-y-1.5"
                                  >
                                    <Label
                                      htmlFor={`${organization.id}-${workflowType}`}
                                    >
                                      {workflowFieldLabels[workflowType]}
                                    </Label>
                                    <Input
                                      id={`${organization.id}-${workflowType}`}
                                      value={draft.workflowUrls[workflowType]}
                                      onChange={(event) =>
                                        setWorkspaceDrafts((current) => ({
                                          ...current,
                                          [organization.id]: {
                                            ...draft,
                                            workflowUrls: {
                                              ...draft.workflowUrls,
                                              [workflowType]:
                                                event.target.value,
                                            },
                                          },
                                        }))
                                      }
                                      placeholder="https://..."
                                    />
                                    <p className="text-muted-foreground text-xs">
                                      {managedWorkflowLabels[workflowType]}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          </div>

                          <section className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h3 className="text-sm font-semibold">
                                Comptes du workspace
                              </h3>
                              <Badge variant="secondary">
                                {organization.accounts.length} actif
                                {organization.accounts.length > 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="overflow-x-auto rounded-md border">
                              <table className="w-full min-w-[48rem] text-sm">
                                <thead className="bg-secondary/40 text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">
                                      Nom
                                    </th>
                                    <th className="px-3 py-2 text-left font-medium">
                                      Email
                                    </th>
                                    <th className="px-3 py-2 text-left font-medium">
                                      Rôle
                                    </th>
                                    <th className="px-3 py-2 text-left font-medium">
                                      Statut
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium">
                                      Action
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {organization.accounts.length > 0 ? (
                                    organization.accounts.map((account) => (
                                      <tr key={account.id} className="border-t">
                                        <td className="px-3 py-2">
                                          {account.name}
                                        </td>
                                        <td className="px-3 py-2">
                                          {account.email}
                                        </td>
                                        <td className="px-3 py-2">
                                          <Select
                                            value={account.role}
                                            onValueChange={(role) =>
                                              void updateAccountRole(
                                                organization,
                                                account,
                                                role as AccessForm["role"],
                                              )
                                            }
                                            disabled={
                                              updatingAccessOrganizationId ===
                                              organization.id
                                            }
                                          >
                                            <SelectTrigger className="w-40">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {Object.entries(roleLabels).map(
                                                ([role, label]) => (
                                                  <SelectItem
                                                    key={role}
                                                    value={role}
                                                  >
                                                    {label}
                                                  </SelectItem>
                                                ),
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </td>
                                        <td className="px-3 py-2">
                                          <Badge variant="outline">
                                            {account.status}
                                          </Badge>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            disabled={
                                              deletingMemberId === account.id ||
                                              protectedAccountEmails.has(
                                                account.email
                                                  .trim()
                                                  .toLowerCase(),
                                              )
                                            }
                                            onClick={() =>
                                              void deleteAccount(
                                                organization,
                                                account,
                                              )
                                            }
                                          >
                                            <Trash2 />
                                            {deletingMemberId === account.id
                                              ? "Suppression..."
                                              : "Supprimer"}
                                          </Button>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td
                                        className="text-muted-foreground px-3 py-4"
                                        colSpan={5}
                                      >
                                        Aucun compte actif pour ce workspace.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {organization.pendingInvitations.length > 0 ? (
                              <div className="rounded-md border border-dashed p-3">
                                <p className="text-muted-foreground text-xs font-semibold uppercase">
                                  Invitations en attente
                                </p>
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  {organization.pendingInvitations.map(
                                    (invitation) => (
                                      <div
                                        key={invitation.id}
                                        className="bg-secondary/25 flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate font-medium">
                                            {invitation.email}
                                          </p>
                                          <p className="text-muted-foreground text-xs">
                                            {roleLabels[
                                              invitation.role as AccessForm["role"]
                                            ] ?? invitation.role}
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                                          disabled={
                                            deletingInvitationId ===
                                            invitation.id
                                          }
                                          onClick={() =>
                                            void deleteInvitation(
                                              organization,
                                              invitation,
                                            )
                                          }
                                          aria-label={`Supprimer l’invitation envoyée à ${invitation.email}`}
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </section>

                          <section className="space-y-3 rounded-md border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h3 className="text-sm font-semibold">
                                  Ajouter un accès
                                </h3>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  Envoyez une invitation ou créez directement le
                                  compte avec un mot de passe temporaire.
                                </p>
                              </div>
                              <div className="flex rounded-md border p-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    accessForm.mode === "invite"
                                      ? "secondary"
                                      : "ghost"
                                  }
                                  onClick={() =>
                                    setAccessForms((current) => ({
                                      ...current,
                                      [organization.id]: {
                                        ...accessForm,
                                        mode: "invite",
                                      },
                                    }))
                                  }
                                >
                                  Invitation
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    accessForm.mode === "create"
                                      ? "secondary"
                                      : "ghost"
                                  }
                                  onClick={() =>
                                    setAccessForms((current) => ({
                                      ...current,
                                      [organization.id]: {
                                        ...accessForm,
                                        mode: "create",
                                      },
                                    }))
                                  }
                                >
                                  Création directe
                                </Button>
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-5">
                              <div className="space-y-1.5 md:col-span-2">
                                <Label>Email</Label>
                                <Input
                                  type="email"
                                  value={accessForm.email}
                                  onChange={(event) =>
                                    setAccessForms((current) => ({
                                      ...current,
                                      [organization.id]: {
                                        ...accessForm,
                                        email: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="gestionnaire@client.fr"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Prénom</Label>
                                <Input
                                  value={accessForm.firstName}
                                  onChange={(event) =>
                                    setAccessForms((current) => ({
                                      ...current,
                                      [organization.id]: {
                                        ...accessForm,
                                        firstName: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Facultatif"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Nom</Label>
                                <Input
                                  value={accessForm.lastName}
                                  onChange={(event) =>
                                    setAccessForms((current) => ({
                                      ...current,
                                      [organization.id]: {
                                        ...accessForm,
                                        lastName: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Facultatif"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Rôle</Label>
                                <Select
                                  value={accessForm.role}
                                  onValueChange={(role) =>
                                    setAccessForms((current) => ({
                                      ...current,
                                      [organization.id]: {
                                        ...accessForm,
                                        role: role as AccessForm["role"],
                                      },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(roleLabels).map(
                                      ([role, label]) => (
                                        <SelectItem key={role} value={role}>
                                          {label}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {accessForm.mode === "create" ? (
                              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                                <div className="space-y-1.5">
                                  <Label>Mot de passe temporaire</Label>
                                  <div className="relative">
                                    <Input
                                      type={
                                        visiblePasswordOrganizationIds.has(
                                          organization.id,
                                        )
                                          ? "text"
                                          : "password"
                                      }
                                      value={accessForm.password}
                                      onChange={(event) =>
                                        setAccessForms((current) => ({
                                          ...current,
                                          [organization.id]: {
                                            ...accessForm,
                                            password: event.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="Minimum 8 caractères"
                                      className="pr-10"
                                    />
                                    <PasswordVisibilityToggle
                                      visible={visiblePasswordOrganizationIds.has(
                                        organization.id,
                                      )}
                                      onToggle={() =>
                                        setVisiblePasswordOrganizationIds(
                                          (current) => {
                                            const next = new Set(current);

                                            if (next.has(organization.id)) {
                                              next.delete(organization.id);
                                            } else {
                                              next.add(organization.id);
                                            }

                                            return next;
                                          },
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  disabled={
                                    updatingAccessOrganizationId ===
                                    organization.id
                                  }
                                  onClick={() =>
                                    void submitAccess(organization)
                                  }
                                >
                                  <UserPlus />
                                  {updatingAccessOrganizationId ===
                                  organization.id
                                    ? "Création..."
                                    : "Créer le compte"}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  disabled={
                                    updatingAccessOrganizationId ===
                                    organization.id
                                  }
                                  onClick={() =>
                                    void submitAccess(organization)
                                  }
                                >
                                  <Send />
                                  {updatingAccessOrganizationId ===
                                  organization.id
                                    ? "Envoi..."
                                    : shouldSendFirstManagerInvitation(
                                          organization,
                                          accessForm,
                                        )
                                      ? "Envoyer le bienvenue manager"
                                      : "Envoyer l’invitation"}
                                </Button>
                              </div>
                            )}
                          </section>

                          <div className="flex justify-end border-t pt-4">
                            <Button
                              type="button"
                              disabled={
                                savingOrganizationId === organization.id
                              }
                              onClick={() => void saveWorkspace(organization)}
                            >
                              <Save />
                              {savingOrganizationId === organization.id
                                ? "Enregistrement..."
                                : "Enregistrer le workspace"}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.section>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
