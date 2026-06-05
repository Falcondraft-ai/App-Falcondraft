alter table public.organizations
  add column if not exists meeting_bot_name text not null default 'FalconDraft';

comment on column public.organizations.meeting_bot_name is
  'Nom affiché par l’assistant de réunion lorsqu’il rejoint un appel client.';
