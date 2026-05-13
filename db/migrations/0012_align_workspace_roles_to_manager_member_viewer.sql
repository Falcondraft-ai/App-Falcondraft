update public.organization_members
set role = 'manager'
where role in ('owner', 'admin');

update public.organization_members
set role = 'member'
where role not in ('manager', 'member', 'viewer');

update public.organization_invitations
set role = 'manager',
    updated_at = now()
where role = 'owner';

update public.organization_invitations
set role = 'member',
    updated_at = now()
where role not in ('manager', 'member', 'viewer');

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('manager', 'member', 'viewer'));

alter table public.organization_invitations
  drop constraint if exists organization_invitations_role_check;

alter table public.organization_invitations
  add constraint organization_invitations_role_check
  check (role in ('manager', 'member', 'viewer'));

drop policy if exists "Owners and managers can select organization invitations"
  on public.organization_invitations;

drop policy if exists "Owners and managers can insert organization invitations"
  on public.organization_invitations;

drop policy if exists "Owners and managers can update organization invitations"
  on public.organization_invitations;

drop policy if exists "Managers can select organization invitations"
  on public.organization_invitations;

drop policy if exists "Managers can insert organization invitations"
  on public.organization_invitations;

drop policy if exists "Managers can update organization invitations"
  on public.organization_invitations;

create policy "Managers can select organization invitations"
  on public.organization_invitations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = organization_invitations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.role = 'manager'
        and organization_members.status = 'active'
    )
  );

create policy "Managers can insert organization invitations"
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
        and organization_members.role = 'manager'
        and organization_members.status = 'active'
    )
  );

create policy "Managers can update organization invitations"
  on public.organization_invitations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = organization_invitations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.role = 'manager'
        and organization_members.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = organization_invitations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.role = 'manager'
        and organization_members.status = 'active'
    )
  );

drop policy if exists "Active non-viewers can insert organization deals"
  on public.deals;

drop policy if exists "Active non-viewers can update organization deals"
  on public.deals;

drop policy if exists "Active managers and members can insert organization deals"
  on public.deals;

drop policy if exists "Active managers and members can update organization deals"
  on public.deals;

create policy "Active managers and members can insert organization deals"
  on public.deals
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = deals.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role in ('manager', 'member')
    )
  );

create policy "Active managers and members can update organization deals"
  on public.deals
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = deals.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role in ('manager', 'member')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = deals.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role in ('manager', 'member')
    )
  );

drop policy if exists "Active non-viewers can insert organization documents"
  on public.documents;

drop policy if exists "Active non-viewers can update organization documents"
  on public.documents;

drop policy if exists "Active managers and members can insert organization documents"
  on public.documents;

drop policy if exists "Active managers and members can update organization documents"
  on public.documents;

create policy "Active managers and members can insert organization documents"
  on public.documents
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = documents.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role in ('manager', 'member')
    )
  );

create policy "Active managers and members can update organization documents"
  on public.documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = documents.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role in ('manager', 'member')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = documents.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role in ('manager', 'member')
    )
  );

drop policy if exists "Active non-viewers can insert organization workflow runs"
  on public.workflow_runs;

drop policy if exists "Active owners and managers can update organization workflow runs"
  on public.workflow_runs;

drop policy if exists "Active managers and members can insert organization workflow runs"
  on public.workflow_runs;

drop policy if exists "Active managers can update organization workflow runs"
  on public.workflow_runs;

create policy "Active managers and members can insert organization workflow runs"
  on public.workflow_runs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = workflow_runs.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role in ('manager', 'member')
    )
  );

create policy "Active managers can update organization workflow runs"
  on public.workflow_runs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = workflow_runs.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = workflow_runs.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

drop policy if exists "Active owners and managers can select organization workflow configs"
  on public.workflow_configs;

drop policy if exists "Active owners can insert organization workflow configs"
  on public.workflow_configs;

drop policy if exists "Active owners can update organization workflow configs"
  on public.workflow_configs;

drop policy if exists "Active managers can select organization workflow configs"
  on public.workflow_configs;

drop policy if exists "Active managers can insert organization workflow configs"
  on public.workflow_configs;

drop policy if exists "Active managers can update organization workflow configs"
  on public.workflow_configs;

create policy "Active managers can select organization workflow configs"
  on public.workflow_configs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = workflow_configs.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

create policy "Active managers can insert organization workflow configs"
  on public.workflow_configs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = workflow_configs.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

create policy "Active managers can update organization workflow configs"
  on public.workflow_configs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = workflow_configs.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = workflow_configs.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

drop policy if exists "Active owners and managers can select organization integrations"
  on public.integrations;

drop policy if exists "Active owners and managers can insert organization integrations"
  on public.integrations;

drop policy if exists "Active owners and managers can update organization integrations"
  on public.integrations;

drop policy if exists "Active managers can select organization integrations"
  on public.integrations;

drop policy if exists "Active managers can insert organization integrations"
  on public.integrations;

drop policy if exists "Active managers can update organization integrations"
  on public.integrations;

create policy "Active managers can select organization integrations"
  on public.integrations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = integrations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

create policy "Active managers can insert organization integrations"
  on public.integrations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = integrations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

create policy "Active managers can update organization integrations"
  on public.integrations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = integrations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = integrations.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

drop policy if exists "Active owners and managers can select organization billing subscriptions"
  on public.billing_subscriptions;

drop policy if exists "Active owners can insert organization billing subscriptions"
  on public.billing_subscriptions;

drop policy if exists "Active owners can update organization billing subscriptions"
  on public.billing_subscriptions;

drop policy if exists "Active managers can select organization billing subscriptions"
  on public.billing_subscriptions;

drop policy if exists "Active managers can insert organization billing subscriptions"
  on public.billing_subscriptions;

drop policy if exists "Active managers can update organization billing subscriptions"
  on public.billing_subscriptions;

create policy "Active managers can select organization billing subscriptions"
  on public.billing_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = billing_subscriptions.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

create policy "Active managers can insert organization billing subscriptions"
  on public.billing_subscriptions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = billing_subscriptions.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

create policy "Active managers can update organization billing subscriptions"
  on public.billing_subscriptions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = billing_subscriptions.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = billing_subscriptions.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

drop policy if exists "Active owners and managers can select organization audit logs"
  on public.audit_logs;

drop policy if exists "Active managers can select organization audit logs"
  on public.audit_logs;

create policy "Active managers can select organization audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = audit_logs.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
        and organization_members.role = 'manager'
    )
  );

notify pgrst, 'reload schema';
