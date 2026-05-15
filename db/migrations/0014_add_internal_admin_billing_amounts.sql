alter table public.organizations
  add column if not exists setup_amount numeric(12, 2),
  add column if not exists monthly_subscription_amount numeric(12, 2);

comment on column public.organizations.setup_amount is
  'Internal FalconDraft setup amount shown in the admin onboarding console.';

comment on column public.organizations.monthly_subscription_amount is
  'Internal FalconDraft monthly subscription amount shown in the admin onboarding console.';
