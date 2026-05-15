import "server-only";

import { getResendClient } from "@/lib/resend/client";

const LOGO_URL = "https://app.falcondraft.fr/falcondraft-logo-off.png";

type InvitationEmailInput = {
  to: string;
  organizationName: string;
  roleLabel: string;
  acceptUrl: string;
};

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

function buildInvitationText(input: InvitationEmailInput) {
  return [
    "Bonjour,",
    "",
    `Vous avez été invité à rejoindre l’espace ${input.organizationName} sur FalconDraft.`,
    "",
    "FalconDraft permet à votre équipe de centraliser ses dossiers commerciaux, générer ses propositions et suivre ses documents depuis un espace sécurisé.",
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
  const organizationName = escapeHtml(input.organizationName);
  const roleLabel = escapeHtml(input.roleLabel);
  const acceptUrl = escapeHtml(input.acceptUrl);
  const logoUrl = escapeHtml(LOGO_URL);

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
                      FalconDraft permet à votre équipe de centraliser ses dossiers commerciaux, générer ses propositions et suivre ses documents depuis un espace sécurisé.
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
  return [
    "Bonjour,",
    "",
    `Bienvenue sur FalconDraft. L’espace ${input.organizationName} vient d’être préparé pour votre équipe.`,
    "",
    "Vous êtes invité comme premier gestionnaire de ce workspace. Vous pourrez rejoindre l’espace, finaliser votre accès, inviter les bons collaborateurs et piloter les premiers dossiers commerciaux.",
    "",
    `Rôle attribué : ${input.roleLabel}`,
    "",
    "Pour rejoindre votre espace FalconDraft, ouvrez le lien ci-dessous :",
    input.acceptUrl,
    "",
    "Ce lien est valable 7 jours.",
    "",
    "Si vous n’êtes pas à l’origine de cette demande ou si vous ne connaissez pas cette organisation, vous pouvez ignorer cet email.",
    "",
    "Bienvenue,",
    "L’équipe FalconDraft",
  ].join("\n");
}

function buildFirstManagerWelcomeHtml(input: InvitationEmailInput) {
  const organizationName = escapeHtml(input.organizationName);
  const roleLabel = escapeHtml(input.roleLabel);
  const acceptUrl = escapeHtml(input.acceptUrl);
  const logoUrl = escapeHtml(LOGO_URL);

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
                      Espace client prêt
                    </p>

                    <h1 style="margin:0 0 22px;color:#0d223d;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.025em;">
                      Bienvenue sur FalconDraft.
                    </h1>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      Bonjour,
                    </p>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      L’espace <strong style="color:#0d223d;font-weight:700;">${organizationName}</strong> vient d’être préparé pour votre équipe.
                    </p>

                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      Vous êtes invité comme premier gestionnaire. Depuis ce workspace, vous pourrez finaliser votre accès, inviter les bons collaborateurs et piloter les premiers dossiers commerciaux.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;">
                      <tr>
                        <td style="padding:16px 18px;background:#f7f8fa;border:1px solid #dfe4ea;border-radius:12px;color:#5d6878;font-size:14px;line-height:1.65;">
                          <strong style="color:#0d223d;font-weight:800;">Votre accès</strong><br>
                          Workspace&nbsp;: <strong style="color:#0d223d;font-weight:700;">${organizationName}</strong><br>
                          Rôle&nbsp;: <strong style="color:#0d223d;font-weight:700;">${roleLabel}</strong><br>
                          Expiration&nbsp;: ce lien est valable 7 jours.
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 26px;color:#344156;font-size:15px;line-height:1.72;">
                      Cliquez sur le bouton ci-dessous pour rejoindre votre espace FalconDraft.
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

                    <p style="margin:0 0 26px;color:#5d6878;font-size:13px;line-height:1.7;">
                      Si vous n’êtes pas à l’origine de cette demande ou si vous ne connaissez pas cette organisation, vous pouvez ignorer cet email.
                    </p>

                    <p style="margin:0;color:#102033;font-size:15px;line-height:1.7;">
                      Bienvenue,<br>
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
