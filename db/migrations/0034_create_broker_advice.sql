-- ============================================================================
-- 0034_create_broker_advice
--
-- "Devoir de conseil" documents for the insurance-broker module. Built from the
-- client's recorded needs and a validated company quote. In this phase the
-- content is assembled from a structured template (no AI/n8n yet); the broker
-- edits and validates it. The document MUST remain editable and validated by
-- the broker before any transmission — the system assists, it does not replace
-- the broker's professional responsibility.
--
--   status: draft -> validated -> sent_for_signature -> signed
--
-- DocuSeal signature + Outlook draft generation come in a later phase; the
-- columns are provisioned now so the flow can be wired without a migration.
-- ============================================================================

create table if not exists public.broker_advice (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.broker_clients(id) on delete cascade,
  quote_id uuid references public.broker_quotes(id) on delete set null,
  created_by uuid not null,
  title text not null default 'Devoir de conseil',
  content text not null default '',
  status text not null default 'draft',
  docuseal_submission_id text,
  signature_status text,
  signature_url text,
  outlook_draft_id text,
  generated_at timestamptz,
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_advice_status_check
    check (status in ('draft', 'validated', 'sent_for_signature', 'signed'))
);

create index if not exists broker_advice_organization_id_idx on public.broker_advice(organization_id);
create index if not exists broker_advice_client_id_idx on public.broker_advice(client_id);
create index if not exists broker_advice_quote_id_idx on public.broker_advice(quote_id);
create index if not exists broker_advice_status_idx on public.broker_advice(status);

grant select, insert, update, delete on public.broker_advice to authenticated;
grant select, insert, update, delete on public.broker_advice to service_role;

alter table public.broker_advice enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_advice'
      and policyname = 'Active members can select organization broker advice'
  ) then
    execute $policy$
      create policy "Active members can select organization broker advice"
        on public.broker_advice for select to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_advice.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_advice'
      and policyname = 'Active non-viewers can insert organization broker advice'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization broker advice"
        on public.broker_advice for insert to authenticated
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_advice.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_advice'
      and policyname = 'Active non-viewers can update organization broker advice'
  ) then
    execute $policy$
      create policy "Active non-viewers can update organization broker advice"
        on public.broker_advice for update to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_advice.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_advice.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_advice'
      and policyname = 'Active managers can delete organization broker advice'
  ) then
    execute $policy$
      create policy "Active managers can delete organization broker advice"
        on public.broker_advice for delete to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_advice.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;
end $$;
