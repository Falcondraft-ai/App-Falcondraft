-- Create storage bucket for transcript audio files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transcripts-audio',
  'transcripts-audio',
  false,
  104857600, -- 100 MB
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/webm']
)
on conflict (id) do nothing;

-- RLS policies for the bucket: users can only access their organization's files
create policy "Org members can upload audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'transcripts-audio'
    and (storage.foldername(name))[1] in (
      select om.organization_id::text
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy "Org members can read their org audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'transcripts-audio'
    and (storage.foldername(name))[1] in (
      select om.organization_id::text
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

create policy "Org members can delete their org audio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'transcripts-audio'
    and (storage.foldername(name))[1] in (
      select om.organization_id::text
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.status = 'active'
    )
  );
