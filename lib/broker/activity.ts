/** Human, client-facing labels for activity event types (no raw technical names). */
export const brokerActivityTypeLabels: Record<string, string> = {
  client_created: "Nouveau dossier",
  status_changed: "Statut mis à jour",
  client_archived: "Dossier archivé",
  note_added: "Note ajoutée",
  document_added: "Document ajouté",
  document_deleted: "Document supprimé",
  quote_imported: "Devis importé",
  quote_validated: "Devis validé",
  advice_created: "Devoir de conseil généré",
  advice_validated: "Devoir de conseil validé",
  advice_outlook_draft: "Brouillon Outlook préparé",
  advice_signature_prepared: "Signature préparée",
  advice_signature_updated: "Signature mise à jour",
  advice_signed: "Devoir de conseil signé",
  contract_created: "Contrat ajouté",
  contract_updated: "Contrat mis à jour",
  contract_terminated: "Contrat résilié",
  contract_renewed: "Contrat renouvelé",
  compliance_updated: "Conformité mise à jour",
  identity_verified: "Identité vérifiée",
  consent_recorded: "Consentement enregistré",
  erasure_requested: "Effacement RGPD demandé",
  commission_statement_created: "Bordereau ajouté",
  commission_statement_reconciled: "Bordereau pointé",
  commission_added: "Commission enregistrée",
  commission_updated: "Commission mise à jour",
  claim_declared: "Sinistre déclaré",
  claim_updated: "Sinistre mis à jour",
  claim_settled: "Sinistre indemnisé",
  claim_closed: "Sinistre clos",
};

/** Returns a clean label for an activity type, never a raw technical string. */
export function brokerActivityLabel(type: string): string {
  return brokerActivityTypeLabels[type] ?? "Activité";
}
