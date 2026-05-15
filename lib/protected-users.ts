import { normalizeEmail } from "@/lib/invitations/shared";

const protectedAccountEmails = ["timdefabron@gmail.com"];

export function isProtectedAccountEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return protectedAccountEmails.includes(normalizeEmail(email));
}
