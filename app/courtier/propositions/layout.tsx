import { redirect } from "next/navigation";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { hasProposalAutomation } from "@/lib/billing/entitlements";
import { BasePathProvider } from "@/lib/navigation/base-path";

export default async function PropositionsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await requireActiveWorkspaceContext();

  // The commercial proposal-automation module is reserved for the
  // "courtier SaaS" offering. Bespoke ("sur mesure") brokers don't get it.
  if (!hasProposalAutomation(context.organization)) {
    redirect("/courtier");
  }

  // Every nested deal/transcript component resolves its links through this
  // prefix, so the whole sales proposal flow runs inside the courtier shell.
  return (
    <BasePathProvider value="/courtier/propositions">{children}</BasePathProvider>
  );
}
