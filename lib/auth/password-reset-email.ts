import "server-only";

import { getResendClient } from "@/lib/resend/client";

const LOGO_URL = "https://app.falcondraft.fr/falcondraft-logo-off.png";

type PasswordResetEmailInput = {
  to: string;
  name: string;
  resetUrl: string;
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

function buildPasswordResetText(input: PasswordResetEmailInput) {
  return [
    `Bonjour ${input.name},`,
    "",
    "Vous avez demandé à réinitialiser votre mot de passe FalconDraft.",
    "",
    "Pour choisir un nouveau mot de passe, ouvrez le lien ci-dessous :",
    input.resetUrl,
    "",
    "Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.",
    "",
    "Bien cordialement,",
    "L’équipe FalconDraft",
  ].join("\n");
}

function buildPasswordResetHtml(input: PasswordResetEmailInput) {
  const name = escapeHtml(input.name);
  const resetUrl = escapeHtml(input.resetUrl);
  const logoUrl = escapeHtml(LOGO_URL);

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation FalconDraft</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f5f7;color:#102033;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f3f5f7;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:44px 16px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:580px;background:#ffffff;border:1px solid #dfe4ea;border-radius:20px;border-collapse:separate;overflow:hidden;">
                <tr>
                  <td align="center" style="padding:42px 38px 22px;">
                    <img src="${logoUrl}" width="178" alt="FalconDraft" border="0" style="display:block;width:178px;max-width:72%;height:auto;border:0;outline:none;text-decoration:none;">
                    <div style="width:56px;height:2px;background:#d59436;margin:28px auto 0;line-height:2px;font-size:2px;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 38px 38px;">
                    <h1 style="margin:0 0 22px;color:#0d223d;font-size:26px;line-height:1.24;font-weight:800;letter-spacing:-0.02em;">
                      Réinitialiser votre mot de passe
                    </h1>
                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">
                      Bonjour ${name},
                    </p>
                    <p style="margin:0 0 26px;color:#344156;font-size:15px;line-height:1.72;">
                      Vous avez demandé à réinitialiser votre mot de passe FalconDraft. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 28px;border-collapse:collapse;">
                      <tr>
                        <td align="center" bgcolor="#0d223d" style="border-radius:11px;">
                          <a href="${resetUrl}" style="display:inline-block;padding:15px 27px;color:#ffffff;background:#0d223d;border-radius:11px;font-size:15px;font-weight:700;text-decoration:none;">
                            Réinitialiser le mot de passe
                          </a>
                        </td>
                      </tr>
                    </table>
                    <div style="margin:0 0 28px;padding:16px 18px;background:#f7f8fa;border:1px solid #dfe4ea;border-radius:12px;">
                      <p style="margin:0 0 8px;color:#5d6878;font-size:13px;line-height:1.6;">
                        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:
                      </p>
                      <p style="margin:0;color:#0d223d;font-size:13px;line-height:1.6;word-break:break-all;">
                        <a href="${resetUrl}" style="color:#0d223d;text-decoration:underline;text-underline-offset:3px;">${resetUrl}</a>
                      </p>
                    </div>
                    <p style="margin:0 0 26px;color:#5d6878;font-size:13px;line-height:1.7;">
                      Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.
                    </p>
                    <p style="margin:0;color:#102033;font-size:15px;line-height:1.7;">
                      Bien cordialement,<br>
                      <strong style="font-weight:800;color:#0d223d;">L’équipe FalconDraft</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
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
    subject: "Réinitialisation de votre mot de passe FalconDraft",
    text: buildPasswordResetText(input),
    html: buildPasswordResetHtml(input),
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
