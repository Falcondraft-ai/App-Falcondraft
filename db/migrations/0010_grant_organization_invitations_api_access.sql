grant usage on schema public to authenticated, service_role;

grant select, insert, update
  on table public.organization_invitations
  to authenticated, service_role;

revoke delete
  on table public.organization_invitations
  from authenticated;

notify pgrst, 'reload schema';
