export const languages = ["fr", "en", "es"] as const;

export type Language = (typeof languages)[number];

export type TranslationKey =
  | "common.actions.createDeal"
  | "common.actions.newDeal"
  | "common.actions.viewAll"
  | "common.actions.save"
  | "common.actions.saving"
  | "common.actions.cancel"
  | "common.actions.open"
  | "common.actions.download"
  | "common.actions.downloadQuote"
  | "common.actions.downloadFinalDocument"
  | "common.actions.editInstructions"
  | "common.empty.deals.title"
  | "common.empty.deals.description"
  | "common.empty.documents.title"
  | "common.empty.documents.description"
  | "common.empty.archives.title"
  | "common.empty.archives.description"
  | "common.empty.activity"
  | "common.status.done"
  | "common.status.active"
  | "common.status.failed"
  | "common.status.pending"
  | "common.status.ready"
  | "common.status.draft"
  | "common.status.generating"
  | "common.status.sent"
  | "language.label"
  | "language.fr"
  | "language.en"
  | "language.es"
  | "auth.login.eyebrow"
  | "auth.login.title"
  | "auth.login.cardTitle"
  | "auth.login.cardDescription"
  | "auth.login.email"
  | "auth.login.password"
  | "auth.login.forgotPassword"
  | "auth.login.submit"
  | "auth.login.submitting"
  | "auth.login.unavailable"
  | "auth.login.unavailableDescription"
  | "auth.login.refused"
  | "auth.login.refusedDescription"
  | "auth.login.success"
  | "auth.login.successDescription"
  | "auth.forgot.eyebrow"
  | "auth.forgot.title"
  | "auth.forgot.cardTitle"
  | "auth.forgot.cardDescription"
  | "auth.forgot.footer"
  | "auth.forgot.unavailable"
  | "auth.forgot.error"
  | "auth.forgot.errorDescription"
  | "auth.forgot.sent"
  | "auth.forgot.sentDescription"
  | "auth.forgot.submit"
  | "auth.forgot.submitting"
  | "auth.forgot.back"
  | "auth.update.eyebrow"
  | "auth.update.title"
  | "auth.update.cardTitle"
  | "auth.update.cardDescription"
  | "auth.update.footer"
  | "auth.update.password"
  | "auth.update.confirmPassword"
  | "auth.update.tooShort"
  | "auth.update.tooShortDescription"
  | "auth.update.mismatch"
  | "auth.update.mismatchDescription"
  | "auth.update.unavailable"
  | "auth.update.invalid"
  | "auth.update.invalidDescription"
  | "auth.update.error"
  | "auth.update.errorDescription"
  | "auth.update.success"
  | "auth.update.successDescription"
  | "auth.update.submit"
  | "auth.update.submitting"
  | "auth.update.invalidPanel"
  | "auth.update.newLink"
  | "auth.shell.clientWorkspace"
  | "auth.shell.privateAccess"
  | "auth.shell.privateTitle"
  | "auth.shell.privateDescription"
  | "auth.shell.home"
  | "auth.shell.invitedOnly"
  | "invite.invalid.expired.title"
  | "invite.invalid.expired.description"
  | "invite.invalid.revoked.title"
  | "invite.invalid.revoked.description"
  | "invite.invalid.accepted.title"
  | "invite.invalid.accepted.description"
  | "invite.invalid.default.title"
  | "invite.invalid.default.description"
  | "invite.goLogin"
  | "invite.guestSpace"
  | "invite.invitedEmail"
  | "invite.role"
  | "invite.actionImpossible"
  | "invite.acceptFallback"
  | "invite.acceptError"
  | "invite.accepted"
  | "invite.acceptedDescription"
  | "invite.createFallback"
  | "invite.accountNotCreated"
  | "invite.signInUnavailable"
  | "invite.createdSignIn"
  | "invite.fullName"
  | "invite.fullNamePlaceholder"
  | "invite.password"
  | "invite.preparing"
  | "invite.createAndJoin"
  | "invite.existingAccount"
  | "invite.loginToAccept"
  | "invite.accountRecognized"
  | "invite.accountRecognizedDescription"
  | "invite.accept"
  | "invite.accepting"
  | "invite.emailDifferent"
  | "invite.emailDifferentDescription"
  | "invite.switching"
  | "invite.switchAccount"
  | "nav.primaryLabel"
  | "nav.dashboard"
  | "nav.deals"
  | "nav.documents"
  | "nav.transcripts"
  | "nav.archives"
  | "nav.settings"
  | "nav.support"
  | "nav.internal"
  | "nav.internalAdmin"
  | "nav.internalBadge"
  | "nav.prospection"
  | "nav.quotes"
  | "nav.clients"
  | "nav.coach"
  | "nav.workflows"
  | "nav.comingSoon"
  | "common.comingSoon.title"
  | "common.comingSoon.description"
  | "common.comingSoon.badge"
  | "prospection.title"
  | "prospection.subtitle"
  | "prospection.eyebrow"
  | "prospection.leads"
  | "prospection.searches"
  | "prospection.tasks"
  | "prospection.status.new"
  | "prospection.status.toCall"
  | "prospection.status.called"
  | "prospection.status.toFollowUp"
  | "prospection.status.interested"
  | "prospection.status.meetingBooked"
  | "prospection.status.notInterested"
  | "prospection.status.badFit"
  | "prospection.status.doNotContact"
  | "prospection.status.client"
  | "prospection.status.archived"
  | "prospection.empty.leads"
  | "prospection.empty.searches"
  | "prospection.empty.tasks"
  | "prospection.actions.changeStatus"
  | "prospection.actions.markCalled"
  | "prospection.actions.archive"
  | "prospection.actions.openWebsite"
  | "prospection.actions.markDone"
  | "prospection.actions.addNote"
  | "prospection.actions.launchSearch"
  | "prospection.actions.launchSearchSoon"
  | "prospection.filters.status"
  | "prospection.filters.niche"
  | "prospection.filters.city"
  | "prospection.filters.search"
  | "prospection.filters.showArchived"
  | "prospection.table.name"
  | "prospection.table.phone"
  | "prospection.table.city"
  | "prospection.table.niche"
  | "prospection.table.status"
  | "prospection.table.rating"
  | "prospection.table.lastCalled"
  | "prospection.table.nextAction"
  | "prospection.table.actions"
  | "prospection.search.name"
  | "prospection.search.niche"
  | "prospection.search.location"
  | "prospection.search.scope"
  | "prospection.search.lastRun"
  | "prospection.task.title"
  | "prospection.task.type"
  | "prospection.task.company"
  | "prospection.task.dueAt"
  | "prospection.unauthorized.title"
  | "prospection.unauthorized.description"
  | "transcripts.empty.title"
  | "transcripts.empty.description"
  | "transcripts.new"
  | "transcripts.count"
  | "transcripts.status.ready"
  | "transcripts.status.processing"
  | "transcripts.status.waiting"
  | "transcripts.status.error"
  | "transcripts.status.ready.hint"
  | "transcripts.status.processing.hint"
  | "transcripts.status.waiting.hint"
  | "transcripts.status.error.hint"
  | "transcripts.source.paste"
  | "transcripts.source.audio"
  | "transcripts.source.recording"
  | "transcripts.source.paste.description"
  | "transcripts.source.audio.description"
  | "transcripts.source.recording.description"
  | "transcripts.soon"
  | "transcripts.deal"
  | "transcripts.by"
  | "transcripts.delete"
  | "transcripts.delete.title"
  | "transcripts.delete.description"
  | "transcripts.delete.confirm"
  | "transcripts.delete.deleting"
  | "transcripts.delete.success"
  | "transcripts.delete.error"
  | "transcripts.cancel"
  | "transcripts.detail.back"
  | "transcripts.detail.source"
  | "transcripts.detail.createdAt"
  | "transcripts.detail.createdBy"
  | "transcripts.detail.duration"
  | "transcripts.detail.deal"
  | "transcripts.detail.language"
  | "transcripts.detail.content"
  | "transcripts.detail.noContent"
  | "transcripts.detail.participants"
  | "transcripts.form.guided"
  | "transcripts.form.title"
  | "transcripts.form.step"
  | "transcripts.form.completed"
  | "transcripts.form.previous"
  | "transcripts.form.next"
  | "transcripts.form.creating"
  | "transcripts.form.create"
  | "transcripts.form.step1.title"
  | "transcripts.form.step1.description"
  | "transcripts.form.step1.label"
  | "transcripts.form.step1.placeholder"
  | "transcripts.form.step1.help"
  | "transcripts.form.step2.title"
  | "transcripts.form.step2.description"
  | "transcripts.form.step2.label"
  | "transcripts.form.step2.placeholder"
  | "transcripts.form.step2.help"
  | "transcripts.form.step3.title"
  | "transcripts.form.step3.description"
  | "transcripts.form.step3.dealLabel"
  | "transcripts.form.step3.noDeal"
  | "transcripts.form.step3.dealHelp"
  | "transcripts.form.step3.noDealsTitle"
  | "transcripts.form.step3.noDealsDescription"
  | "transcripts.form.step3.summary"
  | "transcripts.form.step3.summaryTitle"
  | "transcripts.form.step3.summaryLength"
  | "transcripts.form.success"
  | "transcripts.edit"
  | "transcripts.edit.save"
  | "transcripts.edit.saving"
  | "transcripts.edit.cancel"
  | "transcripts.edit.success"
  | "transcripts.edit.error"
  | "transcripts.archive"
  | "transcripts.archive.success"
  | "transcripts.archive.error"
  | "transcripts.unarchive"
  | "transcripts.unarchive.success"
  | "transcripts.view"
  | "transcripts.recall.button"
  | "transcripts.recall.title"
  | "transcripts.recall.description"
  | "transcripts.recall.meetingUrl"
  | "transcripts.recall.meetingUrl.placeholder"
  | "transcripts.recall.meetingUrl.help"
  | "transcripts.recall.titleLabel"
  | "transcripts.recall.titlePlaceholder"
  | "transcripts.recall.dealLabel"
  | "transcripts.recall.noDeal"
  | "transcripts.recall.submit"
  | "transcripts.recall.submitting"
  | "transcripts.recall.success"
  | "transcripts.recall.error"
  | "transcripts.recall.invalidUrl"
  | "admin.restricted"
  | "admin.restrictedTitle"
  | "admin.restrictedDescription"
  | "admin.console"
  | "admin.access"
  | "admin.title"
  | "admin.description"
  | "admin.empty"
  | "admin.deals"
  | "admin.failedRuns"
  | "nav.open"
  | "nav.sheetTitle"
  | "nav.sheetDescription"
  | "shell.workspaceTitle"
  | "shell.workspaceFallback"
  | "shell.pipeline"
  | "shell.footer"
  | "shell.userMenu"
  | "shell.profile"
  | "shell.help"
  | "shell.helpTitle"
  | "shell.helpDescription"
  | "shell.signOut"
  | "shell.signOutSuccess"
  | "shell.topbar.workspace"
  | "shell.topbar.searchPlaceholder"
  | "shell.topbar.notifications"
  | "shell.topbar.create"
  | "support.eyebrow"
  | "support.title"
  | "support.description"
  | "support.hero.badge"
  | "support.hero.kicker"
  | "support.hero.title"
  | "support.hero.description"
  | "support.guides.start.title"
  | "support.guides.start.description"
  | "support.guides.team.title"
  | "support.guides.team.description"
  | "support.guides.validation.title"
  | "support.guides.validation.description"
  | "support.faq.title"
  | "support.faq.description"
  | "support.faq.invite.question"
  | "support.faq.invite.answer"
  | "support.faq.deal.question"
  | "support.faq.deal.answer"
  | "support.faq.documents.question"
  | "support.faq.documents.answer"
  | "support.faq.validation.question"
  | "support.faq.validation.answer"
  | "support.faq.roles.question"
  | "support.faq.roles.answer"
  | "support.faq.visibility.question"
  | "support.faq.visibility.answer"
  | "support.faq.language.question"
  | "support.faq.language.answer"
  | "support.faq.issue.question"
  | "support.faq.issue.answer"
  | "support.contact.title"
  | "support.contact.description"
  | "support.contact.typeLabel"
  | "support.contact.type.question"
  | "support.contact.type.bug"
  | "support.contact.type.feature"
  | "support.contact.subject.question"
  | "support.contact.subject.bug"
  | "support.contact.subject.feature"
  | "support.contact.subjectLabel"
  | "support.contact.subjectPlaceholder"
  | "support.contact.messageLabel"
  | "support.contact.messagePlaceholder"
  | "support.contact.submit"
  | "support.contact.sending"
  | "support.contact.sent"
  | "support.contact.sentDescription"
  | "support.contact.sentNoConfirmation"
  | "support.contact.error"
  | "support.contact.errorDescription"
  | "support.contact.messageTooShort"
  | "support.quick.bug.title"
  | "support.quick.bug.description"
  | "support.quick.idea.title"
  | "support.quick.idea.description"
  | "support.quick.question.title"
  | "support.quick.question.description"
  | "dashboard.eyebrow"
  | "dashboard.title"
  | "dashboard.description"
  | "dashboard.stats.activeDeals"
  | "dashboard.stats.activeDealsDetail"
  | "dashboard.stats.readyDocuments"
  | "dashboard.stats.readyDocumentsDetail"
  | "dashboard.stats.pipelineValue"
  | "dashboard.stats.pipelineValueDetail"
  | "dashboard.stats.attention"
  | "dashboard.stats.attentionDetail"
  | "dashboard.stats.signatureRate"
  | "dashboard.stats.signatureRateDetail"
  | "dashboard.stats.pipelineOpen"
  | "dashboard.stats.activeProposals"
  | "dashboard.stats.readyToSend"
  | "dashboard.pipeline.title"
  | "dashboard.pipeline.viewAll"
  | "dashboard.pipeline.total"
  | "dashboard.pipeline.range.week"
  | "dashboard.pipeline.range.month"
  | "dashboard.pipeline.range.quarter"
  | "dashboard.pipeline.stages.draft"
  | "dashboard.pipeline.stages.review"
  | "dashboard.pipeline.stages.sent"
  | "dashboard.pipeline.stages.signed"
  | "dashboard.followUp.title"
  | "dashboard.followUp.empty"
  | "dashboard.followUp.viewAll"
  | "dashboard.recentDeals.title"
  | "dashboard.recentDeals.description"
  | "dashboard.featured.title"
  | "dashboard.featured.description"
  | "dashboard.featured.empty"
  | "dashboard.chart.title"
  | "dashboard.chart.description"
  | "dashboard.activity.title"
  | "dashboard.activity.description"
  | "table.deal"
  | "table.status"
  | "table.budget"
  | "table.updated"
  | "deals.eyebrow"
  | "deals.title"
  | "deals.description"
  | "deals.tabs.mine"
  | "deals.tabs.organization"
  | "deals.searchPlaceholder"
  | "deals.statusPlaceholder"
  | "deals.allStatuses"
  | "deals.client"
  | "deals.actions"
  | "deals.open"
  | "deals.archive"
  | "deals.restore"
  | "deals.updating"
  | "deals.delete"
  | "deals.deleting"
  | "deals.emptyFiltered"
  | "dealDetail.eyebrow"
  | "dealDetail.created"
  | "dealDetail.updated"
  | "dealDetail.owner"
  | "dealDetail.clientCompany"
  | "dealDetail.organization"
  | "dealDetail.source"
  | "dealDetail.contact"
  | "dealDetail.name"
  | "dealDetail.phone"
  | "dealDetail.transcriptTitle"
  | "dealDetail.transcriptDescription"
  | "dealDetail.productionTitle"
  | "dealDetail.productionDescription"
  | "dealDetail.callSummary"
  | "dealDetail.proposal"
  | "dealDetail.finalDocument"
  | "dealDetail.finalDocumentReady"
  | "dealDetail.finalDocumentWaiting"
  | "dealDetail.signature"
  | "dealDetail.signaturePrepared"
  | "dealDetail.generatedDocuments"
  | "dealDetail.generatedDocumentsDescription"
  | "dealDetail.emailDraft"
  | "dealDetail.instructions"
  | "dealDetail.activity"
  | "dealDetail.actions"
  | "dealDetail.actionsDescription"
  | "dealDetail.progress"
  | "dealDetail.lastUpdated"
  | "dealDetail.extraSections"
  | "dealDetail.summaryReady"
  | "dealDetail.summaryReadyDescription"
  | "dealDetail.summaryDeleteConfirm"
  | "dealDetail.summaryDeleteFallback"
  | "dealDetail.summaryDeleted"
  | "dealDetail.summaryDeletedDescription"
  | "dealDetail.summaryGenerating"
  | "dealDetail.summaryWaiting"
  | "dealDetail.summaryPolling"
  | "dealDetail.summaryStart"
  | "dealDetail.summaryStructured"
  | "dealDetail.summaryStructuredDescription"
  | "dealDetail.summaryFull"
  | "dealDetail.summaryFullDescription"
  | "dealDetail.proposalReady"
  | "dealDetail.proposalReadyDescription"
  | "dealDetail.proposalDeleteConfirm"
  | "dealDetail.proposalDeleteFallback"
  | "dealDetail.proposalDeleted"
  | "dealDetail.proposalDeletedDescription"
  | "dealDetail.proposalGenerating"
  | "dealDetail.proposalWaiting"
  | "dealDetail.proposalPolling"
  | "dealDetail.proposalStart"
  | "dealDetail.editLink"
  | "dealDetail.editLinkDescription"
  | "dealDetail.edit"
  | "dealDetail.editUnavailable"
  | "dealDetail.proposalContent"
  | "dealDetail.openContent"
  | "dealDetail.proposalFullDescription"
  | "dealDetail.deleteImpossible"
  | "dealDetail.newEyebrow"
  | "dealDetail.newTitle"
  | "dealDetail.newDescription"
  | "integrations.description"
  | "integrations.gmail.personal"
  | "integrations.gmail.connected"
  | "integrations.gmail.disconnected"
  | "integrations.gmail.connectedToast"
  | "integrations.gmail.denied"
  | "integrations.gmail.refused"
  | "integrations.gmail.unavailable"
  | "integrations.gmail.error"
  | "integrations.gmail.disconnectError"
  | "integrations.gmail.disconnectedToast"
  | "integrations.gmail.body1"
  | "integrations.gmail.body2"
  | "integrations.gmail.connectedAccount"
  | "integrations.gmail.disconnecting"
  | "integrations.gmail.disconnect"
  | "integrations.gmail.connect"
  | "integrations.microsoft.subtitle"
  | "integrations.microsoft.comingSoon"
  | "integrations.microsoft.body1"
  | "integrations.microsoft.body2"
  | "integrations.microsoft.cta"
  | "integrations.microsoft.connect"
  | "integrations.microsoft.disconnect"
  | "integrations.microsoft.disconnecting"
  | "integrations.microsoft.connected"
  | "integrations.microsoft.disconnected"
  | "integrations.microsoft.connectedAccount"
  | "integrations.microsoft.connectedToast"
  | "integrations.microsoft.disconnectedToast"
  | "integrations.microsoft.disconnectError"
  | "integrations.microsoft.denied"
  | "integrations.microsoft.refused"
  | "integrations.microsoft.unavailable"
  | "integrations.microsoft.error"
  | "billing.current"
  | "billing.details"
  | "billing.statusDetail"
  | "billing.nextInvoiceDetail"
  | "billing.manage"
  | "billing.emptyInvoices"
  | "billing.notesTitle"
  | "billing.notesDescription"
  | "documents.eyebrow"
  | "documents.title"
  | "documents.description"
  | "documents.libraryTitle"
  | "documents.libraryMine"
  | "documents.libraryOrganization"
  | "documents.tabs.mine"
  | "documents.tabs.organization"
  | "documents.dealLabel"
  | "archives.eyebrow"
  | "archives.title"
  | "archives.description"
  | "settings.eyebrow"
  | "settings.title"
  | "settings.description"
  | "settings.nav.general"
  | "settings.nav.team"
  | "settings.nav.integrations"
  | "settings.nav.billing"
  | "settings.profile.title"
  | "settings.profile.description"
  | "settings.photo.choose"
  | "settings.photo.remove"
  | "settings.photo.dialogTitle"
  | "settings.photo.dialogDescription"
  | "settings.photo.formats"
  | "settings.photo.formatsDetail"
  | "settings.photo.select"
  | "settings.photo.saving"
  | "settings.photo.updating"
  | "settings.photo.errorTitle"
  | "settings.photo.errorDescription"
  | "settings.photo.errorSize"
  | "settings.photo.errorSizeTitle"
  | "settings.photo.errorFormat"
  | "settings.photo.errorFormatTitle"
  | "settings.photo.successUpdated"
  | "settings.photo.successRemoved"
  | "settings.photo.removeErrorTitle"
  | "settings.photo.removeErrorDescription"
  | "settings.preferences.title"
  | "settings.preferences.description"
  | "settings.organizationName"
  | "settings.defaultLanguage"
  | "settings.defaultLanguagePlaceholder"
  | "settings.appearance"
  | "settings.appearancePlaceholder"
  | "settings.appearance.light"
  | "settings.appearance.dark"
  | "settings.appearance.system"
  | "settings.askCloseDate"
  | "settings.askCloseDateDescription"
  | "settings.saved"
  | "visibility.title"
  | "visibility.description"
  | "visibility.option"
  | "visibility.optionDescription"
  | "visibility.saveError"
  | "visibility.notSaved"
  | "visibility.saved"
  | "visibility.savedOpen"
  | "visibility.savedRestricted"
  | "team.title"
  | "team.description"
  | "team.columns.name"
  | "team.columns.email"
  | "team.columns.role"
  | "team.columns.status"
  | "team.columns.lastActive"
  | "team.columns.actions"
  | "team.you"
  | "team.remove"
  | "team.removing"
  | "team.confirmRemove"
  | "team.errorRemove"
  | "team.kept"
  | "team.removed"
  | "team.removedDescription"
  | "team.roleUpdateSuccess"
  | "team.roleUpdateError"
  | "team.emptyTitle"
  | "team.emptyDescription"
  | "team.invite.title"
  | "team.invite.description"
  | "team.invite.email"
  | "team.invite.role"
  | "team.invite.placeholder"
  | "team.invite.submit"
  | "team.invite.submitting"
  | "team.invite.sent"
  | "team.invite.sentDescription"
  | "team.invite.error"
  | "team.invitations.title"
  | "team.invitations.description"
  | "team.invitations.expires"
  | "team.invitations.action"
  | "team.invitations.revoke"
  | "team.invitations.revoking"
  | "team.invitations.revoked"
  | "team.invitations.emptyTitle"
  | "team.invitations.emptyDescription"
  | "team.status.active"
  | "team.status.invited"
  | "roles.manager"
  | "roles.member"
  | "roles.viewer"
  | "dealStatus.draft"
  | "dealStatus.call_summary_ready"
  | "dealStatus.proposal_generating"
  | "dealStatus.proposal_ready"
  | "dealStatus.validation_pending"
  | "dealStatus.final_document_generating"
  | "dealStatus.final_document_ready"
  | "dealStatus.signature_ready"
  | "dealStatus.email_draft_ready"
  | "dealStatus.completed"
  | "dealStatus.failed"
  | "documentType.proposal"
  | "documentType.proposal_gamma"
  | "documentType.proposal_pdf"
  | "documentType.proposal_pdf_initial"
  | "documentType.quote"
  | "documentType.quote_pdf"
  | "documentType.final_document"
  | "documentType.final_document_pdf"
  | "documentType.signature_link"
  | "workflow.opportunity.label"
  | "workflow.opportunity.description"
  | "workflow.summary.label"
  | "workflow.summary.description"
  | "workflow.proposal.label"
  | "workflow.proposal.description"
  | "workflow.validation.label"
  | "workflow.validation.description"
  | "workflow.final_document.label"
  | "workflow.final_document.description"
  | "workflow.signature.label"
  | "workflow.signature.description"
  | "workflow.email.label"
  | "workflow.email.description"
  | "activity.workflow.failed"
  | "activity.workflow.completed"
  | "activity.workflow.running"
  | "activity.workflow.description"
  | "activity.audit.invitation_created"
  | "activity.audit.invitation_accepted"
  | "activity.audit.invitation_revoked"
  | "activity.audit.member_deactivated"
  | "activity.audit.organization_member_role_updated"
  | "activity.audit.organization_visibility_updated"
  | "activity.audit.email_provider_connected"
  | "activity.audit.email_provider_disconnected"
  | "activity.audit.email_draft_workflow_started"
  | "activity.audit.organization_created"
  | "activity.audit.workflow_config_created"
  | "activity.audit.workflow_config_updated"
  | "activity.audit.first_manager_invited"
  | "activity.audit.deal_updated"
  | "activity.audit.proposal_deleted"
  | "activity.audit.summary_deleted"
  | "activity.audit.deal_archived"
  | "activity.audit.deal_restored"
  | "activity.audit.generic"
  | "activity.actor.team"
  | "activity.actor.system";

type Dictionary = Record<TranslationKey, string>;

export const translations: Record<Language, Dictionary> = {
  fr: {
    "common.actions.createDeal": "Créer un dossier commercial",
    "common.actions.newDeal": "+ Nouveau dossier",
    "common.actions.viewAll": "Tout voir",
    "common.actions.save": "Enregistrer",
    "common.actions.saving": "Enregistrement...",
    "common.actions.cancel": "Annuler",
    "common.actions.open": "Ouvrir",
    "common.actions.download": "Télécharger",
    "common.actions.downloadQuote": "Télécharger le devis",
    "common.actions.downloadFinalDocument": "Télécharger le document final",
    "common.actions.editInstructions": "Éditer les consignes",
    "common.empty.deals.title": "Aucun dossier commercial",
    "common.empty.deals.description":
      "Créez un premier dossier commercial pour suivre le pipeline et les documents associés.",
    "common.empty.documents.title": "Aucun document",
    "common.empty.documents.description":
      "Les documents apparaîtront ici dès qu’ils seront préparés pour un dossier commercial.",
    "common.empty.archives.title": "Aucun dossier archivé",
    "common.empty.archives.description":
      "Les dossiers archivés apparaîtront ici sans entrer dans le pipeline commercial.",
    "common.empty.activity":
      "Aucune activité récente pour ce dossier commercial.",
    "common.status.done": "Fait",
    "common.status.active": "Actif",
    "common.status.failed": "À corriger",
    "common.status.pending": "À venir",
    "common.status.ready": "Prêt",
    "common.status.draft": "Brouillon",
    "common.status.generating": "En cours",
    "common.status.sent": "Envoyé",
    "language.label": "Langue",
    "language.fr": "Français",
    "language.en": "English",
    "language.es": "Español",
    "auth.login.eyebrow": "Espace client",
    "auth.login.title": "Connexion à FalconDraft",
    "auth.login.cardTitle": "Accès sécurisé",
    "auth.login.cardDescription":
      "Connectez-vous pour rejoindre votre espace de travail.",
    "auth.login.email": "Email professionnel",
    "auth.login.password": "Mot de passe",
    "auth.login.forgotPassword": "Mot de passe oublié ?",
    "auth.login.submit": "Se connecter",
    "auth.login.submitting": "Connexion...",
    "auth.login.unavailable": "Connexion indisponible",
    "auth.login.unavailableDescription":
      "La configuration Supabase est manquante.",
    "auth.login.refused": "Connexion refusée",
    "auth.login.refusedDescription":
      "Vérifiez votre email et votre mot de passe.",
    "auth.login.success": "Connexion validée",
    "auth.login.successDescription": "Ouverture de votre espace FalconDraft.",
    "auth.forgot.eyebrow": "Mot de passe oublié",
    "auth.forgot.title": "Recevoir un lien sécurisé",
    "auth.forgot.cardTitle": "Réinitialisation",
    "auth.forgot.cardDescription":
      "Indiquez l’email associé à votre compte FalconDraft.",
    "auth.forgot.footer": "Lien valable temporairement.",
    "auth.forgot.unavailable": "Réinitialisation indisponible",
    "auth.forgot.error": "Demande impossible",
    "auth.forgot.errorDescription":
      "La demande n’a pas pu être envoyée pour le moment.",
    "auth.forgot.sent": "Email envoyé",
    "auth.forgot.sentDescription":
      "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
    "auth.forgot.submit": "Recevoir le lien",
    "auth.forgot.submitting": "Envoi...",
    "auth.forgot.back": "Retour à la connexion",
    "auth.update.eyebrow": "Nouveau mot de passe",
    "auth.update.title": "Sécuriser votre accès",
    "auth.update.cardTitle": "Définir un nouveau mot de passe",
    "auth.update.cardDescription":
      "Choisissez un mot de passe solide pour votre compte.",
    "auth.update.footer": "Session de réinitialisation sécurisée.",
    "auth.update.password": "Nouveau mot de passe",
    "auth.update.confirmPassword": "Confirmer le mot de passe",
    "auth.update.tooShort": "Mot de passe trop court",
    "auth.update.tooShortDescription": "Utilisez au moins 8 caractères.",
    "auth.update.mismatch": "Confirmation différente",
    "auth.update.mismatchDescription":
      "Les deux mots de passe doivent être identiques.",
    "auth.update.unavailable": "Mise à jour indisponible",
    "auth.update.invalid": "Lien invalide ou expiré",
    "auth.update.invalidDescription":
      "Demandez un nouveau lien de réinitialisation.",
    "auth.update.error": "Mise à jour impossible",
    "auth.update.errorDescription":
      "Le lien a peut-être expiré. Demandez un nouveau lien.",
    "auth.update.success": "Mot de passe modifié",
    "auth.update.successDescription":
      "Vous pouvez accéder à votre espace FalconDraft.",
    "auth.update.submit": "Enregistrer le mot de passe",
    "auth.update.submitting": "Mise à jour...",
    "auth.update.invalidPanel":
      "Le lien de réinitialisation est invalide ou expiré. Demandez un nouveau lien pour définir votre mot de passe.",
    "auth.update.newLink": "Demander un nouveau lien",
    "auth.shell.clientWorkspace": "Espace client",
    "auth.shell.privateAccess": "Accès privé",
    "auth.shell.privateTitle": "Connexion à votre espace FalconDraft.",
    "auth.shell.privateDescription":
      "Un accès sécurisé pour suivre les dossiers, documents et validations de votre espace client.",
    "auth.shell.home": "Accueil",
    "auth.shell.invitedOnly": "Accès réservé aux utilisateurs invités.",
    "invite.invalid.expired.title": "Invitation expirée",
    "invite.invalid.expired.description":
      "Ce lien n’est plus actif. Demandez à un gestionnaire de l’espace d’envoyer une nouvelle invitation.",
    "invite.invalid.revoked.title": "Invitation révoquée",
    "invite.invalid.revoked.description":
      "Cette invitation a été annulée. Contactez votre interlocuteur FalconDraft si vous pensez qu’il s’agit d’une erreur.",
    "invite.invalid.accepted.title": "Invitation déjà acceptée",
    "invite.invalid.accepted.description":
      "Ce lien a déjà été utilisé. Connectez-vous avec le compte associé pour accéder à votre espace.",
    "invite.invalid.default.title": "Invitation invalide",
    "invite.invalid.default.description":
      "Ce lien d’invitation est introuvable ou incomplet. Vérifiez l’email reçu ou demandez une nouvelle invitation.",
    "invite.goLogin": "Aller à la connexion",
    "invite.guestSpace": "Espace invité",
    "invite.invitedEmail": "Email invité",
    "invite.role": "Rôle",
    "invite.actionImpossible": "Action impossible",
    "invite.acceptFallback": "Invitation impossible à accepter.",
    "invite.acceptError": "Invitation non acceptée",
    "invite.accepted": "Invitation acceptée",
    "invite.acceptedDescription":
      "Votre accès à l’espace FalconDraft est prêt.",
    "invite.createFallback":
      "Création impossible. Connectez-vous si votre compte existe déjà.",
    "invite.accountNotCreated": "Compte non créé",
    "invite.signInUnavailable":
      "Connexion indisponible. La configuration Supabase est manquante.",
    "invite.createdSignIn":
      "Compte créé. Connectez-vous avec votre email et votre mot de passe pour accepter l’invitation.",
    "invite.fullName": "Nom complet",
    "invite.fullNamePlaceholder": "Votre nom",
    "invite.password": "Mot de passe",
    "invite.preparing": "Préparation de l’accès...",
    "invite.createAndJoin": "Créer mon compte et rejoindre",
    "invite.existingAccount": "Vous avez déjà un compte FalconDraft ?",
    "invite.loginToAccept": "Connectez-vous pour accepter l’invitation.",
    "invite.accountRecognized": "Compte reconnu",
    "invite.accountRecognizedDescription":
      "Vous êtes connecté avec {email}. Vous pouvez maintenant rejoindre l’espace {organization}.",
    "invite.accept": "Accepter l’invitation",
    "invite.accepting": "Acceptation...",
    "invite.emailDifferent": "Email différent",
    "invite.emailDifferentDescription":
      "Cette invitation est destinée à {invitedEmail}. Vous êtes connecté avec {currentEmail}. Déconnectez-vous pour utiliser le bon compte.",
    "invite.switching": "Déconnexion...",
    "invite.switchAccount": "Changer de compte",
    "nav.primaryLabel": "Navigation principale",
    "nav.dashboard": "Tableau de bord",
    "nav.deals": "Dossiers",
    "nav.documents": "Documents",
    "nav.transcripts": "Transcripts",
    "nav.archives": "Archives",
    "nav.settings": "Paramètres",
    "nav.support": "Support",
    "nav.internal": "Interne",
    "nav.internalAdmin": "Admin interne",
    "nav.internalBadge": "Interne",
    "nav.prospection": "Prospection",
    "nav.quotes": "Devis",
    "nav.clients": "Clients",
    "nav.coach": "Coach IA",
    "nav.workflows": "Workflows",
    "nav.comingSoon": "À venir",
    "common.comingSoon.title": "Fonctionnalité à venir",
    "common.comingSoon.description":
      "Cette section sera disponible dans une prochaine mise à jour. Vous serez prévenu dès qu'elle sera activée pour votre espace.",
    "common.comingSoon.badge": "Bientôt disponible",
    "prospection.title": "Prospection",
    "prospection.subtitle": "Gestion interne des leads FalconDraft",
    "prospection.eyebrow": "Interne",
    "prospection.leads": "Leads",
    "prospection.searches": "Recherches",
    "prospection.tasks": "Tâches",
    "prospection.status.new": "Nouveau",
    "prospection.status.toCall": "À appeler",
    "prospection.status.called": "Déjà appelé",
    "prospection.status.toFollowUp": "À relancer",
    "prospection.status.interested": "Intéressé",
    "prospection.status.meetingBooked": "RDV pris",
    "prospection.status.notInterested": "Pas intéressé",
    "prospection.status.badFit": "Mauvais fit",
    "prospection.status.doNotContact": "Ne plus contacter",
    "prospection.status.client": "Client",
    "prospection.status.archived": "Archivé",
    "prospection.empty.leads": "Aucun lead trouvé",
    "prospection.empty.searches": "Aucune recherche configurée",
    "prospection.empty.tasks": "Aucune tâche en attente",
    "prospection.actions.changeStatus": "Changer le statut",
    "prospection.actions.markCalled": "Marquer comme appelé",
    "prospection.actions.archive": "Archiver",
    "prospection.actions.openWebsite": "Ouvrir le site",
    "prospection.actions.markDone": "Marquer comme fait",
    "prospection.actions.addNote": "Ajouter une note",
    "prospection.actions.launchSearch": "Lancer la recherche",
    "prospection.actions.launchSearchSoon": "Bientôt disponible",
    "prospection.filters.status": "Statut",
    "prospection.filters.niche": "Niche",
    "prospection.filters.city": "Ville",
    "prospection.filters.search": "Rechercher...",
    "prospection.filters.showArchived": "Afficher les leads archivés",
    "prospection.table.name": "Nom",
    "prospection.table.phone": "Téléphone",
    "prospection.table.city": "Ville",
    "prospection.table.niche": "Niche",
    "prospection.table.status": "Statut",
    "prospection.table.rating": "Note",
    "prospection.table.lastCalled": "Dernier appel",
    "prospection.table.nextAction": "Prochaine action",
    "prospection.table.actions": "Actions",
    "prospection.search.name": "Nom",
    "prospection.search.niche": "Niche",
    "prospection.search.location": "Localisation",
    "prospection.search.scope": "Périmètre",
    "prospection.search.lastRun": "Dernière exécution",
    "prospection.task.title": "Titre",
    "prospection.task.type": "Type",
    "prospection.task.company": "Entreprise",
    "prospection.task.dueAt": "Échéance",
    "prospection.unauthorized.title": "Accès non autorisé",
    "prospection.unauthorized.description": "Cette section est réservée à l'équipe interne FalconDraft.",
    "transcripts.empty.title": "Aucun transcript",
    "transcripts.empty.description":
      "Les transcripts d'appels commerciaux apparaîtront ici. Vous pouvez en ajouter un en collant du texte.",
    "transcripts.new": "Nouveau transcript",
    "transcripts.count": "transcript",
    "transcripts.status.ready": "Prêt",
    "transcripts.status.processing": "Transcription en cours",
    "transcripts.status.waiting": "En attente de l'appel",
    "transcripts.status.error": "Erreur",
    "transcripts.status.ready.hint":
      "Le transcript est disponible et peut être utilisé pour un dossier.",
    "transcripts.status.processing.hint":
      "L'appel est terminé, le transcript est en cours de préparation.",
    "transcripts.status.waiting.hint":
      "FalconDraft attend que la réunion commence ou que le bot termine l'enregistrement.",
    "transcripts.status.error.hint":
      "La transcription a échoué. Vous pouvez réessayer ou créer un nouveau transcript.",
    "transcripts.source.paste": "Coller un transcript",
    "transcripts.source.audio": "Importer un audio",
    "transcripts.source.recording": "Connecter un outil",
    "transcripts.source.paste.description":
      "Collez un transcript existant pour le centraliser et le lier à un dossier.",
    "transcripts.source.audio.description":
      "Importez un enregistrement pour transcription automatique.",
    "transcripts.source.recording.description":
      "Connectez un outil d'enregistrement pour recevoir les transcripts directement.",
    "transcripts.soon": "Bientôt",
    "transcripts.deal": "Dossier",
    "transcripts.by": "par",
    "transcripts.delete": "Supprimer",
    "transcripts.delete.title": "Supprimer ce transcript ?",
    "transcripts.delete.description":
      "Le transcript sera définitivement supprimé. Cette action est irréversible.",
    "transcripts.delete.confirm": "Supprimer",
    "transcripts.delete.deleting": "Suppression...",
    "transcripts.delete.success": "Transcript supprimé.",
    "transcripts.delete.error": "Suppression impossible.",
    "transcripts.cancel": "Annuler",
    "transcripts.detail.back": "Retour",
    "transcripts.detail.source": "Source",
    "transcripts.detail.createdAt": "Créé le",
    "transcripts.detail.createdBy": "Par",
    "transcripts.detail.duration": "Durée",
    "transcripts.detail.deal": "Dossier",
    "transcripts.detail.language": "Langue",
    "transcripts.detail.content": "Contenu du transcript",
    "transcripts.detail.noContent": "Aucun contenu disponible.",
    "transcripts.detail.participants": "Participants",
    "transcripts.form.guided": "Création guidée",
    "transcripts.form.title": "Nouveau transcript",
    "transcripts.form.step": "Étape {current} sur {total}",
    "transcripts.form.completed": "{percent}% complété",
    "transcripts.form.previous": "Précédent",
    "transcripts.form.next": "Suivant",
    "transcripts.form.creating": "Création...",
    "transcripts.form.create": "Créer le transcript",
    "transcripts.form.step1.title": "Identification",
    "transcripts.form.step1.description":
      "Donnez un titre explicite au transcript pour le retrouver facilement.",
    "transcripts.form.step1.label": "Titre du transcript",
    "transcripts.form.step1.placeholder": "Ex. Appel découverte — Société X",
    "transcripts.form.step1.help":
      "Un titre concret pour identifier cet échange.",
    "transcripts.form.step2.title": "Contenu",
    "transcripts.form.step2.description":
      "Collez le transcript complet de l'appel ou de la réunion.",
    "transcripts.form.step2.label": "Contenu du transcript",
    "transcripts.form.step2.placeholder":
      "Collez ici le transcript de l'appel ou de la réunion...",
    "transcripts.form.step2.help":
      "Plus le contenu est complet, plus les analyses seront pertinentes.",
    "transcripts.form.step3.title": "Liaison",
    "transcripts.form.step3.description":
      "Associez ce transcript à un dossier commercial existant si pertinent.",
    "transcripts.form.step3.dealLabel": "Lier à un dossier (optionnel)",
    "transcripts.form.step3.noDeal": "Aucun dossier",
    "transcripts.form.step3.dealHelp":
      "Le transcript sera associé au dossier sélectionné pour enrichir les générations.",
    "transcripts.form.step3.noDealsTitle": "Aucun dossier disponible",
    "transcripts.form.step3.noDealsDescription":
      "Le transcript sera créé sans liaison. Vous pourrez le lier plus tard.",
    "transcripts.form.step3.summary": "Récapitulatif",
    "transcripts.form.step3.summaryTitle": "Titre :",
    "transcripts.form.step3.summaryLength": "Longueur :",
    "transcripts.form.success": "Transcript créé.",
    "transcripts.edit": "Modifier",
    "transcripts.edit.save": "Enregistrer",
    "transcripts.edit.saving": "Enregistrement...",
    "transcripts.edit.cancel": "Annuler",
    "transcripts.edit.success": "Transcript mis à jour.",
    "transcripts.edit.error": "Mise à jour impossible.",
    "transcripts.archive": "Archiver",
    "transcripts.archive.success": "Transcript archivé.",
    "transcripts.archive.error": "Archivage impossible.",
    "transcripts.unarchive": "Désarchiver",
    "transcripts.unarchive.success": "Transcript désarchivé.",
    "transcripts.view": "Voir",
    "transcripts.recall.button": "Récupérer un appel",
    "transcripts.recall.title": "Récupérer un appel",
    "transcripts.recall.description":
      "Collez le lien de votre réunion Google Meet, Zoom ou Teams pour récupérer automatiquement le transcript.",
    "transcripts.recall.meetingUrl": "Lien de la réunion",
    "transcripts.recall.meetingUrl.placeholder":
      "https://meet.google.com/abc-defg-hij",
    "transcripts.recall.meetingUrl.help":
      "Google Meet, Zoom ou Microsoft Teams.",
    "transcripts.recall.titleLabel": "Titre du transcript",
    "transcripts.recall.titlePlaceholder": "Ex. Appel découverte — Société X",
    "transcripts.recall.dealLabel": "Lier à un dossier (optionnel)",
    "transcripts.recall.noDeal": "Aucun dossier",
    "transcripts.recall.submit": "Lancer la capture",
    "transcripts.recall.submitting": "Envoi...",
    "transcripts.recall.success":
      "Capture lancée. Le transcript apparaîtra une fois l'appel terminé.",
    "transcripts.recall.error": "Impossible de lancer la capture.",
    "transcripts.recall.invalidUrl": "URL de réunion non supportée.",
    "admin.restricted": "Accès réservé",
    "admin.restrictedTitle": "Page interne FalconDraft",
    "admin.restrictedDescription":
      "Cette route est prévue pour une vérification de rôle interne et ne doit pas apparaître dans l’espace client standard.",
    "admin.console": "Console interne",
    "admin.access": "Accès interne",
    "admin.title": "Supervision FalconDraft",
    "admin.description":
      "Console réservée à l’équipe FalconDraft pour surveiller les organisations, les utilisateurs et les cycles de génération.",
    "admin.empty": "Aucune ligne disponible.",
    "admin.deals": "Dossiers commerciaux",
    "admin.failedRuns": "Générations échouées",
    "nav.open": "Ouvrir la navigation",
    "nav.sheetTitle": "Navigation FalconDraft",
    "nav.sheetDescription":
      "Accès aux principales sections de l’espace client.",
    "shell.workspaceTitle": "Production commerciale",
    "shell.workspaceFallback": "Dossiers, documents et suivi",
    "shell.pipeline": "Dossier commercial → proposition → validation → envoi",
    "shell.footer": "FalconDraft · Propositions commerciales",
    "shell.userMenu": "Menu utilisateur",
    "shell.profile": "Profil",
    "shell.help": "Aide",
    "shell.helpTitle": "Aide FalconDraft",
    "shell.helpDescription": "Ouvrir le centre d’aide et de support.",
    "shell.signOut": "Déconnexion",
    "shell.signOutSuccess": "Session fermée",
    "shell.topbar.workspace": "Espace",
    "shell.topbar.searchPlaceholder":
      "Rechercher un client, une proposition, un document…",
    "shell.topbar.notifications": "Notifications",
    "shell.topbar.create": "Créer",
    "support.eyebrow": "Support",
    "support.title": "Aide & support FalconDraft",
    "support.description":
      "Trouvez rapidement une réponse, signalez un bug ou proposez une amélioration à l’équipe FalconDraft.",
    "support.hero.badge": "Réponse humaine",
    "support.hero.kicker": "Centre d’aide",
    "support.hero.title": "Tout pour utiliser FalconDraft avec confiance.",
    "support.hero.description":
      "Cette page rassemble les questions fréquentes sur l’espace de travail, les dossiers commerciaux, les documents, la validation et la gestion d’équipe.",
    "support.guides.start.title": "Démarrer un dossier",
    "support.guides.start.description":
      "Créez un dossier, ajoutez le contexte commercial et suivez chaque étape jusqu’au document final.",
    "support.guides.team.title": "Équipe et rôles",
    "support.guides.team.description":
      "Comprenez ce que permet chaque rôle et comment collaborer dans l’espace de travail.",
    "support.guides.validation.title": "Valider et envoyer",
    "support.guides.validation.description":
      "Relisez les propositions, préparez les documents finaux et gardez une trace claire des actions.",
    "support.faq.title": "Questions fréquentes",
    "support.faq.description":
      "Les réponses essentielles pour utiliser l’application au quotidien.",
    "support.faq.invite.question": "Comment rejoindre un workspace ?",
    "support.faq.invite.answer":
      "FalconDraft fonctionne sur invitation. Ouvrez le lien reçu par email, créez votre mot de passe si nécessaire, puis connectez-vous avec l’adresse invitée.",
    "support.faq.deal.question": "À quoi sert un dossier commercial ?",
    "support.faq.deal.answer":
      "Un dossier commercial centralise le client, le contexte, le budget, les étapes de génération et les documents associés à une opportunité.",
    "support.faq.documents.question": "Où retrouver mes documents ?",
    "support.faq.documents.answer":
      "Les documents sont accessibles depuis l’onglet Documents et depuis chaque dossier. Les contenus générés et les données client ne sont jamais traduits par le changement de langue de l’interface.",
    "support.faq.validation.question": "Comment fonctionne la validation ?",
    "support.faq.validation.answer":
      "Les étapes de validation indiquent ce qui est prêt, ce qui demande une relecture et ce qui peut être envoyé. Les traces restent visibles dans l’activité du dossier.",
    "support.faq.roles.question": "Que peuvent faire les rôles d’équipe ?",
    "support.faq.roles.answer":
      "Les gestionnaires pilotent l’équipe et les réglages. Les collaborateurs travaillent sur les dossiers autorisés. Les lecteurs consultent sans modifier les éléments sensibles.",
    "support.faq.visibility.question":
      "Comment fonctionnent les réglages de visibilité ?",
    "support.faq.visibility.answer":
      "Selon les réglages de votre workspace, vous pouvez voir les vues globales de l’entreprise ou uniquement les dossiers et documents qui vous concernent.",
    "support.faq.language.question": "Comment changer la langue ?",
    "support.faq.language.answer":
      "Le choix de langue se fait dans Paramètres. Le français reste la langue par défaut, et l’anglais traduit uniquement l’interface de l’application.",
    "support.faq.issue.question": "Que faire si je vois une erreur ?",
    "support.faq.issue.answer":
      "Notez l’action réalisée, le dossier concerné, le message affiché et l’heure approximative. Envoyez ces informations au support pour accélérer le diagnostic.",
    "support.contact.title": "Contacter le support",
    "support.contact.description":
      "Envoyez une demande à l’équipe FalconDraft. Le message part depuis l’application, puis vous recevez une confirmation par email.",
    "support.contact.typeLabel": "Type de demande",
    "support.contact.type.question": "Question d’utilisation",
    "support.contact.type.bug": "Signaler un bug",
    "support.contact.type.feature": "Suggérer une fonctionnalité",
    "support.contact.subject.question": "Question sur FalconDraft",
    "support.contact.subject.bug": "Bug à corriger dans FalconDraft",
    "support.contact.subject.feature":
      "Suggestion de fonctionnalité FalconDraft",
    "support.contact.subjectLabel": "Objet",
    "support.contact.subjectPlaceholder": "Ex. Problème sur un document final",
    "support.contact.messageLabel": "Message",
    "support.contact.messagePlaceholder":
      "Décrivez votre question, le bug observé ou l’amélioration souhaitée.",
    "support.contact.submit": "Envoyer au support",
    "support.contact.sending": "Envoi...",
    "support.contact.sent": "Message envoyé",
    "support.contact.sentDescription":
      "Le support FalconDraft a reçu votre demande. Un email de confirmation vient de vous être envoyé.",
    "support.contact.sentNoConfirmation":
      "Le support FalconDraft a reçu votre demande. L’email de confirmation n’a pas pu être envoyé automatiquement.",
    "support.contact.error": "Envoi impossible",
    "support.contact.errorDescription":
      "Votre message n’a pas pu être envoyé au support pour le moment.",
    "support.contact.messageTooShort":
      "Ajoutez au moins quelques détails pour aider le support à comprendre votre demande.",
    "support.quick.bug.title": "Bug",
    "support.quick.bug.description":
      "Indiquez les étapes pour reproduire, le navigateur et le dossier concerné.",
    "support.quick.idea.title": "Suggestion",
    "support.quick.idea.description":
      "Expliquez le résultat attendu et l’impact pour votre workflow commercial.",
    "support.quick.question.title": "Question",
    "support.quick.question.description":
      "Demandez de l’aide sur un usage, un rôle, une étape ou un réglage.",
    "dashboard.eyebrow": "Tableau de bord",
    "dashboard.title": "Suivi commercial",
    "dashboard.description": "Voici où en sont vos dossiers.",
    "dashboard.stats.activeDeals": "En cours",
    "dashboard.stats.activeDealsDetail": "Hors dossiers terminés",
    "dashboard.stats.readyDocuments": "Prêts à envoyer",
    "dashboard.stats.readyDocumentsDetail": "À valider ou envoyer",
    "dashboard.stats.pipelineValue": "Valeur estimée",
    "dashboard.stats.pipelineValueDetail": "Pipeline en cours",
    "dashboard.stats.attention": "Nécessitent votre attention",
    "dashboard.stats.attentionDetail": "Validation, document ou erreur",
    "dashboard.stats.signatureRate": "Taux de signature",
    "dashboard.stats.signatureRateDetail": "Sur 30 derniers jours",
    "dashboard.stats.pipelineOpen": "Pipeline ouvert",
    "dashboard.stats.activeProposals": "Propositions actives",
    "dashboard.stats.readyToSend": "Prêt à envoyer",
    "dashboard.pipeline.title": "Pipeline par étape",
    "dashboard.pipeline.viewAll": "Voir le détail",
    "dashboard.pipeline.total": "Total pipeline",
    "dashboard.pipeline.range.week": "7 j",
    "dashboard.pipeline.range.month": "30 j",
    "dashboard.pipeline.range.quarter": "Trim.",
    "dashboard.pipeline.stages.draft": "Brouillon",
    "dashboard.pipeline.stages.review": "En revue",
    "dashboard.pipeline.stages.sent": "Envoyée",
    "dashboard.pipeline.stages.signed": "Signée",
    "dashboard.followUp.title": "Dossiers à suivre",
    "dashboard.followUp.empty": "Aucun dossier ne demande votre attention.",
    "dashboard.followUp.viewAll": "Tous les dossiers",
    "dashboard.recentDeals.title": "Dossiers récents",
    "dashboard.recentDeals.description": "À traiter en priorité",
    "dashboard.featured.title": "Dossier à suivre",
    "dashboard.featured.description": "Suivez la progression",
    "dashboard.featured.empty": "Aucun dossier prioritaire pour le moment.",
    "dashboard.chart.title": "Activité de génération",
    "dashboard.chart.description":
      "Volume mensuel des propositions et documents finaux.",
    "dashboard.activity.title": "Journal récent",
    "dashboard.activity.description": "Derniers changements significatifs.",
    "table.deal": "Dossier commercial",
    "table.status": "Statut",
    "table.budget": "Budget",
    "table.updated": "Mise à jour",
    "deals.eyebrow": "Dossiers commerciaux",
    "deals.title": "Vos dossiers",
    "deals.description": "Retrouvez et gérez toutes vos propositions.",
    "deals.tabs.mine": "Mes dossiers",
    "deals.tabs.organization": "Toute l’entreprise",
    "deals.searchPlaceholder": "Rechercher...",
    "deals.statusPlaceholder": "Filtrer par statut",
    "deals.allStatuses": "Tous les statuts",
    "deals.client": "Client",
    "deals.actions": "Actions",
    "deals.open": "Ouvrir",
    "deals.archive": "Archiver",
    "deals.restore": "Restaurer",
    "deals.updating": "Mise à jour...",
    "deals.delete": "Supprimer",
    "deals.deleting": "Suppression...",
    "deals.emptyFiltered":
      "Aucun dossier commercial ne correspond à ces critères.",
    "dealDetail.eyebrow": "Dossier",
    "dealDetail.created": "Créée",
    "dealDetail.updated": "Mise à jour",
    "dealDetail.owner": "Responsable",
    "dealDetail.clientCompany": "Entreprise cliente",
    "dealDetail.organization": "Organisation",
    "dealDetail.source": "Source",
    "dealDetail.contact": "Contact",
    "dealDetail.name": "Nom",
    "dealDetail.phone": "Téléphone",
    "dealDetail.transcriptTitle": "Notes & transcription",
    "dealDetail.transcriptDescription":
      "Votre base de travail pour ce dossier.",
    "dealDetail.productionTitle": "Documents générés",
    "dealDetail.productionDescription":
      "Tous les documents liés à ce dossier.",
    "dealDetail.callSummary": "Compte-rendu",
    "dealDetail.proposal": "Proposition",
    "dealDetail.finalDocument": "Document final",
    "dealDetail.finalDocumentReady": "Document final prêt à être téléchargé.",
    "dealDetail.finalDocumentWaiting":
      "Document final prêt à être partagé lorsque la proposition est validée.",
    "dealDetail.signature": "Signature",
    "dealDetail.signaturePrepared": "Lien de signature préparé",
    "dealDetail.generatedDocuments": "Documents générés",
    "dealDetail.generatedDocumentsDescription":
      "Fichiers et liens produits pour ce dossier commercial.",
    "dealDetail.emailDraft": "Email prêt à envoyer",
    "dealDetail.instructions": "Consigne : {instructions}",
    "dealDetail.activity": "Journal d’activité",
    "dealDetail.actions": "Actions",
    "dealDetail.actionsDescription":
      "Commandes principales du cycle de proposition.",
    "dealDetail.progress": "Progression",
    "dealDetail.lastUpdated": "Dernière mise à jour",
    "dealDetail.extraSections":
      "{count} section(s) supplémentaire(s) dans la vue complète.",
    "dealDetail.summaryReady": "Compte-rendu prêt",
    "dealDetail.summaryReadyDescription":
      "Le compte-rendu est disponible dans le dossier.",
    "dealDetail.summaryDeleteConfirm":
      "Supprimer le compte-rendu ? Vous pourrez modifier le dossier puis le régénérer ensuite.",
    "dealDetail.summaryDeleteFallback":
      "Le compte-rendu n’a pas pu être supprimé.",
    "dealDetail.summaryDeleted": "Compte-rendu supprimé",
    "dealDetail.summaryDeletedDescription":
      "Vous pouvez modifier le dossier puis relancer la génération.",
    "dealDetail.summaryGenerating": "Génération du compte-rendu en cours",
    "dealDetail.summaryWaiting": "Compte-rendu en attente",
    "dealDetail.summaryPolling":
      "La page se mettra à jour automatiquement dès que le compte-rendu sera disponible.",
    "dealDetail.summaryStart":
      "Lancez la génération depuis le panneau d’actions pour préparer cette section.",
    "dealDetail.summaryStructured": "Compte-rendu structuré",
    "dealDetail.summaryStructuredDescription":
      "Lecture synthétique des points clés extraits du dossier.",
    "dealDetail.summaryFull": "Compte-rendu complet",
    "dealDetail.summaryFullDescription":
      "Version complète et structurée du compte-rendu commercial.",
    "dealDetail.proposalReady": "Proposition prête",
    "dealDetail.proposalReadyDescription":
      "La proposition est disponible dans le dossier.",
    "dealDetail.proposalDeleteConfirm":
      "Supprimer la proposition ? Vous pourrez modifier le dossier puis la régénérer ensuite.",
    "dealDetail.proposalDeleteFallback":
      "La proposition n’a pas pu être supprimée.",
    "dealDetail.proposalDeleted": "Proposition supprimée",
    "dealDetail.proposalDeletedDescription":
      "Vous pouvez modifier le dossier puis relancer la génération.",
    "dealDetail.proposalGenerating": "Génération de la proposition en cours",
    "dealDetail.proposalWaiting": "Proposition en attente",
    "dealDetail.proposalPolling":
      "La page se mettra à jour automatiquement dès que la proposition sera disponible.",
    "dealDetail.proposalStart":
      "Lancez la génération depuis le panneau d’actions pour préparer cette section.",
    "dealDetail.editLink": "Lien d’édition",
    "dealDetail.editLinkDescription":
      "Accès à l’espace de travail externe pour ajuster la proposition.",
    "dealDetail.edit": "Éditer",
    "dealDetail.editUnavailable": "Édition indisponible",
    "dealDetail.proposalContent": "Contenu de la proposition",
    "dealDetail.openContent": "Ouvrir le contenu",
    "dealDetail.proposalFullDescription":
      "Version complète et structurée de la proposition commerciale.",
    "dealDetail.deleteImpossible": "Suppression impossible",
    "dealDetail.newEyebrow": "Nouveau dossier commercial",
    "dealDetail.newTitle": "Créer un dossier commercial",
    "dealDetail.newDescription":
      "Avancez étape par étape : cadrage, contact, notes d’échange puis consignes de sortie.",
    "integrations.description":
      "Connectez votre compte email pour préparer les brouillons d’envoi depuis votre propre messagerie.",
    "integrations.gmail.personal": "Compte Google personnel ou professionnel",
    "integrations.gmail.connected": "Connecté",
    "integrations.gmail.disconnected": "Non connecté",
    "integrations.gmail.connectedToast": "Gmail est connecté à FalconDraft.",
    "integrations.gmail.denied": "Connexion Gmail annulée.",
    "integrations.gmail.refused": "Connexion Gmail refusée pour ce workspace.",
    "integrations.gmail.unavailable": "Configuration Gmail indisponible.",
    "integrations.gmail.error":
      "Connexion Gmail impossible. Réessayez depuis les paramètres.",
    "integrations.gmail.disconnectError": "Déconnexion impossible.",
    "integrations.gmail.disconnectedToast": "Gmail est déconnecté.",
    "integrations.gmail.body1":
      "FalconDraft crée uniquement des brouillons dans votre Gmail. Aucun email n’est envoyé automatiquement.",
    "integrations.gmail.body2":
      "Vous gardez toujours le contrôle : relisez, modifiez puis envoyez depuis Gmail quand vous êtes prêt.",
    "integrations.gmail.connectedAccount": "Compte connecté",
    "integrations.gmail.disconnecting": "Déconnexion…",
    "integrations.gmail.disconnect": "Déconnecter",
    "integrations.gmail.connect": "Connecter Gmail",
    "integrations.microsoft.subtitle":
      "Compte Microsoft personnel ou professionnel",
    "integrations.microsoft.comingSoon": "Bientôt",
    "integrations.microsoft.body1":
      "Connectez votre compte Outlook ou Microsoft 365 pour préparer vos brouillons commerciaux directement depuis FalconDraft.",
    "integrations.microsoft.body2":
      "FalconDraft prépare uniquement des brouillons. Vous restez maître de l'envoi.",
    "integrations.microsoft.cta": "Connecter Outlook",
    "integrations.microsoft.connect": "Connecter Outlook",
    "integrations.microsoft.disconnect": "Déconnecter",
    "integrations.microsoft.disconnecting": "Déconnexion...",
    "integrations.microsoft.connected": "Connecté",
    "integrations.microsoft.disconnected": "Non connecté",
    "integrations.microsoft.connectedAccount": "Compte connecté",
    "integrations.microsoft.connectedToast":
      "Outlook est connecté à FalconDraft.",
    "integrations.microsoft.disconnectedToast": "Outlook déconnecté.",
    "integrations.microsoft.disconnectError": "Déconnexion impossible.",
    "integrations.microsoft.denied": "Connexion Outlook annulée.",
    "integrations.microsoft.refused":
      "Connexion Outlook refusée pour ce workspace.",
    "integrations.microsoft.unavailable": "Configuration Outlook indisponible.",
    "integrations.microsoft.error":
      "Une erreur s'est produite lors de la connexion Outlook. Veuillez réessayer.",
    "billing.current": "Abonnement actuel",
    "billing.details":
      "{price} · Statut {status} · Prochaine échéance : {nextInvoice}",
    "billing.statusDetail": "Statut {status}",
    "billing.nextInvoiceDetail": "Prochaine échéance : {nextInvoice}",
    "billing.manage": "Gérer l’abonnement",
    "billing.emptyInvoices": "Aucun historique de facture disponible.",
    "billing.notesTitle": "Notes de facturation",
    "billing.notesDescription":
      "Les informations d’abonnement, les échéances et les factures sont regroupées pour faciliter le suivi administratif.",
    "documents.eyebrow": "Documents",
    "documents.title": "Documents générés",
    "documents.description":
      "Propositions, devis, documents finaux et liens de signature associés aux dossiers commerciaux.",
    "documents.libraryTitle": "Bibliothèque de travail",
    "documents.libraryMine": "Dernières pièces préparées pour vos dossiers.",
    "documents.libraryOrganization":
      "Dernières pièces préparées pour tous les dossiers actifs.",
    "documents.tabs.mine": "Mes documents",
    "documents.tabs.organization": "Toute l’entreprise",
    "documents.dealLabel": "Deal",
    "archives.eyebrow": "Archives",
    "archives.title": "Dossiers archivés",
    "archives.description":
      "Dossiers retirés du pipeline commercial, conservés pour consultation ou restauration.",
    "settings.eyebrow": "Paramètres",
    "settings.title": "Paramètres",
    "settings.description": "Personnalisez votre espace FalconDraft.",
    "settings.nav.general": "Général",
    "settings.nav.team": "Équipe",
    "settings.nav.integrations": "Intégrations",
    "settings.nav.billing": "Facturation",
    "settings.profile.title": "Profil",
    "settings.profile.description":
      "Photo et identité affichées dans votre espace client.",
    "settings.photo.choose": "Choisir une photo",
    "settings.photo.remove": "Retirer",
    "settings.photo.dialogTitle": "Photo de profil",
    "settings.photo.dialogDescription":
      "Choisissez une image professionnelle, nette et centrée sur le visage.",
    "settings.photo.formats": "Formats acceptés",
    "settings.photo.formatsDetail": "PNG, JPG ou WebP. Taille maximale : 2 Mo.",
    "settings.photo.select": "Sélectionner une image",
    "settings.photo.saving": "Enregistrement...",
    "settings.photo.updating": "Mise à jour...",
    "settings.photo.errorTitle": "Photo non enregistrée",
    "settings.photo.errorDescription": "La photo n'a pas pu être enregistrée.",
    "settings.photo.errorSize": "La photo doit rester sous 2 Mo.",
    "settings.photo.errorSizeTitle": "Image trop lourde",
    "settings.photo.errorFormat":
      "Choisissez une image au format PNG, JPG ou WebP.",
    "settings.photo.errorFormatTitle": "Format non pris en charge",
    "settings.photo.successUpdated": "Photo de profil mise à jour.",
    "settings.photo.successRemoved": "Photo de profil retirée.",
    "settings.photo.removeErrorTitle": "Photo non retirée",
    "settings.photo.removeErrorDescription":
      "La photo n'a pas pu être supprimée.",
    "settings.preferences.title": "Préférences",
    "settings.preferences.description":
      "Personnalisez votre espace FalconDraft.",
    "settings.organizationName": "Nom du workspace",
    "settings.defaultLanguage": "Langue de l’interface",
    "settings.defaultLanguagePlaceholder": "Sélectionner une langue",
    "settings.appearance": "Mode d’affichage",
    "settings.appearancePlaceholder": "Choisir un thème",
    "settings.appearance.light": "Clair",
    "settings.appearance.dark": "Sombre",
    "settings.appearance.system": "Système",
    "settings.askCloseDate": "Demander une échéance cible",
    "settings.askCloseDateDescription":
      "Ajoute un champ optionnel dans la création d’un dossier et dans l’édition du dossier.",
    "settings.saved": "Paramètres enregistrés.",
    "visibility.title": "Accès & permissions",
    "visibility.description":
      "Contrôlez l’accès des collaborateurs aux vues globales dossiers et documents.",
    "visibility.option": "Autoriser les vues “Toute l’entreprise”",
    "visibility.optionDescription":
      "Quand cette option est désactivée, les collaborateurs ne voient plus l’onglet entreprise et accèdent uniquement à leurs propres dossiers et documents. Les gestionnaires conservent la vue globale.",
    "visibility.saveError": "Mise à jour impossible.",
    "visibility.notSaved": "Préférence non enregistrée",
    "visibility.saved": "Visibilité mise à jour",
    "visibility.savedOpen":
      "Les collaborateurs peuvent ouvrir les vues entreprise.",
    "visibility.savedRestricted":
      "Les collaborateurs voient uniquement leurs dossiers et documents.",
    "team.title": "Collaborateurs",
    "team.description": "Membres actifs, rôles et accès au workspace.",
    "team.columns.name": "Nom",
    "team.columns.email": "Email",
    "team.columns.role": "Rôle",
    "team.columns.status": "Statut",
    "team.columns.lastActive": "Dernière activité",
    "team.columns.actions": "Actions",
    "team.you": "Vous",
    "team.remove": "Retirer du workspace",
    "team.removing": "Retrait...",
    "team.confirmRemove":
      "Retirer {name} du workspace ? Son accès sera désactivé.",
    "team.errorRemove": "Retrait impossible.",
    "team.kept": "Membre conservé",
    "team.removed": "Membre retiré",
    "team.removedDescription": "{name} n’a plus accès au workspace.",
    "team.roleUpdateSuccess": "Rôle mis à jour",
    "team.roleUpdateError": "Rôle non modifié",
    "team.emptyTitle": "Aucun membre",
    "team.emptyDescription":
      "Les membres associés à cet espace client apparaîtront ici.",
    "team.invite.title": "Inviter un collaborateur",
    "team.invite.description":
      "Un lien privé est envoyé par email. Aucun accès public à la création de compte n’est ouvert.",
    "team.invite.email": "Email professionnel",
    "team.invite.role": "Rôle",
    "team.invite.placeholder": "collaborateur@cabinet.com",
    "team.invite.submit": "Envoyer l’invitation",
    "team.invite.submitting": "Envoi en cours...",
    "team.invite.sent": "Invitation envoyée",
    "team.invite.sentDescription": "{email} a reçu son lien FalconDraft.",
    "team.invite.error": "Invitation non envoyée",
    "team.invitations.title": "Invitations en attente",
    "team.invitations.description":
      "Liens actifs qui n’ont pas encore été acceptés.",
    "team.invitations.expires": "Expiration",
    "team.invitations.action": "Action",
    "team.invitations.revoke": "Révoquer",
    "team.invitations.revoking": "Révocation...",
    "team.invitations.revoked": "Invitation révoquée",
    "team.invitations.emptyTitle": "Aucune invitation en attente",
    "team.invitations.emptyDescription":
      "Les invitations envoyées et non acceptées apparaîtront ici.",
    "team.status.active": "Actif",
    "team.status.invited": "Invitation envoyée",
    "roles.manager": "Gestionnaire",
    "roles.member": "Collaborateur",
    "roles.viewer": "Lecteur",
    "dealStatus.draft": "Brouillon",
    "dealStatus.call_summary_ready": "Compte-rendu prêt",
    "dealStatus.proposal_generating": "Proposition en cours",
    "dealStatus.proposal_ready": "Proposition prête",
    "dealStatus.validation_pending": "En attente de validation",
    "dealStatus.final_document_generating": "Document final en cours",
    "dealStatus.final_document_ready": "Document final prêt",
    "dealStatus.signature_ready": "Signature prête",
    "dealStatus.email_draft_ready": "Email prêt",
    "dealStatus.completed": "Terminé",
    "dealStatus.failed": "Erreur",
    "documentType.proposal": "Proposition",
    "documentType.proposal_gamma": "Proposition éditable",
    "documentType.proposal_pdf": "PDF proposition",
    "documentType.proposal_pdf_initial": "PDF proposition",
    "documentType.quote": "Devis",
    "documentType.quote_pdf": "Devis PDF",
    "documentType.final_document": "Document final",
    "documentType.final_document_pdf": "Document final prêt à signer",
    "documentType.signature_link": "Lien de signature",
    "workflow.opportunity.label": "Deal",
    "workflow.opportunity.description": "Cadrage client",
    "workflow.summary.label": "Compte-rendu",
    "workflow.summary.description": "Synthèse de l’appel",
    "workflow.proposal.label": "Proposition",
    "workflow.proposal.description": "Document prêt à envoyer",
    "workflow.validation.label": "Validation",
    "workflow.validation.description": "Vérification interne",
    "workflow.final_document.label": "Document final",
    "workflow.final_document.description": "PDF finalisé",
    "workflow.signature.label": "Signature",
    "workflow.signature.description": "Lien de signature",
    "workflow.email.label": "Email d’envoi",
    "workflow.email.description": "Brouillon personnalisable",
    "activity.workflow.failed": "Génération échouée",
    "activity.workflow.completed": "Génération terminée",
    "activity.workflow.running": "Génération en cours",
    "activity.workflow.description": "Flux {type} · statut {status}",
    "activity.audit.invitation_created": "Invitation envoyée",
    "activity.audit.invitation_accepted": "Invitation acceptée",
    "activity.audit.invitation_revoked": "Invitation révoquée",
    "activity.audit.member_deactivated": "Collaborateur retiré",
    "activity.audit.organization_member_role_updated":
      "Rôle collaborateur mis à jour",
    "activity.audit.organization_visibility_updated":
      "Visibilité du workspace mise à jour",
    "activity.audit.email_provider_connected": "Messagerie connectée",
    "activity.audit.email_provider_disconnected": "Messagerie déconnectée",
    "activity.audit.email_draft_workflow_started":
      "Création du brouillon Gmail lancée",
    "activity.audit.organization_created": "Workspace client créé",
    "activity.audit.workflow_config_created": "Configuration workflow créée",
    "activity.audit.workflow_config_updated":
      "Configuration workflow mise à jour",
    "activity.audit.first_manager_invited": "Premier gestionnaire invité",
    "activity.audit.deal_updated": "Dossier commercial mis à jour",
    "activity.audit.proposal_deleted": "Proposition supprimée",
    "activity.audit.summary_deleted": "Compte-rendu supprimé",
    "activity.audit.deal_archived": "Dossier commercial archivé",
    "activity.audit.deal_restored": "Dossier commercial restauré",
    "activity.audit.generic": "Changement enregistré",
    "activity.actor.team": "Équipe",
    "activity.actor.system": "FalconDraft",
  },
  en: {
    "common.actions.createDeal": "Create deal",
    "common.actions.newDeal": "+ New deal",
    "common.actions.viewAll": "View all",
    "common.actions.save": "Save",
    "common.actions.saving": "Saving...",
    "common.actions.cancel": "Cancel",
    "common.actions.open": "Open",
    "common.actions.download": "Download",
    "common.actions.downloadQuote": "Download quote",
    "common.actions.downloadFinalDocument": "Download final document",
    "common.actions.editInstructions": "Edit instructions",
    "common.empty.deals.title": "No deals",
    "common.empty.deals.description":
      "Create your first deal to track the pipeline and its related documents.",
    "common.empty.documents.title": "No documents",
    "common.empty.documents.description":
      "Documents will appear here as soon as they are prepared for a deal.",
    "common.empty.archives.title": "No archived deals",
    "common.empty.archives.description":
      "Archived deals will appear here without being included in the active pipeline.",
    "common.empty.activity": "No recent activity for this deal.",
    "common.status.done": "Done",
    "common.status.active": "Active",
    "common.status.failed": "Needs attention",
    "common.status.pending": "Upcoming",
    "common.status.ready": "Ready",
    "common.status.draft": "Draft",
    "common.status.generating": "In progress",
    "common.status.sent": "Sent",
    "language.label": "Language",
    "language.fr": "Français",
    "language.en": "English",
    "language.es": "Español",
    "auth.login.eyebrow": "Client workspace",
    "auth.login.title": "Sign in to FalconDraft",
    "auth.login.cardTitle": "Secure access",
    "auth.login.cardDescription":
      "Sign in with the email address linked to your invitation.",
    "auth.login.email": "Work email",
    "auth.login.password": "Password",
    "auth.login.forgotPassword": "Forgot password?",
    "auth.login.submit": "Sign in",
    "auth.login.submitting": "Signing in...",
    "auth.login.unavailable": "Sign-in unavailable",
    "auth.login.unavailableDescription": "Supabase configuration is missing.",
    "auth.login.refused": "Sign-in refused",
    "auth.login.refusedDescription": "Check your email and password.",
    "auth.login.success": "Signed in",
    "auth.login.successDescription": "Opening your FalconDraft workspace.",
    "auth.forgot.eyebrow": "Forgot password",
    "auth.forgot.title": "Get a secure link",
    "auth.forgot.cardTitle": "Password reset",
    "auth.forgot.cardDescription":
      "Enter the email address linked to your FalconDraft account.",
    "auth.forgot.footer": "The link is valid for a limited time.",
    "auth.forgot.unavailable": "Password reset unavailable",
    "auth.forgot.error": "Request failed",
    "auth.forgot.errorDescription":
      "The reset request could not be sent right now.",
    "auth.forgot.sent": "Email sent",
    "auth.forgot.sentDescription":
      "If an account exists for this email, a reset link has been sent.",
    "auth.forgot.submit": "Send reset link",
    "auth.forgot.submitting": "Sending...",
    "auth.forgot.back": "Back to sign in",
    "auth.update.eyebrow": "New password",
    "auth.update.title": "Secure your access",
    "auth.update.cardTitle": "Set a new password",
    "auth.update.cardDescription": "Choose a strong password for your account.",
    "auth.update.footer": "Secure reset session.",
    "auth.update.password": "New password",
    "auth.update.confirmPassword": "Confirm password",
    "auth.update.tooShort": "Password too short",
    "auth.update.tooShortDescription": "Use at least 8 characters.",
    "auth.update.mismatch": "Passwords do not match",
    "auth.update.mismatchDescription": "Both passwords must be identical.",
    "auth.update.unavailable": "Update unavailable",
    "auth.update.invalid": "Invalid or expired link",
    "auth.update.invalidDescription": "Request a new reset link.",
    "auth.update.error": "Update failed",
    "auth.update.errorDescription":
      "The link may have expired. Request a new one.",
    "auth.update.success": "Password updated",
    "auth.update.successDescription":
      "You can now access your FalconDraft workspace.",
    "auth.update.submit": "Save password",
    "auth.update.submitting": "Updating...",
    "auth.update.invalidPanel":
      "The reset link is invalid or expired. Request a new link to set your password.",
    "auth.update.newLink": "Request a new link",
    "auth.shell.clientWorkspace": "Client workspace",
    "auth.shell.privateAccess": "Private access",
    "auth.shell.privateTitle": "Sign in to your FalconDraft workspace.",
    "auth.shell.privateDescription":
      "Secure access to track deals, documents, and approvals in your client workspace.",
    "auth.shell.home": "Home",
    "auth.shell.invitedOnly": "Access reserved for invited users.",
    "invite.invalid.expired.title": "Invitation expired",
    "invite.invalid.expired.description":
      "This link is no longer active. Ask a workspace manager to send a new invitation.",
    "invite.invalid.revoked.title": "Invitation revoked",
    "invite.invalid.revoked.description":
      "This invitation has been cancelled. Contact your FalconDraft contact if this looks wrong.",
    "invite.invalid.accepted.title": "Invitation already accepted",
    "invite.invalid.accepted.description":
      "This link has already been used. Sign in with the associated account to access your workspace.",
    "invite.invalid.default.title": "Invalid invitation",
    "invite.invalid.default.description":
      "This invitation link is missing or incomplete. Check the email you received or ask for a new invitation.",
    "invite.goLogin": "Go to sign in",
    "invite.guestSpace": "Guest workspace",
    "invite.invitedEmail": "Invited email",
    "invite.role": "Role",
    "invite.actionImpossible": "Action unavailable",
    "invite.acceptFallback": "This invitation could not be accepted.",
    "invite.acceptError": "Invitation not accepted",
    "invite.accepted": "Invitation accepted",
    "invite.acceptedDescription": "Your FalconDraft workspace access is ready.",
    "invite.createFallback":
      "Account creation failed. Sign in if your account already exists.",
    "invite.accountNotCreated": "Account not created",
    "invite.signInUnavailable":
      "Sign-in unavailable. Supabase configuration is missing.",
    "invite.createdSignIn":
      "Account created. Sign in with your email and password to accept the invitation.",
    "invite.fullName": "Full name",
    "invite.fullNamePlaceholder": "Your name",
    "invite.password": "Password",
    "invite.preparing": "Preparing access...",
    "invite.createAndJoin": "Create my account and join",
    "invite.existingAccount": "Already have a FalconDraft account?",
    "invite.loginToAccept": "Sign in to accept the invitation.",
    "invite.accountRecognized": "Account recognized",
    "invite.accountRecognizedDescription":
      "You are signed in as {email}. You can now join {organization}.",
    "invite.accept": "Accept invitation",
    "invite.accepting": "Accepting...",
    "invite.emailDifferent": "Different email",
    "invite.emailDifferentDescription":
      "This invitation is for {invitedEmail}. You are signed in as {currentEmail}. Sign out to use the right account.",
    "invite.switching": "Signing out...",
    "invite.switchAccount": "Switch account",
    "nav.primaryLabel": "Primary navigation",
    "nav.dashboard": "Dashboard",
    "nav.deals": "Deals",
    "nav.documents": "Documents",
    "nav.transcripts": "Transcripts",
    "nav.archives": "Archive",
    "nav.settings": "Settings",
    "nav.support": "Support",
    "nav.internal": "Internal",
    "nav.internalAdmin": "Internal admin",
    "nav.internalBadge": "Internal",
    "nav.prospection": "Prospection",
    "nav.quotes": "Quotes",
    "nav.clients": "Clients",
    "nav.coach": "AI Coach",
    "nav.workflows": "Workflows",
    "nav.comingSoon": "Coming soon",
    "common.comingSoon.title": "Feature coming soon",
    "common.comingSoon.description":
      "This section will be available in a future update. You'll be notified once it's activated for your workspace.",
    "common.comingSoon.badge": "Coming soon",
    "prospection.title": "Prospection",
    "prospection.subtitle": "Internal FalconDraft lead management",
    "prospection.eyebrow": "Internal",
    "prospection.leads": "Leads",
    "prospection.searches": "Searches",
    "prospection.tasks": "Tasks",
    "prospection.status.new": "New",
    "prospection.status.toCall": "To call",
    "prospection.status.called": "Called",
    "prospection.status.toFollowUp": "To follow up",
    "prospection.status.interested": "Interested",
    "prospection.status.meetingBooked": "Meeting booked",
    "prospection.status.notInterested": "Not interested",
    "prospection.status.badFit": "Bad fit",
    "prospection.status.doNotContact": "Do not contact",
    "prospection.status.client": "Client",
    "prospection.status.archived": "Archived",
    "prospection.empty.leads": "No leads found",
    "prospection.empty.searches": "No searches configured",
    "prospection.empty.tasks": "No pending tasks",
    "prospection.actions.changeStatus": "Change status",
    "prospection.actions.markCalled": "Mark as called",
    "prospection.actions.archive": "Archive",
    "prospection.actions.openWebsite": "Open website",
    "prospection.actions.markDone": "Mark as done",
    "prospection.actions.addNote": "Add note",
    "prospection.actions.launchSearch": "Launch search",
    "prospection.actions.launchSearchSoon": "Coming soon",
    "prospection.filters.status": "Status",
    "prospection.filters.niche": "Niche",
    "prospection.filters.city": "City",
    "prospection.filters.search": "Search...",
    "prospection.filters.showArchived": "Show archived leads",
    "prospection.table.name": "Name",
    "prospection.table.phone": "Phone",
    "prospection.table.city": "City",
    "prospection.table.niche": "Niche",
    "prospection.table.status": "Status",
    "prospection.table.rating": "Rating",
    "prospection.table.lastCalled": "Last called",
    "prospection.table.nextAction": "Next action",
    "prospection.table.actions": "Actions",
    "prospection.search.name": "Name",
    "prospection.search.niche": "Niche",
    "prospection.search.location": "Location",
    "prospection.search.scope": "Scope",
    "prospection.search.lastRun": "Last run",
    "prospection.task.title": "Title",
    "prospection.task.type": "Type",
    "prospection.task.company": "Company",
    "prospection.task.dueAt": "Due",
    "prospection.unauthorized.title": "Unauthorized",
    "prospection.unauthorized.description": "This section is reserved for the internal FalconDraft team.",
    "transcripts.empty.title": "No transcripts",
    "transcripts.empty.description":
      "Call transcripts will appear here. You can add one by pasting text.",
    "transcripts.new": "New transcript",
    "transcripts.count": "transcript",
    "transcripts.status.ready": "Ready",
    "transcripts.status.processing": "Transcribing",
    "transcripts.status.waiting": "Waiting for call",
    "transcripts.status.error": "Error",
    "transcripts.status.ready.hint":
      "The transcript is available and can be used for a deal.",
    "transcripts.status.processing.hint":
      "The call has ended and the transcript is being prepared.",
    "transcripts.status.waiting.hint":
      "FalconDraft is waiting for the meeting to start or the bot to finish recording.",
    "transcripts.status.error.hint":
      "Transcription failed. You can retry or create a new transcript.",
    "transcripts.source.paste": "Paste transcript",
    "transcripts.source.audio": "Import audio",
    "transcripts.source.recording": "Connect a tool",
    "transcripts.source.paste.description":
      "Paste an existing transcript to centralize it and link it to a deal.",
    "transcripts.source.audio.description":
      "Upload a recording for automatic transcription.",
    "transcripts.source.recording.description":
      "Connect a recording tool to receive transcripts directly.",
    "transcripts.soon": "Soon",
    "transcripts.deal": "Deal",
    "transcripts.by": "by",
    "transcripts.delete": "Delete",
    "transcripts.delete.title": "Delete this transcript?",
    "transcripts.delete.description":
      "The transcript will be permanently deleted. This action cannot be undone.",
    "transcripts.delete.confirm": "Delete",
    "transcripts.delete.deleting": "Deleting...",
    "transcripts.delete.success": "Transcript deleted.",
    "transcripts.delete.error": "Unable to delete.",
    "transcripts.cancel": "Cancel",
    "transcripts.detail.back": "Back",
    "transcripts.detail.source": "Source",
    "transcripts.detail.createdAt": "Created",
    "transcripts.detail.createdBy": "By",
    "transcripts.detail.duration": "Duration",
    "transcripts.detail.deal": "Deal",
    "transcripts.detail.language": "Language",
    "transcripts.detail.content": "Transcript content",
    "transcripts.detail.noContent": "No content available.",
    "transcripts.detail.participants": "Participants",
    "transcripts.form.guided": "Guided creation",
    "transcripts.form.title": "New transcript",
    "transcripts.form.step": "Step {current} of {total}",
    "transcripts.form.completed": "{percent}% complete",
    "transcripts.form.previous": "Previous",
    "transcripts.form.next": "Next",
    "transcripts.form.creating": "Creating...",
    "transcripts.form.create": "Create transcript",
    "transcripts.form.step1.title": "Identification",
    "transcripts.form.step1.description":
      "Give the transcript a clear title so you can find it easily.",
    "transcripts.form.step1.label": "Transcript title",
    "transcripts.form.step1.placeholder": "E.g. Discovery call — Company X",
    "transcripts.form.step1.help":
      "A concrete title to identify this exchange.",
    "transcripts.form.step2.title": "Content",
    "transcripts.form.step2.description":
      "Paste the full transcript of the call or meeting.",
    "transcripts.form.step2.label": "Transcript content",
    "transcripts.form.step2.placeholder":
      "Paste the call or meeting transcript here...",
    "transcripts.form.step2.help":
      "The more complete the content, the more relevant the analysis will be.",
    "transcripts.form.step3.title": "Linking",
    "transcripts.form.step3.description":
      "Associate this transcript with an existing deal if relevant.",
    "transcripts.form.step3.dealLabel": "Link to a deal (optional)",
    "transcripts.form.step3.noDeal": "No deal",
    "transcripts.form.step3.dealHelp":
      "The transcript will be linked to the selected deal to enrich outputs.",
    "transcripts.form.step3.noDealsTitle": "No deals available",
    "transcripts.form.step3.noDealsDescription":
      "The transcript will be created without linking. You can link it later.",
    "transcripts.form.step3.summary": "Summary",
    "transcripts.form.step3.summaryTitle": "Title:",
    "transcripts.form.step3.summaryLength": "Length:",
    "transcripts.form.success": "Transcript created.",
    "transcripts.edit": "Edit",
    "transcripts.edit.save": "Save",
    "transcripts.edit.saving": "Saving...",
    "transcripts.edit.cancel": "Cancel",
    "transcripts.edit.success": "Transcript updated.",
    "transcripts.edit.error": "Unable to update.",
    "transcripts.archive": "Archive",
    "transcripts.archive.success": "Transcript archived.",
    "transcripts.archive.error": "Unable to archive.",
    "transcripts.unarchive": "Unarchive",
    "transcripts.unarchive.success": "Transcript unarchived.",
    "transcripts.view": "View",
    "transcripts.recall.button": "Capture a call",
    "transcripts.recall.title": "Capture a call",
    "transcripts.recall.description":
      "Paste your Google Meet, Zoom or Teams meeting link to automatically capture the transcript.",
    "transcripts.recall.meetingUrl": "Meeting link",
    "transcripts.recall.meetingUrl.placeholder":
      "https://meet.google.com/abc-defg-hij",
    "transcripts.recall.meetingUrl.help":
      "Google Meet, Zoom or Microsoft Teams.",
    "transcripts.recall.titleLabel": "Transcript title",
    "transcripts.recall.titlePlaceholder": "E.g. Discovery call — Company X",
    "transcripts.recall.dealLabel": "Link to a deal (optional)",
    "transcripts.recall.noDeal": "No deal",
    "transcripts.recall.submit": "Start capture",
    "transcripts.recall.submitting": "Sending...",
    "transcripts.recall.success":
      "Capture started. The transcript will appear once the call ends.",
    "transcripts.recall.error": "Unable to start capture.",
    "transcripts.recall.invalidUrl": "Unsupported meeting URL.",
    "admin.restricted": "Restricted access",
    "admin.restrictedTitle": "Internal FalconDraft page",
    "admin.restrictedDescription":
      "This route is reserved for internal role verification and should not appear in the standard client workspace.",
    "admin.console": "Internal console",
    "admin.access": "Internal access",
    "admin.title": "FalconDraft supervision",
    "admin.description":
      "A console for the FalconDraft team to monitor organizations, users, and generation cycles.",
    "admin.empty": "No rows available.",
    "admin.deals": "Deals",
    "admin.failedRuns": "Failed generations",
    "nav.open": "Open navigation",
    "nav.sheetTitle": "FalconDraft navigation",
    "nav.sheetDescription": "Access the main client workspace sections.",
    "shell.workspaceTitle": "Sales production",
    "shell.workspaceFallback": "Deals, documents, and tracking",
    "shell.pipeline": "Deal → proposal → approval → send",
    "shell.footer": "FalconDraft · Sales proposals",
    "shell.userMenu": "User menu",
    "shell.profile": "Profile",
    "shell.help": "Help",
    "shell.helpTitle": "FalconDraft help",
    "shell.helpDescription": "Open the help and support center.",
    "shell.signOut": "Sign out",
    "shell.signOutSuccess": "Session closed",
    "shell.topbar.workspace": "Workspace",
    "shell.topbar.searchPlaceholder":
      "Search clients, proposals, documents…",
    "shell.topbar.notifications": "Notifications",
    "shell.topbar.create": "Create",
    "support.eyebrow": "Support",
    "support.title": "FalconDraft help & support",
    "support.description":
      "Find an answer quickly, report a bug, or suggest an improvement to the FalconDraft team.",
    "support.hero.badge": "Human support",
    "support.hero.kicker": "Help center",
    "support.hero.title": "Everything you need to use FalconDraft confidently.",
    "support.hero.description":
      "This page covers frequent questions about your workspace, deals, documents, approvals, and team management.",
    "support.guides.start.title": "Start a deal",
    "support.guides.start.description":
      "Create a deal, add sales context, and follow every step through to the final document.",
    "support.guides.team.title": "Team and roles",
    "support.guides.team.description":
      "Understand what each role can do and how to collaborate inside the workspace.",
    "support.guides.validation.title": "Review and send",
    "support.guides.validation.description":
      "Review proposals, prepare final documents, and keep a clear trace of every action.",
    "support.faq.title": "Frequently asked questions",
    "support.faq.description":
      "Essential answers for day-to-day use of the application.",
    "support.faq.invite.question": "How do I join a workspace?",
    "support.faq.invite.answer":
      "FalconDraft is invitation-only. Open the link received by email, create your password if needed, then sign in with the invited email address.",
    "support.faq.deal.question": "What is a deal for?",
    "support.faq.deal.answer":
      "A deal centralizes the client, sales context, budget, generation steps, and documents linked to an opportunity.",
    "support.faq.documents.question": "Where can I find my documents?",
    "support.faq.documents.answer":
      "Documents are available from the Documents tab and from each deal. Generated content and customer data are never translated when you change the interface language.",
    "support.faq.validation.question": "How does approval work?",
    "support.faq.validation.answer":
      "Approval steps show what is ready, what needs review, and what can be sent. Traces remain visible in each deal activity feed.",
    "support.faq.roles.question": "What can team roles do?",
    "support.faq.roles.answer":
      "Managers control team and workspace settings. Collaborators work on authorized deals. Viewers can review information without modifying sensitive items.",
    "support.faq.visibility.question": "How do visibility settings work?",
    "support.faq.visibility.answer":
      "Depending on your workspace settings, you may see company-wide views or only the deals and documents that are relevant to you.",
    "support.faq.language.question": "How do I change language?",
    "support.faq.language.answer":
      "Language is managed in Settings. French remains the default, and English translates only the application interface.",
    "support.faq.issue.question": "What should I do if I see an error?",
    "support.faq.issue.answer":
      "Note the action you took, the related deal, the displayed message, and the approximate time. Send those details to support to speed up diagnosis.",
    "support.contact.title": "Contact support",
    "support.contact.description":
      "Send a request to the FalconDraft team. The message is sent from the application, then you receive a confirmation email.",
    "support.contact.typeLabel": "Request type",
    "support.contact.type.question": "Usage question",
    "support.contact.type.bug": "Report a bug",
    "support.contact.type.feature": "Suggest a feature",
    "support.contact.subject.question": "Question about FalconDraft",
    "support.contact.subject.bug": "Bug to fix in FalconDraft",
    "support.contact.subject.feature": "FalconDraft feature suggestion",
    "support.contact.subjectLabel": "Subject",
    "support.contact.subjectPlaceholder": "E.g. Issue with a final document",
    "support.contact.messageLabel": "Message",
    "support.contact.messagePlaceholder":
      "Describe your question, the bug you observed, or the improvement you would like.",
    "support.contact.submit": "Send to support",
    "support.contact.sending": "Sending...",
    "support.contact.sent": "Message sent",
    "support.contact.sentDescription":
      "FalconDraft support received your request. A confirmation email has been sent to you.",
    "support.contact.sentNoConfirmation":
      "FalconDraft support received your request. The confirmation email could not be sent automatically.",
    "support.contact.error": "Could not send",
    "support.contact.errorDescription":
      "Your message could not be sent to support right now.",
    "support.contact.messageTooShort":
      "Add a few more details so support can understand your request.",
    "support.quick.bug.title": "Bug",
    "support.quick.bug.description":
      "Include reproduction steps, the browser, and the related deal.",
    "support.quick.idea.title": "Suggestion",
    "support.quick.idea.description":
      "Explain the expected outcome and the impact on your sales workflow.",
    "support.quick.question.title": "Question",
    "support.quick.question.description":
      "Ask for help with usage, a role, a step, or a workspace setting.",
    "dashboard.eyebrow": "Dashboard",
    "dashboard.title": "Sales tracking",
    "dashboard.description": "Here's where your deals stand.",
    "dashboard.stats.activeDeals": "In progress",
    "dashboard.stats.activeDealsDetail": "Excluding completed deals",
    "dashboard.stats.readyDocuments": "Ready to send",
    "dashboard.stats.readyDocumentsDetail": "To review or send",
    "dashboard.stats.pipelineValue": "Estimated value",
    "dashboard.stats.pipelineValueDetail": "Current pipeline",
    "dashboard.stats.attention": "Need attention",
    "dashboard.stats.attentionDetail": "Approval, document, or error",
    "dashboard.stats.signatureRate": "Signature rate",
    "dashboard.stats.signatureRateDetail": "Over the last 30 days",
    "dashboard.stats.pipelineOpen": "Open pipeline",
    "dashboard.stats.activeProposals": "Active proposals",
    "dashboard.stats.readyToSend": "Ready to send",
    "dashboard.pipeline.title": "Pipeline by stage",
    "dashboard.pipeline.viewAll": "View details",
    "dashboard.pipeline.total": "Total pipeline",
    "dashboard.pipeline.range.week": "7 d",
    "dashboard.pipeline.range.month": "30 d",
    "dashboard.pipeline.range.quarter": "Quarter",
    "dashboard.pipeline.stages.draft": "Draft",
    "dashboard.pipeline.stages.review": "In review",
    "dashboard.pipeline.stages.sent": "Sent",
    "dashboard.pipeline.stages.signed": "Signed",
    "dashboard.followUp.title": "Deals to follow",
    "dashboard.followUp.empty": "No deal needs your attention.",
    "dashboard.followUp.viewAll": "All deals",
    "dashboard.recentDeals.title": "Recent deals",
    "dashboard.recentDeals.description": "Priority items",
    "dashboard.featured.title": "Next deal",
    "dashboard.featured.description": "Track progress",
    "dashboard.featured.empty": "No priority deal right now.",
    "dashboard.chart.title": "Generation activity",
    "dashboard.chart.description":
      "Monthly volume of proposals and final documents.",
    "dashboard.activity.title": "Recent journal",
    "dashboard.activity.description": "Latest meaningful changes.",
    "table.deal": "Deal",
    "table.status": "Status",
    "table.budget": "Budget",
    "table.updated": "Updated",
    "deals.eyebrow": "Deals",
    "deals.title": "Your deals",
    "deals.description": "Find and manage all your proposals.",
    "deals.tabs.mine": "My deals",
    "deals.tabs.organization": "Company-wide",
    "deals.searchPlaceholder": "Search...",
    "deals.statusPlaceholder": "Filter by status",
    "deals.allStatuses": "All statuses",
    "deals.client": "Client",
    "deals.actions": "Actions",
    "deals.open": "Open",
    "deals.archive": "Archive",
    "deals.restore": "Restore",
    "deals.updating": "Updating...",
    "deals.delete": "Delete",
    "deals.deleting": "Deleting...",
    "deals.emptyFiltered": "No deal matches these filters.",
    "dealDetail.eyebrow": "Deal",
    "dealDetail.created": "Created",
    "dealDetail.updated": "Updated",
    "dealDetail.owner": "Owner",
    "dealDetail.clientCompany": "Client company",
    "dealDetail.organization": "Organization",
    "dealDetail.source": "Source",
    "dealDetail.contact": "Contact",
    "dealDetail.name": "Name",
    "dealDetail.phone": "Phone",
    "dealDetail.transcriptTitle": "Notes & transcript",
    "dealDetail.transcriptDescription": "Your working base for this deal.",
    "dealDetail.productionTitle": "Generated documents",
    "dealDetail.productionDescription": "All documents linked to this deal.",
    "dealDetail.callSummary": "Call summary",
    "dealDetail.proposal": "Proposal",
    "dealDetail.finalDocument": "Final document",
    "dealDetail.finalDocumentReady": "Final document ready to download.",
    "dealDetail.finalDocumentWaiting":
      "Final document ready to share once the proposal is approved.",
    "dealDetail.signature": "Signature",
    "dealDetail.signaturePrepared": "Signature link prepared",
    "dealDetail.generatedDocuments": "Generated documents",
    "dealDetail.generatedDocumentsDescription":
      "Files and links produced for this deal.",
    "dealDetail.emailDraft": "Ready to send",
    "dealDetail.instructions": "Instruction: {instructions}",
    "dealDetail.activity": "Activity log",
    "dealDetail.actions": "Actions",
    "dealDetail.actionsDescription": "Main commands for the proposal cycle.",
    "dealDetail.progress": "Progress",
    "dealDetail.lastUpdated": "Last updated",
    "dealDetail.extraSections":
      "{count} additional section(s) in the full view.",
    "dealDetail.summaryReady": "Call summary ready",
    "dealDetail.summaryReadyDescription":
      "The call summary is available in the deal.",
    "dealDetail.summaryDeleteConfirm":
      "Delete the call summary? You can edit the deal and generate it again afterwards.",
    "dealDetail.summaryDeleteFallback":
      "The call summary could not be deleted.",
    "dealDetail.summaryDeleted": "Call summary deleted",
    "dealDetail.summaryDeletedDescription":
      "You can edit the deal and run generation again.",
    "dealDetail.summaryGenerating": "Call summary generation in progress",
    "dealDetail.summaryWaiting": "Call summary pending",
    "dealDetail.summaryPolling":
      "The page will update automatically as soon as the call summary is available.",
    "dealDetail.summaryStart":
      "Start generation from the actions panel to prepare this section.",
    "dealDetail.summaryStructured": "Structured call summary",
    "dealDetail.summaryStructuredDescription":
      "A synthetic read of the key points extracted from the deal.",
    "dealDetail.summaryFull": "Full call summary",
    "dealDetail.summaryFullDescription":
      "Complete structured version of the sales call summary.",
    "dealDetail.proposalReady": "Proposal ready",
    "dealDetail.proposalReadyDescription":
      "The proposal is available in the deal.",
    "dealDetail.proposalDeleteConfirm":
      "Delete the proposal? You can edit the deal and generate it again afterwards.",
    "dealDetail.proposalDeleteFallback": "The proposal could not be deleted.",
    "dealDetail.proposalDeleted": "Proposal deleted",
    "dealDetail.proposalDeletedDescription":
      "You can edit the deal and run generation again.",
    "dealDetail.proposalGenerating": "Proposal generation in progress",
    "dealDetail.proposalWaiting": "Proposal pending",
    "dealDetail.proposalPolling":
      "The page will update automatically as soon as the proposal is available.",
    "dealDetail.proposalStart":
      "Start generation from the actions panel to prepare this section.",
    "dealDetail.editLink": "Editing link",
    "dealDetail.editLinkDescription":
      "Access to the external workspace to adjust the proposal.",
    "dealDetail.edit": "Edit",
    "dealDetail.editUnavailable": "Editing unavailable",
    "dealDetail.proposalContent": "Proposal content",
    "dealDetail.openContent": "Open content",
    "dealDetail.proposalFullDescription":
      "Complete structured version of the sales proposal.",
    "dealDetail.deleteImpossible": "Deletion failed",
    "dealDetail.newEyebrow": "New deal",
    "dealDetail.newTitle": "Create a deal",
    "dealDetail.newDescription":
      "Move step by step through framing, contact, call notes, and output instructions.",
    "integrations.description":
      "Connect your email account to prepare sending drafts from your own mailbox.",
    "integrations.gmail.personal": "Personal or work Google account",
    "integrations.gmail.connected": "Connected",
    "integrations.gmail.disconnected": "Not connected",
    "integrations.gmail.connectedToast": "Gmail is connected to FalconDraft.",
    "integrations.gmail.denied": "Gmail connection cancelled.",
    "integrations.gmail.refused":
      "Gmail connection refused for this workspace.",
    "integrations.gmail.unavailable": "Gmail configuration unavailable.",
    "integrations.gmail.error":
      "Gmail connection failed. Try again from settings.",
    "integrations.gmail.disconnectError": "Could not disconnect.",
    "integrations.gmail.disconnectedToast": "Gmail is disconnected.",
    "integrations.gmail.body1":
      "FalconDraft only creates drafts in your Gmail. No email is sent automatically.",
    "integrations.gmail.body2":
      "You stay in control: review, edit, then send from Gmail when ready.",
    "integrations.gmail.connectedAccount": "Connected account",
    "integrations.gmail.disconnecting": "Disconnecting…",
    "integrations.gmail.disconnect": "Disconnect",
    "integrations.gmail.connect": "Connect Gmail",
    "integrations.microsoft.subtitle":
      "Personal or professional Microsoft account",
    "integrations.microsoft.comingSoon": "Soon",
    "integrations.microsoft.body1":
      "Connect your Outlook or Microsoft 365 account to prepare your commercial drafts directly from FalconDraft.",
    "integrations.microsoft.body2":
      "FalconDraft only prepares drafts. You keep full control over sending.",
    "integrations.microsoft.cta": "Connect Outlook",
    "integrations.microsoft.connect": "Connect Outlook",
    "integrations.microsoft.disconnect": "Disconnect",
    "integrations.microsoft.disconnecting": "Disconnecting...",
    "integrations.microsoft.connected": "Connected",
    "integrations.microsoft.disconnected": "Not connected",
    "integrations.microsoft.connectedAccount": "Connected account",
    "integrations.microsoft.connectedToast":
      "Outlook is connected to FalconDraft.",
    "integrations.microsoft.disconnectedToast": "Outlook disconnected.",
    "integrations.microsoft.disconnectError": "Disconnect failed.",
    "integrations.microsoft.denied": "Outlook connection cancelled.",
    "integrations.microsoft.refused":
      "Outlook connection refused for this workspace.",
    "integrations.microsoft.unavailable": "Outlook configuration unavailable.",
    "integrations.microsoft.error":
      "An error occurred during Outlook connection. Please try again.",
    "billing.current": "Current subscription",
    "billing.details":
      "{price} · Status {status} · Next due date: {nextInvoice}",
    "billing.statusDetail": "Status {status}",
    "billing.nextInvoiceDetail": "Next due date: {nextInvoice}",
    "billing.manage": "Manage subscription",
    "billing.emptyInvoices": "No invoice history available.",
    "billing.notesTitle": "Billing notes",
    "billing.notesDescription":
      "Subscription information, due dates, and invoices are grouped here to make admin follow-up easier.",
    "documents.eyebrow": "Documents",
    "documents.title": "Generated documents",
    "documents.description":
      "Proposals, quotes, final documents, and signature links attached to deals.",
    "documents.libraryTitle": "Work library",
    "documents.libraryMine": "Latest assets prepared for your deals.",
    "documents.libraryOrganization":
      "Latest assets prepared for all active deals.",
    "documents.tabs.mine": "My documents",
    "documents.tabs.organization": "Company-wide",
    "documents.dealLabel": "Deal",
    "archives.eyebrow": "Archive",
    "archives.title": "Archived deals",
    "archives.description":
      "Deals removed from the sales pipeline and kept for review or restoration.",
    "settings.eyebrow": "Settings",
    "settings.title": "Settings",
    "settings.description": "Customize your FalconDraft workspace.",
    "settings.nav.general": "General",
    "settings.nav.team": "Team",
    "settings.nav.integrations": "Integrations",
    "settings.nav.billing": "Billing",
    "settings.profile.title": "Profile",
    "settings.profile.description":
      "Photo and identity shown in your client workspace.",
    "settings.photo.choose": "Choose a photo",
    "settings.photo.remove": "Remove",
    "settings.photo.dialogTitle": "Profile photo",
    "settings.photo.dialogDescription":
      "Choose a professional photo, clear and centered on your face.",
    "settings.photo.formats": "Accepted formats",
    "settings.photo.formatsDetail": "PNG, JPG or WebP. Maximum size: 2 MB.",
    "settings.photo.select": "Select an image",
    "settings.photo.saving": "Saving...",
    "settings.photo.updating": "Updating...",
    "settings.photo.errorTitle": "Photo not saved",
    "settings.photo.errorDescription": "The photo could not be saved.",
    "settings.photo.errorSize": "The photo must be under 2 MB.",
    "settings.photo.errorSizeTitle": "Image too large",
    "settings.photo.errorFormat": "Please choose a PNG, JPG or WebP image.",
    "settings.photo.errorFormatTitle": "Unsupported format",
    "settings.photo.successUpdated": "Profile photo updated.",
    "settings.photo.successRemoved": "Profile photo removed.",
    "settings.photo.removeErrorTitle": "Photo not removed",
    "settings.photo.removeErrorDescription": "The photo could not be removed.",
    "settings.preferences.title": "Preferences",
    "settings.preferences.description":
      "Customize your FalconDraft workspace.",
    "settings.organizationName": "Workspace name",
    "settings.defaultLanguage": "Interface language",
    "settings.defaultLanguagePlaceholder": "Select a language",
    "settings.appearance": "Display mode",
    "settings.appearancePlaceholder": "Choose a theme",
    "settings.appearance.light": "Light",
    "settings.appearance.dark": "Dark",
    "settings.appearance.system": "System",
    "settings.askCloseDate": "Ask for target close date",
    "settings.askCloseDateDescription":
      "Adds an optional field when creating or editing a deal.",
    "settings.saved": "Settings saved.",
    "visibility.title": "Access & permissions",
    "visibility.description":
      "Control collaborator access to company-wide deal and document views.",
    "visibility.option": "Allow “Company-wide” views",
    "visibility.optionDescription":
      "When this option is disabled, collaborators no longer see the company tab and can only access their own deals and documents. Managers keep the global view.",
    "visibility.saveError": "Update failed.",
    "visibility.notSaved": "Preference not saved",
    "visibility.saved": "Visibility updated",
    "visibility.savedOpen": "Collaborators can open company-wide views.",
    "visibility.savedRestricted":
      "Collaborators only see their own deals and documents.",
    "team.title": "Collaborators",
    "team.description": "Active members, roles, and workspace access.",
    "team.columns.name": "Name",
    "team.columns.email": "Email",
    "team.columns.role": "Role",
    "team.columns.status": "Status",
    "team.columns.lastActive": "Last active",
    "team.columns.actions": "Actions",
    "team.you": "You",
    "team.remove": "Remove from workspace",
    "team.removing": "Removing...",
    "team.confirmRemove":
      "Remove {name} from the workspace? Their access will be disabled.",
    "team.errorRemove": "Removal failed.",
    "team.kept": "Member kept",
    "team.removed": "Member removed",
    "team.removedDescription": "{name} no longer has workspace access.",
    "team.roleUpdateSuccess": "Role updated",
    "team.roleUpdateError": "Role not updated",
    "team.emptyTitle": "No members",
    "team.emptyDescription":
      "Members attached to this client workspace will appear here.",
    "team.invite.title": "Invite a collaborator",
    "team.invite.description":
      "A private link is sent by email. Public account creation remains closed.",
    "team.invite.email": "Work email",
    "team.invite.role": "Role",
    "team.invite.placeholder": "collaborator@company.com",
    "team.invite.submit": "Send invitation",
    "team.invite.submitting": "Sending...",
    "team.invite.sent": "Invitation sent",
    "team.invite.sentDescription": "{email} received their FalconDraft link.",
    "team.invite.error": "Invitation not sent",
    "team.invitations.title": "Pending invitations",
    "team.invitations.description":
      "Active links that have not been accepted yet.",
    "team.invitations.expires": "Expires",
    "team.invitations.action": "Action",
    "team.invitations.revoke": "Revoke",
    "team.invitations.revoking": "Revoking...",
    "team.invitations.revoked": "Invitation revoked",
    "team.invitations.emptyTitle": "No pending invitations",
    "team.invitations.emptyDescription":
      "Sent invitations that have not been accepted will appear here.",
    "team.status.active": "Active",
    "team.status.invited": "Invitation sent",
    "roles.manager": "Manager",
    "roles.member": "Collaborator",
    "roles.viewer": "Viewer",
    "dealStatus.draft": "Draft",
    "dealStatus.call_summary_ready": "Call summary ready",
    "dealStatus.proposal_generating": "Proposal in progress",
    "dealStatus.proposal_ready": "Proposal ready",
    "dealStatus.validation_pending": "Awaiting approval",
    "dealStatus.final_document_generating": "Final document in progress",
    "dealStatus.final_document_ready": "Final document ready",
    "dealStatus.signature_ready": "Signature ready",
    "dealStatus.email_draft_ready": "Email ready",
    "dealStatus.completed": "Completed",
    "dealStatus.failed": "Error",
    "documentType.proposal": "Proposal",
    "documentType.proposal_gamma": "Editable proposal",
    "documentType.proposal_pdf": "Proposal PDF",
    "documentType.proposal_pdf_initial": "Proposal PDF",
    "documentType.quote": "Quote",
    "documentType.quote_pdf": "Quote PDF",
    "documentType.final_document": "Final document",
    "documentType.final_document_pdf": "Final document ready for signature",
    "documentType.signature_link": "Signature link",
    "workflow.opportunity.label": "Deal",
    "workflow.opportunity.description": "Client brief",
    "workflow.summary.label": "Call summary",
    "workflow.summary.description": "Call notes synthesis",
    "workflow.proposal.label": "Proposal",
    "workflow.proposal.description": "Document ready to send",
    "workflow.validation.label": "Approval",
    "workflow.validation.description": "Internal review",
    "workflow.final_document.label": "Final document",
    "workflow.final_document.description": "Finalized PDF",
    "workflow.signature.label": "Signature",
    "workflow.signature.description": "Signature link",
    "workflow.email.label": "Send email",
    "workflow.email.description": "Customizable draft",
    "activity.workflow.failed": "Generation failed",
    "activity.workflow.completed": "Generation completed",
    "activity.workflow.running": "Generation in progress",
    "activity.workflow.description": "{type} workflow · {status}",
    "activity.audit.invitation_created": "Invitation sent",
    "activity.audit.invitation_accepted": "Invitation accepted",
    "activity.audit.invitation_revoked": "Invitation revoked",
    "activity.audit.member_deactivated": "Collaborator removed",
    "activity.audit.organization_member_role_updated":
      "Collaborator role updated",
    "activity.audit.organization_visibility_updated":
      "Workspace visibility updated",
    "activity.audit.email_provider_connected": "Email provider connected",
    "activity.audit.email_provider_disconnected": "Email provider disconnected",
    "activity.audit.email_draft_workflow_started":
      "Gmail draft creation started",
    "activity.audit.organization_created": "Client workspace created",
    "activity.audit.workflow_config_created": "Workflow configuration created",
    "activity.audit.workflow_config_updated": "Workflow configuration updated",
    "activity.audit.first_manager_invited": "First manager invited",
    "activity.audit.deal_updated": "Deal updated",
    "activity.audit.proposal_deleted": "Proposal deleted",
    "activity.audit.summary_deleted": "Call summary deleted",
    "activity.audit.deal_archived": "Deal archived",
    "activity.audit.deal_restored": "Deal restored",
    "activity.audit.generic": "Change recorded",
    "activity.actor.team": "Team",
    "activity.actor.system": "FalconDraft",
  },
  es: {
    "common.actions.createDeal": "Crear un expediente comercial",
    "common.actions.newDeal": "+ Nuevo expediente",
    "common.actions.viewAll": "Ver todo",
    "common.actions.save": "Guardar",
    "common.actions.saving": "Guardando...",
    "common.actions.cancel": "Cancelar",
    "common.actions.open": "Abrir",
    "common.actions.download": "Descargar",
    "common.actions.downloadQuote": "Descargar presupuesto",
    "common.actions.downloadFinalDocument": "Descargar documento final",
    "common.actions.editInstructions": "Editar instrucciones",
    "common.empty.deals.title": "Ningún expediente comercial",
    "common.empty.deals.description":
      "Crea un primer expediente comercial para seguir el pipeline y los documentos asociados.",
    "common.empty.documents.title": "Ningún documento",
    "common.empty.documents.description":
      "Los documentos aparecerán aquí en cuanto estén preparados para un expediente comercial.",
    "common.empty.archives.title": "Ningún expediente archivado",
    "common.empty.archives.description":
      "Los expedientes archivados aparecerán aquí sin entrar en el pipeline comercial.",
    "common.empty.activity":
      "No hay actividad reciente para este expediente comercial.",
    "common.status.done": "Hecho",
    "common.status.active": "Activo",
    "common.status.failed": "A revisar",
    "common.status.pending": "Pendiente",
    "common.status.ready": "Listo",
    "common.status.draft": "Borrador",
    "common.status.generating": "En curso",
    "common.status.sent": "Enviado",
    "language.label": "Idioma",
    "language.fr": "Français",
    "language.en": "English",
    "language.es": "Español",
    "auth.login.eyebrow": "Espacio de trabajo del cliente",
    "auth.login.title": "Iniciar sesión en FalconDraft",
    "auth.login.cardTitle": "Acceso seguro",
    "auth.login.cardDescription":
      "Inicia sesión con la dirección de email vinculada a tu invitación.",
    "auth.login.email": "email de trabajo",
    "auth.login.password": "Contraseña",
    "auth.login.forgotPassword": "¿Has olvidado tu contraseña?",
    "auth.login.submit": "Iniciar sesión",
    "auth.login.submitting": "Iniciando sesión...",
    "auth.login.unavailable": "Iniciar sesión no disponible",
    "auth.login.unavailableDescription":
      "La configuración de acceso no está disponible.",
    "auth.login.refused": "Inicio de sesión rechazado",
    "auth.login.refusedDescription": "Revisa tu email y contraseña.",
    "auth.login.success": "Iniciado sesión",
    "auth.login.successDescription":
      "Abriendo su espacio de trabajo FalconDraft.",
    "auth.forgot.eyebrow": "Has olvidado tu contraseña",
    "auth.forgot.title": "Obtenga un enlace seguro",
    "auth.forgot.cardTitle": "Restablecer contraseña",
    "auth.forgot.cardDescription":
      "Introduce la dirección de email vinculada a tu cuenta FalconDraft.",
    "auth.forgot.footer": "El enlace es válido por tiempo limitado.",
    "auth.forgot.unavailable": "Restablecimiento de contraseña no disponible",
    "auth.forgot.error": "Solicitud fallida",
    "auth.forgot.errorDescription":
      "La solicitud de restablecimiento no se ha podido enviar por ahora.",
    "auth.forgot.sent": "Email enviado",
    "auth.forgot.sentDescription":
      "Si existe una cuenta para este email, se ha enviado un enlace de restablecimiento.",
    "auth.forgot.submit": "Enviar enlace de restablecimiento",
    "auth.forgot.submitting": "Envío...",
    "auth.forgot.back": "Volver para iniciar sesión",
    "auth.update.eyebrow": "Nueva contraseña",
    "auth.update.title": "Asegure su acceso",
    "auth.update.cardTitle": "Establecer una nueva contraseña",
    "auth.update.cardDescription":
      "Elige una contraseña segura para tu cuenta.",
    "auth.update.footer": "Sesión de restablecimiento segura.",
    "auth.update.password": "Nueva contraseña",
    "auth.update.confirmPassword": "Confirmar Contraseña",
    "auth.update.tooShort": "Contraseña demasiado corta",
    "auth.update.tooShortDescription": "Usa al menos 8 caracteres.",
    "auth.update.mismatch": "Las contraseñas no coinciden",
    "auth.update.mismatchDescription": "Ambas contraseñas deben ser idénticas.",
    "auth.update.unavailable": "Actualización no disponible",
    "auth.update.invalid": "Enlace no válido o caducado",
    "auth.update.invalidDescription":
      "Solicita un nuevo enlace de restablecimiento.",
    "auth.update.error": "La actualización falló",
    "auth.update.errorDescription":
      "Es posible que el enlace haya caducado. Solicite uno nuevo.",
    "auth.update.success": "Contraseña actualizada",
    "auth.update.successDescription":
      "Ahora puede acceder a su espacio de trabajo FalconDraft.",
    "auth.update.submit": "Guardar contraseña",
    "auth.update.submitting": "Actualizando...",
    "auth.update.invalidPanel":
      "El enlace de restablecimiento no es válido o ha caducado. Solicita un nuevo enlace para definir tu contraseña.",
    "auth.update.newLink": "Solicitar un nuevo enlace",
    "auth.shell.clientWorkspace": "Espacio de trabajo del cliente",
    "auth.shell.privateAccess": "Acceso privado",
    "auth.shell.privateTitle":
      "Inicia sesión en tu espacio de trabajo FalconDraft.",
    "auth.shell.privateDescription":
      "Acceso seguro para realizar un seguimiento de expedientes, documentos y aprobaciones en el espacio de trabajo de su cliente.",
    "auth.shell.home": "Hogar",
    "auth.shell.invitedOnly": "Acceso reservado para usuarios invitados.",
    "invite.invalid.expired.title": "Invitación caducada",
    "invite.invalid.expired.description":
      "Este enlace ya no está activo. Pídale a un administrador del espacio de trabajo que le envíe una nueva invitación.",
    "invite.invalid.revoked.title": "Invitación revocada",
    "invite.invalid.revoked.description":
      "Esta invitación ha sido cancelada. Comuníquese con su contacto de FalconDraft si esto parece incorrecto.",
    "invite.invalid.accepted.title": "Invitación ya aceptada",
    "invite.invalid.accepted.description":
      "Este enlace ya ha sido utilizado. Inicia sesión con la cuenta asociada para acceder a tu espacio de trabajo.",
    "invite.invalid.default.title": "Invitación no válida",
    "invite.invalid.default.description":
      "Este enlace de invitación falta o está incompleto. Consulta el email que recibiste o solicita una nueva invitación.",
    "invite.goLogin": "Ir a iniciar sesión",
    "invite.guestSpace": "Espacio de trabajo para invitados",
    "invite.invitedEmail": "Email invitado",
    "invite.role": "Role",
    "invite.actionImpossible": "Acción no disponible",
    "invite.acceptFallback": "Esta invitación no pudo ser aceptada.",
    "invite.acceptError": "Invitación no aceptada",
    "invite.accepted": "Invitación aceptada",
    "invite.acceptedDescription":
      "Su acceso al espacio de trabajo de FalconDraft está listo.",
    "invite.createFallback":
      "Error al crear la cuenta. Inicia sesión si tu cuenta ya existe.",
    "invite.accountNotCreated": "Cuenta no creada",
    "invite.signInUnavailable":
      "Inicio de sesión no disponible. La configuración de acceso no está lista.",
    "invite.createdSignIn":
      "Cuenta creada. Inicia sesión con tu email y contraseña para aceptar la invitación.",
    "invite.fullName": "nombre completo",
    "invite.fullNamePlaceholder": "Su nombre",
    "invite.password": "Contraseña",
    "invite.preparing": "Preparando acceso...",
    "invite.createAndJoin": "Crear mi cuenta y unirme",
    "invite.existingAccount": "¿Ya tienes una cuenta FalconDraft?",
    "invite.loginToAccept": "Inicia sesión para aceptar la invitación.",
    "invite.accountRecognized": "Cuenta reconocida",
    "invite.accountRecognizedDescription":
      "Has iniciado sesión como {email}. Ahora puedes unirte a {organization}.",
    "invite.accept": "Aceptar invitación",
    "invite.accepting": "Aceptando...",
    "invite.emailDifferent": "email diferente",
    "invite.emailDifferentDescription":
      "Esta invitación es para {invitedEmail}. Has iniciado sesión como {currentEmail}. Cierra sesión para usar la cuenta correcta.",
    "invite.switching": "Cerrando sesión...",
    "invite.switchAccount": "Cambiar de cuenta",
    "nav.primaryLabel": "Navegación primaria",
    "nav.dashboard": "Panel",
    "nav.deals": "Expedientes",
    "nav.documents": "Documentos",
    "nav.transcripts": "Transcripciones",
    "nav.archives": "Archivos",
    "nav.settings": "Ajustes",
    "nav.support": "Soporte",
    "nav.internal": "Interno",
    "nav.internalAdmin": "Administrador interno",
    "nav.internalBadge": "Interno",
    "nav.prospection": "Prospección",
    "nav.quotes": "Presupuestos",
    "nav.clients": "Clientes",
    "nav.coach": "Coach IA",
    "nav.workflows": "Flujos",
    "nav.comingSoon": "Próximamente",
    "common.comingSoon.title": "Funcionalidad próximamente",
    "common.comingSoon.description":
      "Esta sección estará disponible en una próxima actualización. Recibirá un aviso en cuanto se active en su espacio.",
    "common.comingSoon.badge": "Próximamente",
    "prospection.title": "Prospección",
    "prospection.subtitle": "Gestión interna de leads FalconDraft",
    "prospection.eyebrow": "Interno",
    "prospection.leads": "Leads",
    "prospection.searches": "Búsquedas",
    "prospection.tasks": "Tareas",
    "prospection.status.new": "Nuevo",
    "prospection.status.toCall": "Por llamar",
    "prospection.status.called": "Llamado",
    "prospection.status.toFollowUp": "Por relanzar",
    "prospection.status.interested": "Interesado",
    "prospection.status.meetingBooked": "Cita agendada",
    "prospection.status.notInterested": "No interesado",
    "prospection.status.badFit": "Mal ajuste",
    "prospection.status.doNotContact": "No contactar",
    "prospection.status.client": "Cliente",
    "prospection.status.archived": "Archivado",
    "prospection.empty.leads": "Ningún lead encontrado",
    "prospection.empty.searches": "Ninguna búsqueda configurada",
    "prospection.empty.tasks": "Ninguna tarea pendiente",
    "prospection.actions.changeStatus": "Cambiar estado",
    "prospection.actions.markCalled": "Marcar como llamado",
    "prospection.actions.archive": "Archivar",
    "prospection.actions.openWebsite": "Abrir sitio web",
    "prospection.actions.markDone": "Marcar como hecho",
    "prospection.actions.addNote": "Añadir nota",
    "prospection.actions.launchSearch": "Lanzar búsqueda",
    "prospection.actions.launchSearchSoon": "Próximamente",
    "prospection.filters.status": "Estado",
    "prospection.filters.niche": "Nicho",
    "prospection.filters.city": "Ciudad",
    "prospection.filters.search": "Buscar...",
    "prospection.filters.showArchived": "Mostrar leads archivados",
    "prospection.table.name": "Nombre",
    "prospection.table.phone": "Teléfono",
    "prospection.table.city": "Ciudad",
    "prospection.table.niche": "Nicho",
    "prospection.table.status": "Estado",
    "prospection.table.rating": "Nota",
    "prospection.table.lastCalled": "Última llamada",
    "prospection.table.nextAction": "Próxima acción",
    "prospection.table.actions": "Acciones",
    "prospection.search.name": "Nombre",
    "prospection.search.niche": "Nicho",
    "prospection.search.location": "Ubicación",
    "prospection.search.scope": "Alcance",
    "prospection.search.lastRun": "Última ejecución",
    "prospection.task.title": "Título",
    "prospection.task.type": "Tipo",
    "prospection.task.company": "Empresa",
    "prospection.task.dueAt": "Vencimiento",
    "prospection.unauthorized.title": "Acceso no autorizado",
    "prospection.unauthorized.description": "Esta sección está reservada para el equipo interno de FalconDraft.",
    "transcripts.empty.title": "Sin transcripciones",
    "transcripts.empty.description":
      "Las transcripciones de las llamadas aparecerán aquí. Puedes agregar uno pegando texto.",
    "transcripts.new": "Nueva transcripción",
    "transcripts.count": "transcripción",
    "transcripts.status.ready": "Listo",
    "transcripts.status.processing": "Transcribiendo",
    "transcripts.status.waiting": "esperando llamada",
    "transcripts.status.error": "Error",
    "transcripts.status.ready.hint":
      "La transcripción está disponible y se puede utilizar para cerrar un expediente.",
    "transcripts.status.processing.hint":
      "La llamada ha finalizado y se está preparando la transcripción.",
    "transcripts.status.waiting.hint":
      "FalconDraft está esperando a que comience la reunión o que el bot termine de grabar.",
    "transcripts.status.error.hint":
      "La transcripción falló. Puede volver a intentarlo o crear una nueva transcripción.",
    "transcripts.source.paste": "Pegar transcripción",
    "transcripts.source.audio": "Importar audio",
    "transcripts.source.recording": "Conectar herramienta",
    "transcripts.source.paste.description":
      "Pegue una transcripción existente para centralizarla y vincularla a un expediente.",
    "transcripts.source.audio.description":
      "Sube una grabación para su transcripción automática.",
    "transcripts.source.recording.description":
      "Conecte una herramienta de grabación para recibir transcripciones directamente.",
    "transcripts.soon": "Pronto",
    "transcripts.deal": "Expediente",
    "transcripts.by": "por",
    "transcripts.delete": "Borrar",
    "transcripts.delete.title": "¿Eliminar esta transcripción?",
    "transcripts.delete.description":
      "La transcripción se eliminará permanentemente. Esta acción no se puede deshacer.",
    "transcripts.delete.confirm": "Borrar",
    "transcripts.delete.deleting": "Eliminando...",
    "transcripts.delete.success": "Transcripción eliminada.",
    "transcripts.delete.error": "No se puede eliminar.",
    "transcripts.cancel": "Cancelar",
    "transcripts.detail.back": "Atrás",
    "transcripts.detail.source": "Fuente",
    "transcripts.detail.createdAt": "Creado",
    "transcripts.detail.createdBy": "Por",
    "transcripts.detail.duration": "Duración",
    "transcripts.detail.deal": "Expediente",
    "transcripts.detail.language": "Idioma",
    "transcripts.detail.content": "Contenido de la transcripción",
    "transcripts.detail.noContent": "No hay contenido disponible.",
    "transcripts.detail.participants": "Participantes",
    "transcripts.form.guided": "Creación guiada",
    "transcripts.form.title": "Nueva transcripción",
    "transcripts.form.step": "Paso {current} de {total}",
    "transcripts.form.completed": "{percent}% completo",
    "transcripts.form.previous": "Anterior",
    "transcripts.form.next": "Próximo",
    "transcripts.form.creating": "Creando...",
    "transcripts.form.create": "Crear transcripción",
    "transcripts.form.step1.title": "Identificación",
    "transcripts.form.step1.description":
      "Asigne un título claro a la transcripción para que pueda encontrarla fácilmente.",
    "transcripts.form.step1.label": "Título de la transcripción",
    "transcripts.form.step1.placeholder":
      "P.ej. Llamada de descubrimiento: Empresa X",
    "transcripts.form.step1.help":
      "Un título concreto para identificar este intercambio.",
    "transcripts.form.step2.title": "Contenido",
    "transcripts.form.step2.description":
      "Pegue la transcripción completa de la llamada o reunión.",
    "transcripts.form.step2.label": "Contenido de la transcripción",
    "transcripts.form.step2.placeholder":
      "Pegue aquí la transcripción de la llamada o reunión...",
    "transcripts.form.step2.help":
      "Cuanto más completo sea el contenido, más relevante será el análisis.",
    "transcripts.form.step3.title": "Enlace",
    "transcripts.form.step3.description":
      "Asocie esta transcripción con un expediente existente si es relevante.",
    "transcripts.form.step3.dealLabel":
      "Enlace a una propuesta comercial (opcional)",
    "transcripts.form.step3.noDeal": "No hay expediente",
    "transcripts.form.step3.dealHelp":
      "La transcripción se vinculará al expediente seleccionado para enriquecer los resultados.",
    "transcripts.form.step3.noDealsTitle":
      "No hay propuesta comercials disponibles",
    "transcripts.form.step3.noDealsDescription":
      "La transcripción se creará sin vinculación. Puedes vincularlo más tarde.",
    "transcripts.form.step3.summary": "Resumen",
    "transcripts.form.step3.summaryTitle": "Título:",
    "transcripts.form.step3.summaryLength": "Longitud:",
    "transcripts.form.success": "Transcripción creada.",
    "transcripts.edit": "Editar",
    "transcripts.edit.save": "Guardar",
    "transcripts.edit.saving": "Guardando...",
    "transcripts.edit.cancel": "Cancelar",
    "transcripts.edit.success": "Transcripción actualizada.",
    "transcripts.edit.error": "No se puede actualizar.",
    "transcripts.archive": "Archivo",
    "transcripts.archive.success": "Transcripción archivada.",
    "transcripts.archive.error": "No se puede archivar.",
    "transcripts.unarchive": "Desarchivar",
    "transcripts.unarchive.success": "Transcripción desarchivada.",
    "transcripts.view": "Vista",
    "transcripts.recall.button": "Capturar una llamada",
    "transcripts.recall.title": "Capturar una llamada",
    "transcripts.recall.description":
      "Pegue el enlace de su reunión de Google Meet, Zoom o Teams para capturar automáticamente la transcripción.",
    "transcripts.recall.meetingUrl": "Enlace de reunión",
    "transcripts.recall.meetingUrl.placeholder":
      "https://meet.google.com/abc-defg-hij",
    "transcripts.recall.meetingUrl.help":
      "Google Meet, Zoom o Microsoft Teams.",
    "transcripts.recall.titleLabel": "Título de la transcripción",
    "transcripts.recall.titlePlaceholder":
      "P.ej. Llamada de descubrimiento: Empresa X",
    "transcripts.recall.dealLabel":
      "Enlace a una propuesta comercial (opcional)",
    "transcripts.recall.noDeal": "No hay expediente",
    "transcripts.recall.submit": "Iniciar captura",
    "transcripts.recall.submitting": "Envío...",
    "transcripts.recall.success":
      "Se inició la captura. La transcripción aparecerá una vez finalizada la llamada.",
    "transcripts.recall.error": "No se puede iniciar la captura.",
    "transcripts.recall.invalidUrl": "URL de reunión no admitida.",
    "admin.restricted": "Acceso restringido",
    "admin.restrictedTitle": "Página interna de FalconDraft",
    "admin.restrictedDescription":
      "Esta ruta está reservada para la verificación de roles internos y no debe aparecer en el espacio de trabajo estándar del cliente.",
    "admin.console": "Consola interna",
    "admin.access": "Acceso interno",
    "admin.title": "FalconSupervisión del borrador",
    "admin.description":
      "Una consola para que el equipo de FalconDraft monitoree organizaciones, usuarios y ciclos de generación.",
    "admin.empty": "No hay filas disponibles.",
    "admin.deals": "Propuesta comercials",
    "admin.failedRuns": "Generaciones fallidas",
    "nav.open": "Abrir navegación",
    "nav.sheetTitle": "Navegación en borrador Falcon",
    "nav.sheetDescription":
      "Accede a las principales secciones del espacio de trabajo del cliente.",
    "shell.workspaceTitle": "Producción de ventas",
    "shell.workspaceFallback": "Propuesta comercials, documentos y seguimiento",
    "shell.pipeline": "Propuesta comercial → propuesta → aprobación → enviar",
    "shell.footer": "FalconDraft · Propuestas de venta",
    "shell.userMenu": "Menú de usuario",
    "shell.profile": "Perfil",
    "shell.help": "Ayuda",
    "shell.helpTitle": "Ayuda FalconDraft",
    "shell.helpDescription": "Abra el centro de ayuda y soporte.",
    "shell.signOut": "desconectar",
    "shell.signOutSuccess": "Sesión cerrada",
    "shell.topbar.workspace": "Espacio",
    "shell.topbar.searchPlaceholder":
      "Buscar un cliente, propuesta, documento…",
    "shell.topbar.notifications": "Notificaciones",
    "shell.topbar.create": "Crear",
    "support.eyebrow": "Apoyo",
    "support.title": "Ayuda y soporte técnico de FalconDraft",
    "support.description":
      "Encuentre una respuesta rápidamente, informe un error o sugiera una mejora al equipo de FalconDraft.",
    "support.hero.badge": "Apoyo humano",
    "support.hero.kicker": "Centro de ayuda",
    "support.hero.title":
      "Todo lo que necesitas para utilizar FalconDraft con confianza.",
    "support.hero.description":
      "Esta página cubre preguntas frecuentes sobre su espacio de trabajo, expedientes, documentos, aprobaciones y gestión de equipos.",
    "support.guides.start.title": "iniciar un expediente",
    "support.guides.start.description":
      "Cree un expediente, agregue contexto de ventas y siga cada paso hasta el documento final.",
    "support.guides.team.title": "Equipo y roles",
    "support.guides.team.description":
      "Comprenda qué puede hacer cada rol y cómo colaborar dentro del espacio de trabajo.",
    "support.guides.validation.title": "Revisar y enviar",
    "support.guides.validation.description":
      "Revisar propuestas, preparar documentos finales y llevar un seguimiento claro de cada acción.",
    "support.faq.title": "Preguntas frecuentes",
    "support.faq.description":
      "Respuestas esenciales para el uso diario de la aplicación.",
    "support.faq.invite.question": "¿Cómo me uno a un espacio de trabajo?",
    "support.faq.invite.answer":
      "FalconDraft es sólo por invitación. Abra el enlace recibido por email, cree su contraseña si es necesario y luego inicie sesión con la dirección de email invitada.",
    "support.faq.deal.question": "¿Para qué sirve un expediente?",
    "support.faq.deal.answer":
      "Un expediente centraliza el cliente, el contexto de ventas, el presupuesto, los pasos de generación y los documentos vinculados a una oportunidad.",
    "support.faq.documents.question": "¿Dónde puedo encontrar mis documentos?",
    "support.faq.documents.answer":
      "Los documentos están disponibles en la pestaña Documentos y en cada expediente. El contenido generado y los datos del cliente nunca se traducen cuando cambia el idioma de la interfaz.",
    "support.faq.validation.question": "¿Cómo funciona la aprobación?",
    "support.faq.validation.answer":
      "Los pasos de aprobación muestran qué está listo, qué necesita revisión y qué se puede enviar. Los rastros permanecen visibles en cada feed de actividad de la transacción.",
    "support.faq.roles.question": "¿Qué pueden hacer los roles de equipo?",
    "support.faq.roles.answer":
      "Los gestores controlan la configuración del equipo y del espacio de trabajo. Los colaboradores trabajan en expedientes autorizados. Los lectores pueden revisar la información sin modificar elementos sensibles.",
    "support.faq.visibility.question":
      "¿Cómo funcionan las configuraciones de visibilidad?",
    "support.faq.visibility.answer":
      "Dependiendo de la configuración de su espacio de trabajo, es posible que vea vistas de toda la empresa o solo los expedientes y documentos que sean relevantes para usted.",
    "support.faq.language.question": "¿Cómo cambio de idioma?",
    "support.faq.language.answer":
      "El idioma se gestiona en Configuración. El francés sigue siendo el predeterminado y el inglés solo traduce la interfaz de la aplicación.",
    "support.faq.issue.question": "¿Qué debo hacer si veo un error?",
    "support.faq.issue.answer":
      "Tenga en cuenta la acción que realizó, la propuesta comercial relacionada, el mensaje mostrado y el tiempo aproximado. Envíe esos datos al soporte para acelerar el diagnóstico.",
    "support.contact.title": "Contactar con soporte",
    "support.contact.description":
      "Envíe una solicitud al equipo de FalconDraft. El mensaje se envía desde la aplicación, luego recibes un email de confirmación.",
    "support.contact.typeLabel": "Tipo de solicitud",
    "support.contact.type.question": "pregunta de uso",
    "support.contact.type.bug": "Informar un error",
    "support.contact.type.feature": "Sugerir una característica",
    "support.contact.subject.question": "Pregunta sobre FalconDraft",
    "support.contact.subject.bug": "Error a corregir en FalconDraft",
    "support.contact.subject.feature": "Sugerencia de función FalconDraft",
    "support.contact.subjectLabel": "Sujeto",
    "support.contact.subjectPlaceholder": "P.ej. Emitir con un documento final",
    "support.contact.messageLabel": "Mensaje",
    "support.contact.messagePlaceholder":
      "Describe tu pregunta, el error que observaste o la mejora que te gustaría.",
    "support.contact.submit": "Enviar a soporte",
    "support.contact.sending": "Envío...",
    "support.contact.sent": "Mensaje enviado",
    "support.contact.sentDescription":
      "El soporte de FalconDraft recibió su solicitud. Se le ha enviado un email de confirmación.",
    "support.contact.sentNoConfirmation":
      "El soporte de FalconDraft recibió su solicitud. El email de confirmación no se pudo enviar automáticamente.",
    "support.contact.error": "No se pudo enviar",
    "support.contact.errorDescription":
      "Su mensaje no pudo ser enviado al soporte en este momento.",
    "support.contact.messageTooShort":
      "Agregue algunos detalles más para que el soporte pueda entender su solicitud.",
    "support.quick.bug.title": "Bicho",
    "support.quick.bug.description":
      "Incluya los pasos de reproducción, el navegador y la propuesta comercial relacionada.",
    "support.quick.idea.title": "Sugerencia",
    "support.quick.idea.description":
      "Explica el resultado esperado y el impacto en tu proceso comercial.",
    "support.quick.question.title": "Pregunta",
    "support.quick.question.description":
      "Solicite ayuda con el uso, una función, un paso o la configuración del espacio de trabajo.",
    "dashboard.eyebrow": "Panel",
    "dashboard.title": "Vista de conjunto comercial",
    "dashboard.description": "Aquí está el estado de tus expedientes.",
    "dashboard.stats.activeDeals": "En curso",
    "dashboard.stats.activeDealsDetail": "Excluyendo expedientes completados",
    "dashboard.stats.readyDocuments": "Listos para enviar",
    "dashboard.stats.readyDocumentsDetail": "Para revisar o enviar",
    "dashboard.stats.pipelineValue": "Valor en pipeline",
    "dashboard.stats.pipelineValueDetail": "Tubería actual",
    "dashboard.stats.attention": "Requieren atención",
    "dashboard.stats.attentionDetail": "Aprobación, documento o error",
    "dashboard.stats.signatureRate": "Tasa de firma",
    "dashboard.stats.signatureRateDetail": "Últimos 30 días",
    "dashboard.stats.pipelineOpen": "Pipeline abierto",
    "dashboard.stats.activeProposals": "Propuestas activas",
    "dashboard.stats.readyToSend": "Listo para enviar",
    "dashboard.pipeline.title": "Pipeline por etapa",
    "dashboard.pipeline.viewAll": "Ver detalle",
    "dashboard.pipeline.total": "Total pipeline",
    "dashboard.pipeline.range.week": "7 d",
    "dashboard.pipeline.range.month": "30 d",
    "dashboard.pipeline.range.quarter": "Trim.",
    "dashboard.pipeline.stages.draft": "Borrador",
    "dashboard.pipeline.stages.review": "En revisión",
    "dashboard.pipeline.stages.sent": "Enviada",
    "dashboard.pipeline.stages.signed": "Firmada",
    "dashboard.followUp.title": "Expedientes a seguir",
    "dashboard.followUp.empty": "Ningún expediente requiere su atención.",
    "dashboard.followUp.viewAll": "Todos los expedientes",
    "dashboard.recentDeals.title": "Expedientes recientes",
    "dashboard.recentDeals.description": "Prioridad",
    "dashboard.featured.title": "Siguiente acción recomendada",
    "dashboard.featured.description": "Seguir la progresión",
    "dashboard.featured.empty":
      "No hay expediente prioritario en este momento.",
    "dashboard.chart.title": "Evolución comercial",
    "dashboard.chart.description":
      "Volumen mensual de propuestas y documentos finales.",
    "dashboard.activity.title": "Actividad reciente",
    "dashboard.activity.description": "Últimos cambios significativos.",
    "table.deal": "Expediente",
    "table.status": "Estado",
    "table.budget": "Presupuesto",
    "table.updated": "Actualizado",
    "deals.eyebrow": "Expedientes comerciales",
    "deals.title": "Tus expedientes",
    "deals.description": "Encuentra y gestiona todas tus propuestas.",
    "deals.tabs.mine": "Mis expedientes",
    "deals.tabs.organization": "Empresa",
    "deals.searchPlaceholder": "Buscar...",
    "deals.statusPlaceholder": "Filtrar por estado",
    "deals.allStatuses": "Todos los estados",
    "deals.client": "Cliente",
    "deals.actions": "Comportamiento",
    "deals.open": "Abrir",
    "deals.archive": "Archivar",
    "deals.restore": "Restaurar",
    "deals.updating": "Actualizando...",
    "deals.delete": "Eliminar",
    "deals.deleting": "Eliminando...",
    "deals.emptyFiltered": "Ningún expediente coincide con estos filtros.",
    "dealDetail.eyebrow": "Expediente",
    "dealDetail.created": "Creado",
    "dealDetail.updated": "Actualizado",
    "dealDetail.owner": "Dueño",
    "dealDetail.clientCompany": "Empresa cliente",
    "dealDetail.organization": "Organización",
    "dealDetail.source": "Fuente",
    "dealDetail.contact": "Contacto",
    "dealDetail.name": "Nombre",
    "dealDetail.phone": "Teléfono",
    "dealDetail.transcriptTitle": "Notas y transcripción",
    "dealDetail.transcriptDescription": "Tu base de trabajo para este expediente.",
    "dealDetail.productionTitle": "Documentos generados",
    "dealDetail.productionDescription": "Todos los documentos de este expediente.",
    "dealDetail.callSummary": "Resumen de llamada",
    "dealDetail.proposal": "Propuesta comercial",
    "dealDetail.finalDocument": "Documento final",
    "dealDetail.finalDocumentReady": "Documento final listo para descargar.",
    "dealDetail.finalDocumentWaiting":
      "Documento final listo para compartir una vez aprobada la propuesta.",
    "dealDetail.signature": "Firma",
    "dealDetail.signaturePrepared": "Enlace de firma preparado",
    "dealDetail.generatedDocuments": "Documentos generados",
    "dealDetail.generatedDocumentsDescription":
      "Archivos y enlaces producidos para este expediente.",
    "dealDetail.emailDraft": "Listo para enviar",
    "dealDetail.instructions": "Instrucción: {instructions}",
    "dealDetail.activity": "Registro de actividad",
    "dealDetail.actions": "Comportamiento",
    "dealDetail.actionsDescription":
      "Comandos principales para el ciclo de propuesta.",
    "dealDetail.progress": "Progreso",
    "dealDetail.lastUpdated": "Última actualización",
    "dealDetail.extraSections":
      "Secciones adicionales {count} en la vista completa.",
    "dealDetail.summaryReady": "Resumen de llamada listo",
    "dealDetail.summaryReadyDescription":
      "El resumen de la llamada está disponible en el expediente.",
    "dealDetail.summaryDeleteConfirm":
      "¿Eliminar el resumen de la llamada? Puede editar el expediente y generarlo nuevamente después.",
    "dealDetail.summaryDeleteFallback":
      "No se pudo eliminar el resumen de la llamada.",
    "dealDetail.summaryDeleted": "Resumen de llamada eliminado",
    "dealDetail.summaryDeletedDescription":
      "Puede editar el expediente y ejecutar la generación nuevamente.",
    "dealDetail.summaryGenerating":
      "Generación de resumen de llamadas en curso",
    "dealDetail.summaryWaiting": "Resumen de llamada pendiente",
    "dealDetail.summaryPolling":
      "La página se actualizará automáticamente tan pronto como el resumen de la llamada esté disponible.",
    "dealDetail.summaryStart":
      "Inicia la generación desde el panel de acciones para preparar esta sección.",
    "dealDetail.summaryStructured": "Resumen de llamada estructurada",
    "dealDetail.summaryStructuredDescription":
      "Una lectura sintética de los puntos clave extraídos del expediente.",
    "dealDetail.summaryFull": "Resumen completo de la convocatoria",
    "dealDetail.summaryFullDescription":
      "Versión estructurada completa del resumen de la llamada de ventas.",
    "dealDetail.proposalReady": "Propuesta comercial lista",
    "dealDetail.proposalReadyDescription":
      "La propuesta comercial está preparada para revisión.",
    "dealDetail.proposalDeleteConfirm":
      "¿Eliminar la propuesta? Puede editar el expediente y generarlo nuevamente después.",
    "dealDetail.proposalDeleteFallback": "La propuesta no pudo eliminarse.",
    "dealDetail.proposalDeleted": "Propuesta eliminada",
    "dealDetail.proposalDeletedDescription":
      "Puede editar el expediente y ejecutar la generación nuevamente.",
    "dealDetail.proposalGenerating": "Preparando la propuesta comercial...",
    "dealDetail.proposalWaiting": "La propuesta comercial está en cola.",
    "dealDetail.proposalPolling":
      "La página se actualizará automáticamente tan pronto como la propuesta esté disponible.",
    "dealDetail.proposalStart": "Generar la propuesta comercial",
    "dealDetail.editLink": "Enlace de edición",
    "dealDetail.editLinkDescription":
      "Acceso al espacio de trabajo externo para ajustar la propuesta.",
    "dealDetail.edit": "Editar",
    "dealDetail.editUnavailable": "Edición no disponible",
    "dealDetail.proposalContent": "Contenido de la propuesta",
    "dealDetail.openContent": "Abrir contenido",
    "dealDetail.proposalFullDescription":
      "Versión estructurada completa de la propuesta de venta.",
    "dealDetail.deleteImpossible": "Error al eliminar",
    "dealDetail.newEyebrow": "Nuevo expediente comercial",
    "dealDetail.newTitle": "Crear un expediente comercial",
    "dealDetail.newDescription":
      "Avance paso a paso a través del encuadre, el contacto, las notas de llamada y las instrucciones de salida.",
    "integrations.description":
      "Conecta las herramientas compatibles para preparar borradores de email y documentos sin exponer la complejidad técnica.",
    "integrations.gmail.personal": "Cuenta Gmail profesional",
    "integrations.gmail.connected": "Gmail conectado",
    "integrations.gmail.disconnected": "Gmail desconectado",
    "integrations.gmail.connectedToast": "Gmail está conectado a FalconDraft.",
    "integrations.gmail.denied": "Conexión de Gmail cancelada.",
    "integrations.gmail.refused":
      "Conexión de Gmail rechazada para este espacio de trabajo.",
    "integrations.gmail.unavailable":
      "La configuración de Gmail no está disponible.",
    "integrations.gmail.error":
      "La conexión de Gmail falló. Inténtalo de nuevo desde la configuración.",
    "integrations.gmail.disconnectError": "No se pudo desconectar.",
    "integrations.gmail.disconnectedToast": "Gmail está desconectado.",
    "integrations.gmail.body1":
      "FalconDraft prepara borradores de email en tu cuenta conectada.",
    "integrations.gmail.body2":
      "Siempre conservas el control final: revisar, ajustar y enviar desde tu mensajería.",
    "integrations.gmail.connectedAccount": "Cuenta conectada",
    "integrations.gmail.disconnecting": "Desconectando…",
    "integrations.gmail.disconnect": "Desconectar",
    "integrations.gmail.connect": "Conectar Gmail",
    "integrations.microsoft.subtitle": "Outlook profesional",
    "integrations.microsoft.comingSoon": "Disponible próximamente",
    "integrations.microsoft.body1":
      "La conexión Outlook permitirá preparar borradores de email desde el entorno Microsoft.",
    "integrations.microsoft.body2":
      "FalconDraft no enviará emails automáticamente.",
    "integrations.microsoft.cta": "Conectar Outlook",
    "integrations.microsoft.connect": "Conectar Outlook",
    "integrations.microsoft.disconnect": "Desconectar",
    "integrations.microsoft.disconnecting": "Desconectando...",
    "integrations.microsoft.connected": "Conectado",
    "integrations.microsoft.disconnected": "No conectado",
    "integrations.microsoft.connectedAccount": "Cuenta conectada",
    "integrations.microsoft.connectedToast":
      "Outlook está conectado a FalconDraft.",
    "integrations.microsoft.disconnectedToast": "Outlook desconectado.",
    "integrations.microsoft.disconnectError": "Falló la desconexión.",
    "integrations.microsoft.denied": "Conexión de Outlook cancelada.",
    "integrations.microsoft.refused":
      "Conexión de Outlook rechazada para este espacio de trabajo.",
    "integrations.microsoft.unavailable":
      "La configuración de Outlook no está disponible.",
    "integrations.microsoft.error":
      "Se produjo un error durante la conexión de Outlook. Por favor inténtalo de nuevo.",
    "billing.current": "Suscripción actual",
    "billing.details":
      "{price} · Estado {status} · Próxima fecha de vencimiento: {nextInvoice}",
    "billing.statusDetail": "Estado {status}",
    "billing.nextInvoiceDetail": "Próxima fecha de vencimiento: {nextInvoice}",
    "billing.manage": "Administrar suscripción",
    "billing.emptyInvoices": "No hay historial de facturas disponible.",
    "billing.notesTitle": "notas de facturación",
    "billing.notesDescription":
      "La información de suscripción, las fechas de vencimiento y las facturas se agrupan aquí para facilitar el seguimiento del administrador.",
    "documents.eyebrow": "Documentos",
    "documents.title": "Biblioteca de documentos",
    "documents.description":
      "Encuentra las propuestas comerciales, presupuestos y documentos finales preparados para tus expedientes.",
    "documents.libraryTitle": "Documentos preparados",
    "documents.libraryMine": "Últimos activos preparados para sus negocios.",
    "documents.libraryOrganization":
      "Últimos activos preparados para todas las propuesta comercials activas.",
    "documents.tabs.mine": "Mis documentos",
    "documents.tabs.organization": "En toda la empresa",
    "documents.dealLabel": "Expediente",
    "archives.eyebrow": "Archivos",
    "archives.title": "Expedientes archivados",
    "archives.description":
      "Consulta los expedientes retirados del pipeline comercial activo.",
    "settings.eyebrow": "Ajustes",
    "settings.title": "Ajustes",
    "settings.description": "Personaliza tu espacio FalconDraft.",
    "settings.nav.general": "General",
    "settings.nav.team": "Equipo",
    "settings.nav.integrations": "Integraciones",
    "settings.nav.billing": "Facturación",
    "settings.profile.title": "Perfil",
    "settings.profile.description":
      "Foto e identidad mostradas en el espacio de trabajo de su cliente.",
    "settings.photo.choose": "Elige una foto",
    "settings.photo.remove": "Eliminar",
    "settings.photo.dialogTitle": "Foto de perfil",
    "settings.photo.dialogDescription":
      "Elige una foto profesional, clara y centrada en tu rostro.",
    "settings.photo.formats": "Formatos aceptados",
    "settings.photo.formatsDetail": "PNG, JPG o WebP. Tamaño máximo: 2 MB.",
    "settings.photo.select": "Seleccione una imagen",
    "settings.photo.saving": "Guardando...",
    "settings.photo.updating": "Actualizando...",
    "settings.photo.errorTitle": "Foto no guardada",
    "settings.photo.errorDescription": "La foto no se pudo guardar.",
    "settings.photo.errorSize": "La foto debe tener menos de 2 MB.",
    "settings.photo.errorSizeTitle": "Imagen demasiado grande",
    "settings.photo.errorFormat": "Elige una imagen PNG, JPG o WebP.",
    "settings.photo.errorFormatTitle": "Formato no compatible",
    "settings.photo.successUpdated": "Foto de perfil actualizada.",
    "settings.photo.successRemoved": "Foto de perfil eliminada.",
    "settings.photo.removeErrorTitle": "Foto no eliminada",
    "settings.photo.removeErrorDescription": "La foto no se pudo eliminar.",
    "settings.preferences.title": "Preferencias",
    "settings.preferences.description": "Personaliza tu espacio FalconDraft.",
    "settings.organizationName": "Nombre del espacio de trabajo",
    "settings.defaultLanguage": "Idioma de la interfaz",
    "settings.defaultLanguagePlaceholder": "Seleccionar un idioma",
    "settings.appearance": "Modo de visualización",
    "settings.appearancePlaceholder": "Elige un tema",
    "settings.appearance.light": "Luz",
    "settings.appearance.dark": "Oscuro",
    "settings.appearance.system": "Sistema",
    "settings.askCloseDate": "Preguntar por la fecha de cierre objetivo",
    "settings.askCloseDateDescription":
      "Agrega un campo opcional al crear o editar un expediente.",
    "settings.saved": "Configuración guardada.",
    "visibility.title": "Acceso & permisos",
    "visibility.description":
      "Controle el acceso de los colaboradores a las vistas de documentos y expedientes de toda la empresa.",
    "visibility.option": 'Permitir vistas de "toda la empresa"',
    "visibility.optionDescription":
      "Cuando esta opción está deshabilitada, los colaboradores ya no ven la pestaña de la empresa y solo pueden acceder a sus propios expedientes y documentos. Los directivos mantienen la visión global.",
    "visibility.saveError": "La actualización falló.",
    "visibility.notSaved": "Preferencia no guardada",
    "visibility.saved": "Visibilidad actualizada",
    "visibility.savedOpen":
      "Los colaboradores pueden abrir vistas de toda la empresa.",
    "visibility.savedRestricted":
      "Los colaboradores solo ven sus propios expedientes y documentos.",
    "team.title": "Colaboradores",
    "team.description":
      "Miembros activos, roles y acceso al espacio de trabajo.",
    "team.columns.name": "Nombre",
    "team.columns.email": "Email",
    "team.columns.role": "Role",
    "team.columns.status": "Estado",
    "team.columns.lastActive": "Último activo",
    "team.columns.actions": "Comportamiento",
    "team.you": "Tú",
    "team.remove": "Quitar del espacio de trabajo",
    "team.removing": "Eliminando...",
    "team.confirmRemove":
      "¿Eliminar {name} del espacio de trabajo? Su acceso quedará inhabilitado.",
    "team.errorRemove": "La eliminación falló.",
    "team.kept": "Miembro mantenido",
    "team.removed": "Miembro eliminado",
    "team.removedDescription":
      "{name} ya no tiene acceso al espacio de trabajo.",
    "team.roleUpdateSuccess": "Rol actualizado",
    "team.roleUpdateError": "Rol no actualizado",
    "team.emptyTitle": "Sin miembros",
    "team.emptyDescription":
      "Los miembros adjuntos a este espacio de trabajo de cliente aparecerán aquí.",
    "team.invite.title": "Invitar a un colaborador",
    "team.invite.description":
      "Se envía un enlace privado por email. La creación de cuentas públicas permanece cerrada.",
    "team.invite.email": "email de trabajo",
    "team.invite.role": "Role",
    "team.invite.placeholder": "colaborador@empresa.com",
    "team.invite.submit": "Enviar invitación",
    "team.invite.submitting": "Envío...",
    "team.invite.sent": "Invitación enviada",
    "team.invite.sentDescription": "{email} recibió su enlace FalconDraft.",
    "team.invite.error": "Invitación no enviada",
    "team.invitations.title": "Invitaciones pendientes",
    "team.invitations.description":
      "Enlaces activos que aún no han sido aceptados.",
    "team.invitations.expires": "Vence",
    "team.invitations.action": "Acción",
    "team.invitations.revoke": "Revocar",
    "team.invitations.revoking": "Revocando...",
    "team.invitations.revoked": "Invitación revocada",
    "team.invitations.emptyTitle": "No hay invitaciones pendientes",
    "team.invitations.emptyDescription":
      "Aquí aparecerán las invitaciones enviadas que no hayan sido aceptadas.",
    "team.status.active": "Activo",
    "team.status.invited": "Invitación enviada",
    "roles.manager": "Gestor",
    "roles.member": "Colaborador",
    "roles.viewer": "Lector",
    "dealStatus.draft": "Borrador",
    "dealStatus.call_summary_ready": "Resumen de llamada listo",
    "dealStatus.proposal_generating": "Propuesta comercial en curso",
    "dealStatus.proposal_ready": "Propuesta comercial lista",
    "dealStatus.validation_pending": "Pendiente de validación",
    "dealStatus.final_document_generating": "Documento final en curso",
    "dealStatus.final_document_ready": "Documento final listo",
    "dealStatus.signature_ready": "Firma lista",
    "dealStatus.email_draft_ready": "Borrador de email listo",
    "dealStatus.completed": "Completado",
    "dealStatus.failed": "Error",
    "documentType.proposal": "Propuesta comercial",
    "documentType.proposal_gamma": "Propuesta editable",
    "documentType.proposal_pdf": "PDF de propuesta comercial",
    "documentType.proposal_pdf_initial": "PDF de propuesta comercial",
    "documentType.quote": "Presupuesto",
    "documentType.quote_pdf": "PDF de presupuesto",
    "documentType.final_document": "Documento final",
    "documentType.final_document_pdf": "Documento final listo para firma",
    "documentType.signature_link": "Enlace de firma",
    "workflow.opportunity.label": "Expediente",
    "workflow.opportunity.description": "Contexto del cliente",
    "workflow.summary.label": "Resumen de llamada",
    "workflow.summary.description": "Síntesis de la llamada",
    "workflow.proposal.label": "Propuesta comercial",
    "workflow.proposal.description": "Documento listo para enviar",
    "workflow.validation.label": "Validación",
    "workflow.validation.description": "Revisión interna",
    "workflow.final_document.label": "Documento final",
    "workflow.final_document.description": "PDF finalizado",
    "workflow.signature.label": "Firma",
    "workflow.signature.description": "Enlace de firma",
    "workflow.email.label": "Email de envío",
    "workflow.email.description": "Borrador personalizable",
    "activity.workflow.failed": "Generación fallida",
    "activity.workflow.completed": "Generación completada",
    "activity.workflow.running": "Generación en curso",
    "activity.workflow.description": "Flujo {type} · {status}",
    "activity.audit.invitation_created": "Invitación enviada",
    "activity.audit.invitation_accepted": "Invitación aceptada",
    "activity.audit.invitation_revoked": "Invitación revocada",
    "activity.audit.member_deactivated": "Colaborador eliminado",
    "activity.audit.organization_member_role_updated":
      "Rol de colaborador actualizado",
    "activity.audit.organization_visibility_updated":
      "Visibilidad del espacio de trabajo actualizada",
    "activity.audit.email_provider_connected": "Proveedor de email conectado",
    "activity.audit.email_provider_disconnected":
      "Proveedor de email desconectado",
    "activity.audit.email_draft_workflow_started":
      "Se inició la creación del borrador de Gmail",
    "activity.audit.organization_created":
      "Espacio de trabajo del cliente creado",
    "activity.audit.workflow_config_created":
      "Configuración del flujo de trabajo creada",
    "activity.audit.workflow_config_updated":
      "Configuración del flujo de trabajo actualizada",
    "activity.audit.first_manager_invited": "Primer gestor invitado",
    "activity.audit.deal_updated": "Propuesta comercial actualizada",
    "activity.audit.proposal_deleted": "Propuesta eliminada",
    "activity.audit.summary_deleted": "Resumen de llamada eliminado",
    "activity.audit.deal_archived": "Propuesta comercial archivada",
    "activity.audit.deal_restored": "Expediente restaurado",
    "activity.audit.generic": "Cambio registrado",
    "activity.actor.team": "Equipo",
    "activity.actor.system": "FalconDraft",
  },
};

export function isLanguage(
  value: string | null | undefined,
): value is Language {
  return value === "fr" || value === "en" || value === "es";
}

export const languageIntlLocales: Record<Language, string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
};

export function getLocalizedCopy(
  language: Language,
  copy: Record<Language, string>,
) {
  return copy[language];
}

export function interpolate(
  template: string,
  params?: Record<string, string | number>,
) {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function translate(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
) {
  return interpolate(
    translations[language][key] ?? translations.fr[key] ?? key,
    params,
  );
}
