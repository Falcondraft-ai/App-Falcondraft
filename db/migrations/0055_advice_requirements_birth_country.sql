-- Devoir de conseil: a dedicated, AI-generated "exigences en termes de garantie"
-- field (kept separate from the justification "content" so the editor stays
-- clean), plus the client's country of birth for the identity section.
alter table public.broker_advice
  add column if not exists requirements text;

alter table public.broker_clients
  add column if not exists birth_country text;
