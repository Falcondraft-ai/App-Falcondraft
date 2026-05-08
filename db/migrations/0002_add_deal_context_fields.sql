alter table public.deals
  add column if not exists additional_context text,
  add column if not exists email_instructions text,
  add column if not exists client_phone text,
  add column if not exists client_company_info text;

comment on column public.deals.transcript is
  'Raw call notes or transcript only. Extra context, email instructions, phone and company billing data are stored in dedicated columns.';

comment on column public.deals.additional_context is
  'Additional commercial context used for proposal and document generation.';

comment on column public.deals.email_instructions is
  'Email-specific instructions used when preparing the follow-up draft.';

comment on column public.deals.client_phone is
  'Client contact phone number.';

comment on column public.deals.client_company_info is
  'Company and billing information useful for quote generation.';
