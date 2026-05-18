-- ============================================================================
-- 0023_add_core_rls_policies
--
-- Enables RLS on organizations, organization_members, and profiles.
-- Uses SECURITY DEFINER helper functions to avoid recursive RLS evaluation
-- (a policy on organization_members must not query organization_members
--  directly — that would cause infinite recursion).
--
-- Policies are SELECT-only. All mutations continue through the service_role
-- admin client (lib/supabase/admin.ts), which bypasses RLS entirely.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER — bypass RLS via owner privileges)
-- --------------------------------------------------------------------------

create or replace function public.is_active_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where public.organization_members.organization_id = target_org_id
      and public.organization_members.user_id = auth.uid()
      and public.organization_members.status = 'active'
  );
$$;

revoke all on function public.is_active_org_member(uuid) from public;
revoke all on function public.is_active_org_member(uuid) from anon;
grant execute on function public.is_active_org_member(uuid) to authenticated;

create or replace function public.can_view_profile(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select
    -- The user can always see their own profile.
    auth.uid() = target_user_id
    -- OR the user shares at least one active organization with the target.
    or exists (
      select 1
      from public.organization_members as my_membership
      join public.organization_members as their_membership
        on their_membership.organization_id = my_membership.organization_id
      where my_membership.user_id = auth.uid()
        and my_membership.status = 'active'
        and their_membership.user_id = target_user_id
        and their_membership.status = 'active'
    );
$$;

revoke all on function public.can_view_profile(uuid) from public;
revoke all on function public.can_view_profile(uuid) from anon;
grant execute on function public.can_view_profile(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- Enable RLS
-- --------------------------------------------------------------------------

alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.profiles              enable row level security;

-- --------------------------------------------------------------------------
-- organizations — SELECT policy
-- --------------------------------------------------------------------------

drop policy if exists "Active members can select own organization"
  on public.organizations;

create policy "Active members can select own organization"
  on public.organizations
  for select
  to authenticated
  using (public.is_active_org_member(organizations.id));

-- --------------------------------------------------------------------------
-- organization_members — SELECT policy
-- --------------------------------------------------------------------------

drop policy if exists "Active members can select co-members"
  on public.organization_members;

create policy "Active members can select co-members"
  on public.organization_members
  for select
  to authenticated
  using (public.is_active_org_member(organization_members.organization_id));

-- --------------------------------------------------------------------------
-- profiles — SELECT policies (own profile + co-member profiles)
-- --------------------------------------------------------------------------

drop policy if exists "Users can select own profile"
  on public.profiles;

create policy "Users can select own profile"
  on public.profiles
  for select
  to authenticated
  using (public.can_view_profile(profiles.user_id));

-- --------------------------------------------------------------------------
-- Grant minimal SELECT privileges
-- --------------------------------------------------------------------------

grant select on table public.organizations        to authenticated;
grant select on table public.organization_members to authenticated;
grant select on table public.profiles             to authenticated;

-- ============================================================================
-- Rollback (run manually if RLS causes lockouts):
--
--   alter table public.organizations         disable row level security;
--   alter table public.organization_members  disable row level security;
--   alter table public.profiles              disable row level security;
--
-- To drop only the policies:
--
--   drop policy if exists "Active members can select own organization" on public.organizations;
--   drop policy if exists "Active members can select co-members" on public.organization_members;
--   drop policy if exists "Users can select own profile" on public.profiles;
--
-- To drop the helper functions:
--
--   drop function if exists public.is_active_org_member(uuid);
--   drop function if exists public.can_view_profile(uuid);
--
-- ============================================================================
