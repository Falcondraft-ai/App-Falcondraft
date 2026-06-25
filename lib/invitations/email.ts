import "server-only";

import { getResendClient } from "@/lib/resend/client";

const LOGO_URL = "https://app.falcondraft.fr/falcondraft-logo-off.png";

type InvitationEmailInput = {
  to: string;
  organizationName: string;
  roleLabel: string;
  acceptUrl: string;
  recipientName?: string | null;
  workspaceType?: string;
};

type ProductCopy = {
  inviteValueProp: string;
  readyBadge: string;
  welcomeIntro: (org: string) => string;
  welcomeRole: string;
  welcomeValue: string;
  capabilities: string[];
};

const PRODUCT_COPY: Record<
  "sales_automation" | "insurance_broker",
  ProductCopy
> = {
  sales_automation: {
    inviteValueProp:
      "FalconDraft permet à votre équipe de centraliser ses dossiers commerciaux, générer ses propositions et suivre ses documents depuis un espace sécurisé.",
    readyBadge: "Espace client prêt",
    welcomeIntro: (org) =>
      `Votre espace ${org} vient d’être préparé pour accueillir votre équipe commerciale dans un environnement sécurisé, structuré et prêt à l’emploi.`,
    welcomeRole:
      "Vous êtes invité comme premier gestionnaire. Ce rôle vous donne la main pour finaliser l’accès de votre organisation, inviter les bons collaborateurs et lancer les premiers dossiers depuis un espace conçu pour professionnaliser la production commerciale.",
    welcomeValue:
      "FalconDraft aide votre équipe à centraliser les informations clés d’un dossier, transformer les notes d’appel en comptes rendus exploitables, générer des propositions mieux structurées et suivre les documents jusqu’à leur validation.",
    capabilities: [
      "inviter les collaborateurs qui doivent intervenir sur les dossiers commerciaux ;",
      "créer vos premières opportunités et centraliser les informations client ;",
      "préparer plus rapidement les propositions, documents et brouillons email ;",
      "suivre l’avancement des dossiers dans un espace clair et partagé.",
    ],
  },
  insurance_broker: {
    inviteValueProp:
      "FalconDraft permet à votre cabinet de centraliser ses dossiers clients, gérer ses documents (contrats, pièces d’identité, RIB, devis compagnies) et préparer ses devoirs de conseil depuis un espace sécurisé.",
    readyBadge: "Espace courtier prêt",
    welcomeIntro: (org) =>
      `Votre espace ${org} vient d’être préparé pour accueillir votre cabinet de courtage dans un environnement sécurisé, structuré et prêt à l’emploi.`,
    welcomeRole:
      "Vous êtes invité comme premier gestionnaire. Ce rôle vous donne la main pour finaliser l’accès de votre cabinet, inviter vos collaborateurs et ouvrir les premiers dossiers clients.",
    welcomeValue:
      "FalconDraft aide votre cabinet à centraliser les informations clients, gérer la documentation (contrats, RIB, devis compagnies), exploiter les devis des compagnies, préparer les devoirs de conseil et suivre les dossiers jusqu’à la signature.",
    capabilities: [
      "inviter les collaborateurs qui interviennent sur les dossiers clients ;",
      "ouvrir vos premiers dossiers et centraliser les informations client ;",
      "importer et classer les documents (contrats, RIB, devis compagnies) ;",
      "préparer les devoirs de conseil et suivre les dossiers jusqu’à la signature.",
    ],
  },
};

function getProductCopy(workspaceType?: string): ProductCopy {
  return workspaceType === "insurance_broker"
    ? PRODUCT_COPY.insurance_broker
    : PRODUCT_COPY.sales_automation;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getFromEmail() {
  return process.env.FROM_EMAIL?.trim() || "no-reply@falcondraft.fr";
}

function getGreeting(input: InvitationEmailInput) {
  const name = input.recipientName?.trim();

  return name ? `Bonjour ${name},` : "Bonjour,";
}

function buildInvitationText(input: InvitationEmailInput) {
  const c = getProductCopy(input.workspaceType);
  return [
    "Bonjour,",
    "",
    `Vous avez été invité à rejoindre l’espace ${input.organizationName} sur FalconDraft.`,
    "",
    c.inviteValueProp,
    "",
    `Rôle attribué : ${input.roleLabel}`,
    "",
    "Pour accepter l’invitation et créer votre accès, ouvrez le lien ci-dessous :",
    input.acceptUrl,
    "",
    "Ce lien est valable 7 jours.",
    "",
    "Si vous n’êtes pas à l’origine de cette demande ou si vous ne connaissez pas cette organisation, vous pouvez ignorer cet email.",
    "",
    "Bien cordialement,",
    "L’équipe FalconDraft",
  ].join("\n");
}

function buildInvitationHtml(input: InvitationEmailInput) {
  const c = getProductCopy(input.workspaceType);
  const organizationName = escapeHtml(input.organizationName);
  const roleLabel = escapeHtml(input.roleLabel);
  const acceptUrl = escapeHtml(input.acceptUrl);
  const logoUrl = escapeHtml(LOGO_URL);
  const inviteValueProp = escapeHtml(c.inviteValueProp);

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation FalconDraft</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f5f7;color:#102033;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f3f5f7;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:44px 16px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;background:#ffffff;border:1px solid #dfe4ea;border-radius:20px;border-collapse:separate;overflow:hidden;">
                
                <tr>
                  <td align="center" style="padding:42px 38px 22px;">
                    <img
                      src="${logoUrl}"
                      width="178"
                      alt="FalconDraft"
                      border="0"
                      style="display:block;width:178px;max-width:72%;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;"
                    >
                    <div style="width:56px;height:2px;background:#d59436;margin:28px auto 0;line-height:2px;font-size:2px;">&nbsp;</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 38px 38px;">
                    <h1 style="margin:0 0 22px;color:#0d223d;font-size:26px;line-height:1.24;font-weight:800;letter-spacing:-0.02em;">
                      Invitation à rejoindre un espace FalconDraft
                    </h1>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      Bonjour,
                    </p>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      Vous avez été invité à rejoindre l’espace <strong style="color:#0d223d;font-weight:700;">${organizationName}</strong> sur FalconDraft.
                    </p>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      ${inviteValueProp}
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;">
                      <tr>
                        <td style="padding:15px 17px;background:#f7f8fa;border:1px solid #dfe4ea;border-radius:12px;color:#5d6878;font-size:14px;line-height:1.55;">
                          Rôle attribué&nbsp;: <strong style="color:#0d223d;font-weight:700;">${roleLabel}</strong><br>
                          Expiration&nbsp;: ce lien est valable 7 jours.
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 26px;color:#344156;font-size:15px;line-height:1.72;">
                      Pour accepter l’invitation et créer votre accès, cliquez sur le bouton ci-dessous.
                    </p>

                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 28px;border-collapse:collapse;">
                      <tr>
                        <td align="center" bgcolor="#0d223d" style="border-radius:11px;">
                          <a href="${acceptUrl}" style="display:inline-block;padding:15px 27px;color:#ffffff;background:#0d223d;border-radius:11px;font-size:15px;font-weight:700;text-decoration:none;">
                            Accepter l’invitation
                          </a>
                        </td>
                      </tr>
                    </table>

                    <div style="margin:0 0 28px;padding:16px 18px;background:#f7f8fa;border:1px solid #dfe4ea;border-radius:12px;">
                      <p style="margin:0 0 8px;color:#5d6878;font-size:13px;line-height:1.6;">
                        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:
                      </p>
                      <p style="margin:0;color:#0d223d;font-size:13px;line-height:1.6;word-break:break-all;">
                        <a href="${acceptUrl}" style="color:#0d223d;text-decoration:underline;text-underline-offset:3px;">${acceptUrl}</a>
                      </p>
                    </div>

                    <p style="margin:0 0 26px;color:#5d6878;font-size:13px;line-height:1.7;">
                      Si vous n’êtes pas à l’origine de cette demande ou si vous ne connaissez pas cette organisation, vous pouvez ignorer cet email.
                    </p>

                    <p style="margin:0;color:#102033;font-size:15px;line-height:1.7;">
                      Bien cordialement,<br>
                      <strong style="font-weight:800;color:#0d223d;">L’équipe FalconDraft</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0;color:#8a94a3;font-size:12px;line-height:1.6;">
                Cet email a été envoyé automatiquement par FalconDraft. Merci de ne pas y répondre directement.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildFirstManagerWelcomeText(input: InvitationEmailInput) {
  const c = getProductCopy(input.workspaceType);
  return [
    getGreeting(input),
    "",
    `Bienvenue sur FalconDraft. ${c.welcomeIntro(input.organizationName)}`,
    "",
    c.welcomeRole,
    "",
    c.welcomeValue,
    "",
    "Votre accès vous permettra notamment de :",
    ...c.capabilities.map((cap) => `- ${cap}`),
    "",
    `Workspace : ${input.organizationName}`,
    `Rôle attribué : ${input.roleLabel}`,
    "Expiration : ce lien est valable 7 jours.",
    "",
    "Pour activer votre accès et rejoindre votre espace FalconDraft, ouvrez le lien ci-dessous :",
    input.acceptUrl,
    "",
    "Si vous souhaitez être accompagné dans la mise en route du workspace, vous pourrez nous contacter depuis votre espace après activation de votre accès.",
    "",
    "Si vous n’êtes pas à l’origine de cette demande ou si vous ne connaissez pas cette organisation, vous pouvez ignorer cet email.",
    "",
    "Bienvenue à bord,",
    "L’équipe FalconDraft",
  ].join("\n");
}

function buildFirstManagerWelcomeHtml(input: InvitationEmailInput) {
  const c = getProductCopy(input.workspaceType);
  const organizationName = escapeHtml(input.organizationName);
  const roleLabel = escapeHtml(input.roleLabel);
  const acceptUrl = escapeHtml(input.acceptUrl);
  const logoUrl = escapeHtml(LOGO_URL);
  const greeting = escapeHtml(getGreeting(input));
  const readyBadge = escapeHtml(c.readyBadge);
  const welcomeIntro = escapeHtml(c.welcomeIntro(input.organizationName));
  const welcomeRole = escapeHtml(c.welcomeRole);
  const welcomeValue = escapeHtml(c.welcomeValue);
  const capabilitiesHtml = c.capabilities
    .map(
      (cap, i) =>
        `<span style="display:block;${i < c.capabilities.length - 1 ? "margin:0 0 6px;" : ""}">• ${escapeHtml(cap)}</span>`,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue sur FalconDraft</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f5f7;color:#102033;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f3f5f7;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:44px 16px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;background:#ffffff;border:1px solid #dfe4ea;border-radius:20px;border-collapse:separate;overflow:hidden;">
                <tr>
                  <td align="center" style="padding:42px 38px 22px;">
                    <img
                      src="${logoUrl}"
                      width="178"
                      alt="FalconDraft"
                      border="0"
                      style="display:block;width:178px;max-width:72%;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;"
                    >
                    <div style="width:56px;height:2px;background:#d59436;margin:28px auto 0;line-height:2px;font-size:2px;">&nbsp;</div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 38px 38px;">
                    <p style="display:inline-block;margin:0 0 16px;padding:7px 11px;background:#f6efe5;border:1px solid #efd8ba;border-radius:999px;color:#8b5519;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">
                      ${readyBadge}
                    </p>

                    <h1 style="margin:0 0 22px;color:#0d223d;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.025em;">
                      Bienvenue sur FalconDraft.
                    </h1>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      ${greeting}
                    </p>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      ${welcomeIntro}
                    </p>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      ${welcomeRole}
                    </p>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      ${welcomeValue}
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;">
                      <tr>
                        <td style="padding:18px 20px;background:#f7f8fa;border:1px solid #dfe4ea;border-radius:12px;color:#5d6878;font-size:14px;line-height:1.7;">
                          <strong style="color:#0d223d;font-weight:800;">Votre accès</strong><br>
                          Workspace&nbsp;: <strong style="color:#0d223d;font-weight:700;">${organizationName}</strong><br>
                          Rôle&nbsp;: <strong style="color:#0d223d;font-weight:700;">${roleLabel}</strong><br>
                          Expiration&nbsp;: ce lien est valable 7 jours.
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
                      <tr>
                        <td style="padding:18px 20px;background:#fffaf3;border:1px solid #efd8ba;border-radius:12px;color:#5f4a2f;font-size:14px;line-height:1.75;">
                          <strong style="display:block;margin:0 0 8px;color:#0d223d;font-weight:800;">Ce que vous pouvez lancer dès maintenant</strong>
                          ${capabilitiesHtml}
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 26px;color:#344156;font-size:15px;line-height:1.72;">
                      Cliquez sur le bouton ci-dessous pour activer votre accès et rejoindre votre espace FalconDraft.
                    </p>

                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 28px;border-collapse:collapse;">
                      <tr>
                        <td align="center" bgcolor="#0d223d" style="border-radius:11px;">
                          <a href="${acceptUrl}" style="display:inline-block;padding:15px 27px;color:#ffffff;background:#0d223d;border-radius:11px;font-size:15px;font-weight:700;text-decoration:none;">
                            Rejoindre l’espace
                          </a>
                        </td>
                      </tr>
                    </table>

                    <div style="margin:0 0 28px;padding:16px 18px;background:#f7f8fa;border:1px solid #dfe4ea;border-radius:12px;">
                      <p style="margin:0 0 8px;color:#5d6878;font-size:13px;line-height:1.6;">
                        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:
                      </p>
                      <p style="margin:0;color:#0d223d;font-size:13px;line-height:1.6;word-break:break-all;">
                        <a href="${acceptUrl}" style="color:#0d223d;text-decoration:underline;text-underline-offset:3px;">${acceptUrl}</a>
                      </p>
                    </div>

                    <p style="margin:0 0 26px;color:#344156;font-size:15px;line-height:1.72;">
                      Si vous souhaitez être accompagné dans la mise en route du workspace, vous pourrez nous contacter depuis votre espace après activation de votre accès.
                    </p>

                    <p style="margin:0 0 26px;color:#5d6878;font-size:13px;line-height:1.7;">
                      Si vous n’êtes pas à l’origine de cette demande ou si vous ne connaissez pas cette organisation, vous pouvez ignorer cet email.
                    </p>

                    <p style="margin:0;color:#102033;font-size:15px;line-height:1.7;">
                      Bienvenue à bord,<br>
                      <strong style="font-weight:800;color:#0d223d;">L’équipe FalconDraft</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0;color:#8a94a3;font-size:12px;line-height:1.6;">
                Cet email a été envoyé automatiquement par FalconDraft. Merci de ne pas y répondre directement.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function sendTransactionalEmail({
  input,
  subject,
  text,
  html,
}: {
  input: InvitationEmailInput;
  subject: string;
  text: string;
  html: string;
}) {
  const resend = getResendClient();

  if (!resend) {
    return {
      success: false,
      message: "Configuration Resend manquante.",
    };
  }

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to: input.to,
    subject,
    text,
    html,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
  };
}

export async function sendInvitationEmail(input: InvitationEmailInput) {
  return sendTransactionalEmail({
    input,
    subject: `Invitation à rejoindre l’espace ${input.organizationName} sur FalconDraft`,
    text: buildInvitationText(input),
    html: buildInvitationHtml(input),
  });
}

export async function sendFirstManagerWelcomeEmail(
  input: InvitationEmailInput,
) {
  return sendTransactionalEmail({
    input,
    subject: `Bienvenue sur FalconDraft — rejoignez l’espace ${input.organizationName}`,
    text: buildFirstManagerWelcomeText(input),
    html: buildFirstManagerWelcomeHtml(input),
  });
}
