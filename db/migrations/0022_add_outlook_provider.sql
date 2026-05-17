alter table public.email_connections
  drop constraint if exists email_connections_provider_check;

alter table public.email_connections
  add constraint email_connections_provider_check
    check (provider in ('gmail', 'outlook'));
