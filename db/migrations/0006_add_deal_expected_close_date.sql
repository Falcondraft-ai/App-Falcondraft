alter table public.deals
  add column if not exists expected_close_date date;

comment on column public.deals.expected_close_date is
  'Optional target date shown/collected only when the workspace preference is enabled.';
