alter table public.deals
  add column if not exists archived_at timestamptz;

comment on column public.deals.archived_at is
  'When set, removes the deal from the active commercial pipeline without deleting its records.';

create index if not exists deals_archived_at_idx
  on public.deals(archived_at)
  where archived_at is not null;
