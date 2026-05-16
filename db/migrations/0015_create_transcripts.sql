create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  deal_id uuid references public.deals(id) on delete set null,
  title text not null,
  source text not null default 'manual_paste',
  status text not null default 'ready',
  language text,
  transcript_text text,
  audio_storage_path text,
  recall_bot_id text,
  recall_call_id text,
  recall_meeting_url text,
  participants jsonb,
  started_at timestamptz,
  duration_seconds integer,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transcripts_organization_id_idx on public.transcripts(organization_id);
create index if not exists transcripts_deal_id_idx on public.transcripts(deal_id);
create index if not exists transcripts_created_by_idx on public.transcripts(created_by);

grant select, insert, update, delete on public.transcripts to authenticated;
grant select, insert, update, delete on public.transcripts to service_role;

alter table public.transcripts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transcripts'
      and policyname = 'Active members can select organization transcripts'
  ) then
    execute $policy$
      create policy "Active members can select organization transcripts"
        on public.transcripts
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = transcripts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transcripts'
      and policyname = 'Active non-viewers can insert organization transcripts'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization transcripts"
        on public.transcripts
        for insert
        to authenticated
        with check (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = transcripts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transcripts'
      and policyname = 'Active non-viewers can update organization transcripts'
  ) then
    execute $policy$
      create policy "Active non-viewers can update organization transcripts"
        on public.transcripts
        for update
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = transcripts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = transcripts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'transcripts'
      and policyname = 'Active managers can delete organization transcripts'
  ) then
    execute $policy$
      create policy "Active managers can delete organization transcripts"
        on public.transcripts
        for delete
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = transcripts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;
end $$;
