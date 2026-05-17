-- Table pour les webhooks système partagés entre tous les workspaces
create table if not exists public.system_workflow_configs (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null unique,
  n8n_webhook_url text not null,
  n8n_workflow_id text,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.system_workflow_configs is
  'Webhooks n8n système partagés entre tous les workspaces (ex: transcription audio). Pas rattachés à une organisation.';

-- Migrer audio_transcription depuis workflow_configs
insert into public.system_workflow_configs (workflow_type, n8n_webhook_url, status)
select workflow_type, n8n_webhook_url, status
from public.workflow_configs
where workflow_type = 'audio_transcription'
on conflict (workflow_type) do nothing;

-- Supprimer audio_transcription de workflow_configs
delete from public.workflow_configs
where workflow_type = 'audio_transcription';

-- RLS : accès uniquement via service_role (backend), pas de policy publique
alter table public.system_workflow_configs enable row level security;
