-- ============================================================================
-- 0032_create_broker_documents
--
-- Document management ("GED") for the insurance-broker module.
--
--   public.broker_documents       — metadata for each stored file
--   storage bucket 'broker-files' — the actual files, path {org}/{client}/{uuid}-{name}
--
-- Files are uploaded from the browser via short-lived signed upload URLs minted
-- by the server (service role), and downloaded via signed URLs. Storage usage
-- is accounted on public.organizations.storage_used_bytes (see 0030) through the
-- application, with quota enforced server-side before minting an upload URL.
-- ============================================================================

create table if not exists public.broker_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.broker_clients(id) on delete cascade,
  uploaded_by uuid not null,
  category text not null default 'other',
  title text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  status text not null default 'stored',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_documents_category_check
    check (category in ('contract', 'id_document', 'rib', 'company_quote', 'advice_document', 'other')),
  constraint broker_documents_size_nonneg_check
    check (size_bytes >= 0)
);

create index if not exists broker_documents_organization_id_idx on public.broker_documents(organization_id);
create index if not exists broker_documents_client_id_idx on public.broker_documents(client_id);
create index if not exists broker_documents_category_idx on public.broker_documents(category);
create index if not exists broker_documents_created_at_idx on public.broker_documents(created_at);

grant select, insert, update, delete on public.broker_documents to authenticated;
grant select, insert, update, delete on public.broker_documents to service_role;

alter table public.broker_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_documents'
      and policyname = 'Active members can select organization broker documents'
  ) then
    execute $policy$
      create policy "Active members can select organization broker documents"
        on public.broker_documents for select to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_documents.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_documents'
      and policyname = 'Active non-viewers can insert organization broker documents'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization broker documents"
        on public.broker_documents for insert to authenticated
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_documents.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_documents'
      and policyname = 'Active non-viewers can delete organization broker documents'
  ) then
    execute $policy$
      create policy "Active non-viewers can delete organization broker documents"
        on public.broker_documents for delete to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_documents.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Storage bucket (private). Per-file hard cap 50 MB; the per-workspace quota is
-- enforced by the application on organizations.storage_used_bytes.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('broker-files', 'broker-files', false, 52428800)
on conflict (id) do nothing;

-- Defense-in-depth storage policies: org members can only touch files under
-- their own organization_id prefix. (Server flows use the service role + signed
-- URLs, which bypass these — but these guard any future direct client access.)
create policy "Broker org members can upload files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'broker-files'
    and (storage.foldername(name))[1] in (
      select om.organization_id::text
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy "Broker org members can read their org files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'broker-files'
    and (storage.foldername(name))[1] in (
      select om.organization_id::text
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy "Broker org members can delete their org files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'broker-files'
    and (storage.foldername(name))[1] in (
      select om.organization_id::text
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
    )
  );
