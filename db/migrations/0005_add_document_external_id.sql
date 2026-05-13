alter table public.documents
  add column if not exists external_id text;

comment on column public.documents.external_id is
  'Stores external provider document identifiers such as quote, signature, or generation IDs to avoid duplicate downstream resources.';

create index if not exists documents_external_id_idx
  on public.documents(external_id)
  where external_id is not null;
