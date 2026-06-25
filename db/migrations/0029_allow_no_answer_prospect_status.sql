alter table public.prospect_companies
  drop constraint if exists prospect_companies_status_check;

alter table public.prospect_companies
  add constraint prospect_companies_status_check
  check (
    status = any (
      array[
        'new'::text,
        'to_call'::text,
        'called'::text,
        'no_answer'::text,
        'to_follow_up'::text,
        'interested'::text,
        'meeting_booked'::text,
        'not_interested'::text,
        'bad_fit'::text,
        'do_not_contact'::text,
        'client'::text,
        'archived'::text
      ]
    )
  );
