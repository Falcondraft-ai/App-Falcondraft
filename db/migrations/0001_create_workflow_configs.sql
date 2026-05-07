create extension if not exists pgcrypto;

create table if not exists public.workflow_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_type text not null,
  n8n_webhook_url text not null,
  n8n_workflow_id text,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, workflow_type)
);

create index if not exists workflow_configs_organization_id_idx
  on public.workflow_configs(organization_id);

alter table public.workflow_configs enable row level security;

comment on table public.workflow_configs is
  'Maps each organization and workflow type to its client-specific automation webhook. Prompts are not stored here.';
