-- ============================================================================
-- 0044_create_broker_email_digests
--
-- Outlook assistant: the daily email "briefing". Per-user (it reads the user's
-- own connected Outlook mailbox), org-scoped. Three tables:
--
--   * broker_email_digests       — one run of the briefing (a time window).
--   * broker_email_items         — one brokerage-relevant email kept in a digest
--                                  (non-brokerage mail is excluded, only counted).
--   * broker_email_suggestions   — a proposed action on an item the broker
--                                  validates one by one (attach a document to a
--                                  dossier, draft a reply, create a client,
--                                  declare a claim, flag a renewal).
--
-- Nothing is executed without the broker's explicit acceptance. RLS is per-user
-- (user_id = auth.uid()) within an active organization membership.
-- ============================================================================

create table if not exists public.broker_email_digests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'ready',
  narrative text,
  window_start timestamptz,
  window_end timestamptz,
  relevant_count integer not null default 0,
  excluded_count integer not null default 0,
  generated_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_email_digests_status_check
    check (status in ('generating', 'ready', 'failed'))
);

create index if not exists broker_email_digests_org_user_idx
  on public.broker_email_digests(organization_id, user_id, created_at desc);

create table if not exists public.broker_email_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  digest_id uuid not null references public.broker_email_digests(id) on delete cascade,
  user_id uuid not null,
  graph_message_id text not null,
  from_name text,
  from_email text,
  subject text,
  received_at timestamptz,
  web_link text,
  category text,
  summary text,
  urgency text not null default 'normal',
  suggested_client_id uuid references public.broker_clients(id) on delete set null,
  has_attachments boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_email_items_urgency_check check (urgency in ('normal', 'high')),
  constraint broker_email_items_status_check
    check (status in ('pending', 'reviewed', 'dismissed'))
);

create index if not exists broker_email_items_digest_idx
  on public.broker_email_items(digest_id);
create index if not exists broker_email_items_user_message_idx
  on public.broker_email_items(organization_id, user_id, graph_message_id);

create table if not exists public.broker_email_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null references public.broker_email_items(id) on delete cascade,
  user_id uuid not null,
  type text not null,
  status text not null default 'pending',
  confidence text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_email_suggestions_type_check
    check (type in ('attach_document', 'draft_reply', 'create_client', 'declare_claim', 'flag_renewal')),
  constraint broker_email_suggestions_status_check
    check (status in ('pending', 'accepted', 'rejected', 'done', 'failed'))
);

create index if not exists broker_email_suggestions_item_idx
  on public.broker_email_suggestions(item_id);

grant select, insert, update, delete on public.broker_email_digests to authenticated;
grant select, insert, update, delete on public.broker_email_digests to service_role;
grant select, insert, update, delete on public.broker_email_items to authenticated;
grant select, insert, update, delete on public.broker_email_items to service_role;
grant select, insert, update, delete on public.broker_email_suggestions to authenticated;
grant select, insert, update, delete on public.broker_email_suggestions to service_role;

alter table public.broker_email_digests enable row level security;
alter table public.broker_email_items enable row level security;
alter table public.broker_email_suggestions enable row level security;

-- Per-user RLS over the three tables: the row's user_id must be the caller and
-- the caller must be an active member of the row's organization.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['broker_email_digests', 'broker_email_items', 'broker_email_suggestions']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl
        and policyname = 'Owner can manage ' || tbl
    ) then
      execute format($f$
        create policy %I
          on public.%I for all to authenticated
          using (
            %I.user_id = (select auth.uid())
            and exists (
              select 1 from public.organization_members
              where organization_members.organization_id = %I.organization_id
                and organization_members.user_id = (select auth.uid())
                and organization_members.status = 'active'
            )
          )
          with check (
            %I.user_id = (select auth.uid())
            and exists (
              select 1 from public.organization_members
              where organization_members.organization_id = %I.organization_id
                and organization_members.user_id = (select auth.uid())
                and organization_members.status = 'active'
            )
          )
      $f$, 'Owner can manage ' || tbl, tbl, tbl, tbl, tbl, tbl);
    end if;
  end loop;
end $$;
