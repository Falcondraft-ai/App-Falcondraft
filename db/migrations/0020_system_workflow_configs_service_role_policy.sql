create policy "service_role_full_access"
on public.system_workflow_configs
as permissive
for all
to service_role
using (true)
with check (true);
