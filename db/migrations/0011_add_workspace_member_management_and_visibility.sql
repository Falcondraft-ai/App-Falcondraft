alter table public.organizations
  add column if not exists allow_member_company_visibility boolean not null default true;

comment on column public.organizations.allow_member_company_visibility is
  'Controls whether non-manager workspace members can open organization-wide dossier and document views.';

create index if not exists deals_organization_created_by_idx
  on public.deals(organization_id, created_by);

drop policy if exists "Active members can select organization deals"
  on public.deals;

create policy "Active members can select visible organization deals"
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
        and (
          organization_members.role = 'manager'
          or deals.created_by = (select auth.uid())
          or (
            organization_members.role in ('member', 'viewer')
            and exists (
              select 1
              from public.organizations
              where organizations.id = deals.organization_id
                and organizations.allow_member_company_visibility is true
            )
          )
        )
    )
  );

drop policy if exists "Active members can select organization documents"
  on public.documents;

create policy "Active members can select visible organization documents"
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
        and exists (
          select 1
          from public.deals
          where deals.id = documents.deal_id
            and deals.organization_id = documents.organization_id
            and (
              organization_members.role = 'manager'
              or deals.created_by = (select auth.uid())
              or (
                organization_members.role in ('member', 'viewer')
                and exists (
                  select 1
                  from public.organizations
                  where organizations.id = documents.organization_id
                    and organizations.allow_member_company_visibility is true
                )
              )
            )
        )
    )
  );

drop policy if exists "Active members can select organization workflow runs"
  on public.workflow_runs;

create policy "Active members can select visible organization workflow runs"
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
        and exists (
          select 1
          from public.deals
          where deals.id = workflow_runs.deal_id
            and deals.organization_id = workflow_runs.organization_id
            and (
              organization_members.role = 'manager'
              or deals.created_by = (select auth.uid())
              or (
                organization_members.role in ('member', 'viewer')
                and exists (
                  select 1
                  from public.organizations
                  where organizations.id = workflow_runs.organization_id
                    and organizations.allow_member_company_visibility is true
                )
              )
            )
        )
    )
  );

notify pgrst, 'reload schema';
