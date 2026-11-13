begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email)
values
  ('55555555-5555-5555-5555-555555555555', 'dose-owner@example.com'),
  ('66666666-6666-6666-6666-666666666666', 'dose-other@example.com');

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

update public.profiles set timezone = 'America/New_York';
select is(
  (select display_timezone from public.get_dose_context()),
  'America/New_York',
  'the dose context follows the timezone configured in the user profile'
);
update public.profiles set timezone = 'America/Bogota';

select public.create_medication_with_schedule(
  'aaaaaaaa-0000-0000-0000-000000000001', 'Una vez al día', 1, 'tableta',
  '2026-11-12', '2026-11-14', '{"kind":"days","amount":3,"boundary":"inclusive"}',
  'daily', array['08:00'::time], 'America/Bogota', '{"mode":"fixed"}'
);
select public.ensure_dose_occurrences('2026-11-12', '2026-11-14');
select results_eq(
  $$select count(*) from public.dose_occurrences
    where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  array[3::bigint], 'one daily time generates one occurrence per inclusive treatment day'
);

select public.create_medication_with_schedule(
  'aaaaaaaa-0000-0000-0000-000000000002', 'Tres veces al día', 1, 'cápsula',
  '2026-11-12', '2026-11-14', '{"kind":"days","amount":3,"boundary":"inclusive"}',
  'daily', array['06:00'::time, '14:00'::time, '22:00'::time],
  'America/Bogota', '{"mode":"fixed"}'
);
select public.ensure_dose_occurrences('2026-11-12', '2026-11-14');
select results_eq(
  $$select count(*) from public.dose_occurrences
    where medication_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  array[9::bigint], 'three daily times generate three occurrences per day'
);

select public.create_medication_with_schedule(
  'aaaaaaaa-0000-0000-0000-000000000003', 'Dos meses', 2, 'ml',
  '2026-12-01', '2027-01-31', '{"kind":"months","amount":2,"boundary":"inclusive"}',
  'daily', array['10:00'::time], 'America/Bogota', '{"mode":"fixed"}'
);
select public.ensure_dose_occurrences('2026-12-01', '2027-01-31');
select results_eq(
  $$select count(*) from public.dose_occurrences
    where medication_id = 'aaaaaaaa-0000-0000-0000-000000000003'$$,
  array[62::bigint], 'two calendar months honor their inclusive calendar boundaries'
);
select results_eq(
  $$select distinct (scheduled_at at time zone 'America/Bogota')::date
    from public.dose_occurrences where medication_id = 'aaaaaaaa-0000-0000-0000-000000000003'
      and (scheduled_at at time zone 'America/Bogota')::date in ('2026-12-31', '2027-01-01')
    order by (scheduled_at at time zone 'America/Bogota')::date$$,
  array['2026-12-31'::date, '2027-01-01'::date],
  'generation crosses month and year boundaries without gaps'
);

select public.create_medication_with_schedule(
  'aaaaaaaa-0000-0000-0000-000000000004', 'Cruce de medianoche', 1, 'tableta',
  '2026-11-12', '2026-11-12', '{"kind":"days","amount":1,"boundary":"inclusive"}',
  'daily', array['00:30'::time, '23:30'::time], 'America/Bogota', '{"mode":"fixed"}'
);
select public.ensure_dose_occurrences('2026-11-12', '2026-11-12');
select results_eq(
  $$select to_char(scheduled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
    from public.dose_occurrences where medication_id = 'aaaaaaaa-0000-0000-0000-000000000004'
    order by scheduled_at$$,
  array['2026-11-12 05:30', '2026-11-13 04:30'],
  'local times around midnight are stored as the correct UTC instants'
);

select public.create_medication_with_schedule(
  'aaaaaaaa-0000-0000-0000-000000000005', 'Horario de verano', 1, 'tableta',
  '2026-03-07', '2026-03-09', '{"kind":"days","amount":3,"boundary":"inclusive"}',
  'daily', array['08:00'::time], 'America/New_York', '{"mode":"fixed"}'
);
select public.ensure_dose_occurrences('2026-03-07', '2026-03-09');
select results_eq(
  $$select extract(hour from scheduled_at)::integer
    from public.dose_occurrences where medication_id = 'aaaaaaaa-0000-0000-0000-000000000005'
    order by scheduled_at$$,
  array[13, 12, 12],
  'the same local time follows the daylight-saving offset change'
);

select is(
  (select occurrence_status from public.confirm_dose_occurrence(
    (select id from public.dose_occurrences
     where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     order by scheduled_at limit 1)
  )),
  'taken', 'explicit confirmation changes a pending occurrence to taken'
);
select ok(
  (select taken_at is not null from public.dose_occurrences
   where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   order by scheduled_at limit 1),
  'confirmation records the real confirmation instant'
);
select public.confirm_dose_occurrence(
  (select id from public.dose_occurrences
   where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   order by scheduled_at limit 1)
);
select results_eq(
  $$select count(*) from public.dose_occurrence_events
    where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001' and new_status = 'taken'$$,
  array[1::bigint], 'a repeated confirmation is idempotent and creates no duplicate event'
);

select is(
  (select occurrence_status from public.correct_dose_occurrence(
    (select id from public.dose_occurrences
     where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     order by scheduled_at limit 1)
  )),
  'pending', 'an accidental confirmation can be corrected to pending'
);
select is(
  (select occurrence_status from public.skip_dose_occurrence(
    (select id from public.dose_occurrences
     where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     order by scheduled_at limit 1)
  )),
  'skipped', 'omission requires its own explicit transition'
);
select public.correct_dose_occurrence(
  (select id from public.dose_occurrences
   where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   order by scheduled_at limit 1)
);
select public.confirm_dose_occurrence(
  (select id from public.dose_occurrences
   where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   order by scheduled_at limit 1)
);

select public.update_medication_with_schedule(
  'aaaaaaaa-0000-0000-0000-000000000001', 'Una vez al día actualizada', 1, 'tableta',
  '2026-11-12', '2026-11-14', '{"kind":"days","amount":3,"boundary":"inclusive"}',
  'daily', array['09:00'::time], 'America/Bogota', '{"mode":"fixed"}'
);
select results_eq(
  $$select count(*) from public.dose_occurrences
    where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'taken'$$,
  array[1::bigint], 'editing a future schedule preserves confirmed history'
);
select results_eq(
  $$select count(*) from public.dose_occurrences as occurrence
    join public.medication_schedules as schedule on schedule.id = occurrence.schedule_id
    where occurrence.medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and schedule.retired_at is not null and occurrence.status = 'pending'
      and occurrence.scheduled_at >= transaction_timestamp()$$,
  array[0::bigint], 'editing removes only future pending occurrences from the retired schedule'
);
select ok(
  (select count(*) > 0 from public.dose_occurrences as occurrence
   join public.medication_schedules as schedule on schedule.id = occurrence.schedule_id
   where occurrence.medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and schedule.retired_at is null and occurrence.scheduled_at >= transaction_timestamp()),
  'editing generates bounded future occurrences for the replacement schedule'
);

select public.suspend_medication('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  $$select count(*) from public.dose_occurrences
    where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and status = 'pending' and scheduled_at >= transaction_timestamp()$$,
  array[0::bigint], 'suspending a treatment removes its future pending occurrences'
);
select results_eq(
  $$select count(*) from public.dose_occurrences
    where medication_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'taken'$$,
  array[1::bigint], 'suspending a treatment preserves confirmed history'
);

select throws_ok(
  $$select public.ensure_dose_occurrences('2026-01-01', '2026-04-01')$$,
  '22023', null, 'occurrence generation rejects an unbounded horizon'
);
select public.ensure_dose_occurrences('2026-11-12', '2026-11-14');
select public.ensure_dose_occurrences('2026-11-12', '2026-11-14');
select results_eq(
  $$select count(*) from public.dose_occurrences
    where medication_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  array[9::bigint], 'repeated generation never duplicates an occurrence'
);

create temp table test_owner_occurrence (id uuid not null);
insert into test_owner_occurrence
select id from public.dose_occurrences
where medication_id = 'aaaaaaaa-0000-0000-0000-000000000002'
order by scheduled_at limit 1;

set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select throws_ok(
  $$select public.confirm_dose_occurrence(
    (select id from test_owner_occurrence limit 1)
  )$$,
  'P0002', null, 'another user cannot confirm an occurrence they do not own'
);
select results_eq(
  $$select count(*) from public.dose_occurrences$$,
  array[0::bigint], 'RLS hides all owner occurrences from another user'
);
select results_eq(
  $$select count(*) from public.dose_occurrence_events$$,
  array[0::bigint], 'RLS hides all owner transition history from another user'
);

select * from finish();
rollback;
