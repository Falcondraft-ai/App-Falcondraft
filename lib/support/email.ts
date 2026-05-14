import "server-only";

import { getResendClient } from "@/lib/resend/client";

const LOGO_URL = "https://app.falcondraft.fr/falcondraft-logo-off.png";

type SupportRequestType = "question" | "bug" | "feature";
type SupportLanguage = "fr" | "en";

type SupportRequestEmailInput = {
  requestType: SupportRequestType;
  language: SupportLanguage;
  subject: string;
  message: string;
  userName: string;
  userEmail: string;
  organizationName: string;
  role: string;
};

const requestTypeLabels: Record<
  SupportLanguage,
  Record<SupportRequestType, string>
> = {
  fr: {
    question: "Question d’utilisation",
    bug: "Signalement de bug",
    feature: "Suggestion de fonctionnalité",
  },
  en: {
    question: "Usage question",
    bug: "Bug report",
    feature: "Feature suggestion",
  },
};

const confirmationCopy: Record<
  SupportLanguage,
  {
    subject: string;
    preview: string;
    title: string;
    intro: string;
    detailsTitle: string;
    nextStep: string;
    footer: string;
  }
> = {
  fr: {
    subject: "Votre demande au support FalconDraft a bien été envoyée",
    preview: "Nous avons bien reçu votre message au support FalconDraft.",
    title: "Votre message a bien été envoyé.",
    intro:
      "Bonjour, nous confirmons que votre demande a été transmise au support FalconDraft. L’équipe la traitera dès que possible.",
    detailsTitle: "Résumé de votre demande",
    nextStep:
      "Vous n’avez rien d’autre à faire pour le moment. Si nous avons besoin de précisions, nous vous répondrons sur cette adresse email.",
    footer: "Merci, l’équipe FalconDraft",
  },
  en: {
    subject: "Your FalconDraft support request has been sent",
    preview: "We received your message to FalconDraft support.",
    title: "Your message has been sent.",
    intro:
      "Hello, this confirms that your request has been sent to FalconDraft support. The team will review it as soon as possible.",
    detailsTitle: "Request summary",
    nextStep:
      "There is nothing else you need to do right now. If we need more context, we will reply to this email address.",
    footer: "Thank you, the FalconDraft team",
  },
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMultilineHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function getFromEmail() {
  return process.env.FROM_EMAIL?.trim() || "no-reply@falcondraft.fr";
}

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL?.trim() || "falcondraft@outlook.fr";
}

function buildSupportNotificationText(input: SupportRequestEmailInput) {
  const requestLabel = requestTypeLabels.fr[input.requestType];

  return [
    "Nouvelle demande support FalconDraft",
    "",
    `Type : ${requestLabel}`,
    `Objet : ${input.subject}`,
    "",
    "Utilisateur",
    `Nom : ${input.userName}`,
    `Email : ${input.userEmail}`,
    `Workspace : ${input.organizationName}`,
    `Rôle : ${input.role}`,
    `Langue UI : ${input.language.toUpperCase()}`,
    "",
    "Message",
    input.message,
  ].join("\n");
}

function buildSupportNotificationHtml(input: SupportRequestEmailInput) {
  const requestLabel = escapeHtml(requestTypeLabels.fr[input.requestType]);
  const subject = escapeHtml(input.subject);
  const userName = escapeHtml(input.userName);
  const userEmail = escapeHtml(input.userEmail);
  const organizationName = escapeHtml(input.organizationName);
  const role = escapeHtml(input.role);
  const language = escapeHtml(input.language.toUpperCase());
  const message = formatMultilineHtml(input.message);
  const logoUrl = escapeHtml(LOGO_URL);

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouvelle demande support FalconDraft</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f5f7;color:#102033;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f3f5f7;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:44px 16px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #dfe4ea;border-radius:20px;border-collapse:separate;overflow:hidden;">
                <tr>
                  <td align="center" style="padding:38px 38px 18px;">
                    <img src="${logoUrl}" width="178" alt="FalconDraft" border="0" style="display:block;width:178px;max-width:72%;height:auto;border:0;outline:none;text-decoration:none;">
                    <div style="width:56px;height:2px;background:#d59436;margin:26px auto 0;line-height:2px;font-size:2px;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 38px 38px;">
                    <p style="display:inline-block;margin:0 0 16px;padding:7px 11px;background:#f6efe5;border:1px solid #efd8ba;border-radius:999px;color:#8b5519;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${requestLabel}</p>
                    <h1 style="margin:0 0 18px;color:#0d223d;font-size:26px;line-height:1.24;font-weight:800;letter-spacing:-0.02em;">${subject}</h1>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border-collapse:collapse;">
                      <tr>
                        <td style="padding:16px 18px;background:#f7f8fa;border:1px solid #dfe4ea;border-radius:12px;color:#5d6878;font-size:14px;line-height:1.7;">
                          <strong style="color:#0d223d;">Utilisateur</strong><br>
                          ${userName} · ${userEmail}<br>
                          Workspace&nbsp;: ${organizationName}<br>
                          Rôle&nbsp;: ${role}<br>
                          Langue UI&nbsp;: ${language}
                        </td>
                      </tr>
                    </table>
                    <h2 style="margin:0 0 10px;color:#0d223d;font-size:15px;line-height:1.4;font-weight:800;">Message</h2>
                    <div style="padding:18px;background:#ffffff;border:1px solid #dfe4ea;border-radius:12px;color:#344156;font-size:15px;line-height:1.72;">
                      ${message}
                    </div>
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

function buildConfirmationText(input: SupportRequestEmailInput) {
  const copy = confirmationCopy[input.language];
  const requestLabel = requestTypeLabels[input.language][input.requestType];

  return [
    copy.title,
    "",
    copy.intro,
    "",
    copy.detailsTitle,
    `Type: ${requestLabel}`,
    `Subject: ${input.subject}`,
    "",
    input.message,
    "",
    copy.nextStep,
    "",
    copy.footer,
  ].join("\n");
}

function buildConfirmationHtml(input: SupportRequestEmailInput) {
  const copy = confirmationCopy[input.language];
  const requestLabel = escapeHtml(
    requestTypeLabels[input.language][input.requestType],
  );
  const subject = escapeHtml(input.subject);
  const message = formatMultilineHtml(input.message);
  const logoUrl = escapeHtml(LOGO_URL);

  return `
    <!doctype html>
    <html lang="${input.language}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(copy.subject)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f5f7;color:#102033;font-family:Arial,Helvetica,sans-serif;">
        <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${escapeHtml(copy.preview)}</div>
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
                    <h1 style="margin:0 0 20px;color:#0d223d;font-size:26px;line-height:1.24;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(copy.title)}</h1>
                    <p style="margin:0 0 18px;color:#344156;font-size:15px;line-height:1.72;">${escapeHtml(copy.intro)}</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;">
                      <tr>
                        <td style="padding:16px 18px;background:#f7f8fa;border:1px solid #dfe4ea;border-radius:12px;color:#5d6878;font-size:14px;line-height:1.7;">
                          <strong style="color:#0d223d;">${escapeHtml(copy.detailsTitle)}</strong><br>
                          ${requestLabel}<br>
                          ${subject}
                        </td>
                      </tr>
                    </table>
                    <div style="padding:18px;background:#ffffff;border:1px solid #dfe4ea;border-radius:12px;color:#344156;font-size:15px;line-height:1.72;">
                      ${message}
                    </div>
                    <p style="margin:24px 0 0;color:#5d6878;font-size:13px;line-height:1.7;">${escapeHtml(copy.nextStep)}</p>
                    <p style="margin:26px 0 0;color:#102033;font-size:15px;line-height:1.7;"><strong style="font-weight:800;color:#0d223d;">${escapeHtml(copy.footer)}</strong></p>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;color:#8a94a3;font-size:12px;line-height:1.6;">
                FalconDraft · Email automatique
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export async function sendSupportRequestEmails(
  input: SupportRequestEmailInput,
) {
  const resend = getResendClient();

  if (!resend) {
    return {
      success: false,
      confirmationSent: false,
      message: "Configuration Resend manquante.",
    };
  }

  const supportResult = await resend.emails.send({
    from: getFromEmail(),
    to: getSupportEmail(),
    subject: `[FalconDraft Support] ${requestTypeLabels.fr[input.requestType]} — ${input.subject}`,
    text: buildSupportNotificationText(input),
    html: buildSupportNotificationHtml(input),
  });

  if (supportResult.error) {
    return {
      success: false,
      confirmationSent: false,
      message: supportResult.error.message,
    };
  }

  const confirmationResult = await resend.emails.send({
    from: getFromEmail(),
    to: input.userEmail,
    subject: confirmationCopy[input.language].subject,
    text: buildConfirmationText(input),
    html: buildConfirmationHtml(input),
  });

  return {
    success: true,
    confirmationSent: !confirmationResult.error,
    message: confirmationResult.error?.message,
  };
}
