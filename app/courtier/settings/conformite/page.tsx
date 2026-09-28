import { redirect } from "next/navigation";

// The cabinet fiche moved to its own tab — one fiche per company now.
export default function CourtierComplianceSettingsPage() {
  redirect("/courtier/settings/cabinet");
}
