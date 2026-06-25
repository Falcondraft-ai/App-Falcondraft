-- ============================================================================
-- 0036_create_broker_agent_messages
--
-- Persistent conversation history for the courtier AI assistant. One rolling
-- conversation per user per workspace. Each user only ever sees their own
-- messages (the assistant is personal). Writes go through the service role from
-- the agent route; the SELECT policy lets a user read their own history.
-- ============================================================================

create table if not exists public.broker_agent_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint broker_agent_messages_role_check check (role in ('user', 'assistant'))
);

create index if not exists broker_agent_messages_org_user_idx
  on public.broker_agent_messages(organization_id, user_id, created_at);

grant select, insert, delete on public.broker_agent_messages to authenticated;
grant select, insert, update, delete on public.broker_agent_messages to service_role;

alter table public.broker_agent_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_agent_messages'
      and policyname = 'Users select own agent messages'
  ) then
    execute $policy$
      create policy "Users select own agent messages"
        on public.broker_agent_messages for select to authenticated
        using (user_id = (select auth.uid()))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_agent_messages'
      and policyname = 'Users insert own agent messages'
  ) then
    execute $policy$
      create policy "Users insert own agent messages"
        on public.broker_agent_messages for insert to authenticated
        with check (
          user_id = (select auth.uid())
          and exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_agent_messages.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_agent_messages'
      and policyname = 'Users delete own agent messages'
  ) then
    execute $policy$
      create policy "Users delete own agent messages"
        on public.broker_agent_messages for delete to authenticated
        using (user_id = (select auth.uid()))
    $policy$;
  end if;
end $$;
