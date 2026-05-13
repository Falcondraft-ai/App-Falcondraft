create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  invited_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_invitations_role_check
    check (role in ('owner', 'manager', 'member', 'viewer')),
  constraint organization_invitations_status_check
    check (status in ('pending', 'accepted', 'expired', 'revoked'))
);

create unique index if not exists organization_invitations_pending_email_unique_idx
  on public.organization_invitations(organization_id, lower(email))
  where status = 'pending';

create index if not exists organization_invitations_organization_id_idx
  on public.organization_invitations(organization_id);

create index if not exists organization_invitations_lower_email_idx
  on public.organization_invitations(lower(email));

create index if not exists organization_invitations_status_idx
  on public.organization_invitations(status);

create index if not exists organization_invitations_expires_at_idx
  on public.organization_invitations(expires_at);

alter table public.organization_invitations enable row level security;

create policy "Owners and managers can select organization invitations"
  on public.organization_invitations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = organization_invitations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.role in ('owner', 'manager')
        and organization_members.status = 'active'
    )
  );

create policy "Owners and managers can insert organization invitations"
  on public.organization_invitations
  for insert
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = organization_invitations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.role in ('owner', 'manager')
        and organization_members.status = 'active'
    )
  );

create policy "Owners and managers can update organization invitations"
  on public.organization_invitations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = organization_invitations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.role in ('owner', 'manager')
        and organization_members.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = organization_invitations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.role in ('owner', 'manager')
        and organization_members.status = 'active'
    )
  );
