alter table public.deals enable row level security;
alter table public.documents enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_configs enable row level security;
alter table public.integrations enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'deals'
      and policyname = 'Active members can select organization deals'
  ) then
    execute $policy$
      create policy "Active members can select organization deals"
        on public.deals
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = deals.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'deals'
      and policyname = 'Active non-viewers can insert organization deals'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization deals"
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
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'deals'
      and policyname = 'Active non-viewers can update organization deals'
  ) then
    execute $policy$
      create policy "Active non-viewers can update organization deals"
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
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = deals.organization_id
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
      and tablename = 'documents'
      and policyname = 'Active members can select organization documents'
  ) then
    execute $policy$
      create policy "Active members can select organization documents"
        on public.documents
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = documents.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'Active non-viewers can insert organization documents'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization documents"
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
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'Active non-viewers can update organization documents'
  ) then
    execute $policy$
      create policy "Active non-viewers can update organization documents"
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
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = documents.organization_id
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
      and tablename = 'workflow_runs'
      and policyname = 'Active members can select organization workflow runs'
  ) then
    execute $policy$
      create policy "Active members can select organization workflow runs"
        on public.workflow_runs
        for select
        to authenticated
        using (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = workflow_runs.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workflow_runs'
      and policyname = 'Active non-viewers can insert organization workflow runs'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization workflow runs"
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
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workflow_runs'
      and policyname = 'Active owners and managers can update organization workflow runs'
  ) then
    execute $policy$
      create policy "Active owners and managers can update organization workflow runs"
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
              and organization_members.role in ('owner', 'manager')
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = workflow_runs.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workflow_configs'
      and policyname = 'Active owners and managers can select organization workflow configs'
  ) then
    execute $policy$
      create policy "Active owners and managers can select organization workflow configs"
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
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workflow_configs'
      and policyname = 'Active owners can insert organization workflow configs'
  ) then
    execute $policy$
      create policy "Active owners can insert organization workflow configs"
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
              and organization_members.role = 'owner'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workflow_configs'
      and policyname = 'Active owners can update organization workflow configs'
  ) then
    execute $policy$
      create policy "Active owners can update organization workflow configs"
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
              and organization_members.role = 'owner'
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = workflow_configs.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role = 'owner'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'integrations'
      and policyname = 'Active owners and managers can select organization integrations'
  ) then
    execute $policy$
      create policy "Active owners and managers can select organization integrations"
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
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'integrations'
      and policyname = 'Active owners and managers can insert organization integrations'
  ) then
    execute $policy$
      create policy "Active owners and managers can insert organization integrations"
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
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'integrations'
      and policyname = 'Active owners and managers can update organization integrations'
  ) then
    execute $policy$
      create policy "Active owners and managers can update organization integrations"
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
              and organization_members.role in ('owner', 'manager')
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = integrations.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and policyname = 'Active owners and managers can select organization billing subscriptions'
  ) then
    execute $policy$
      create policy "Active owners and managers can select organization billing subscriptions"
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
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and policyname = 'Active owners can insert organization billing subscriptions'
  ) then
    execute $policy$
      create policy "Active owners can insert organization billing subscriptions"
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
              and organization_members.role = 'owner'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and policyname = 'Active owners can update organization billing subscriptions'
  ) then
    execute $policy$
      create policy "Active owners can update organization billing subscriptions"
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
              and organization_members.role = 'owner'
          )
        )
        with check (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = billing_subscriptions.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role = 'owner'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'Active owners and managers can select organization audit logs'
  ) then
    execute $policy$
      create policy "Active owners and managers can select organization audit logs"
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
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'Active members can insert organization audit logs'
  ) then
    execute $policy$
      create policy "Active members can insert organization audit logs"
        on public.audit_logs
        for insert
        to authenticated
        with check (
          exists (
            select 1
            from public.organization_members
            where organization_members.organization_id = audit_logs.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;
end $$;
