alter table public.deals
  add column if not exists quote_context text;

comment on column public.deals.quote_context is
  'Stores quote/devis context generated during proposal preparation so later validation workflows can reuse it.';
