begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email)
values
  ('33333333-3333-3333-3333-333333333333', 'medication-owner@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'medication-other@example.com');

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select is(
  public.create_medication_with_schedule(
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    'Tratamiento original',
    1,
    'tableta',
    '2026-11-12',
    '2026-12-11',
    '{"kind":"months","amount":1,"boundary":"inclusive"}',
    'daily',
    array['08:00'::time, '20:00'::time],
    'America/Bogota',
    '{"mode":"fixed"}'
  ),
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
  'create returns the medication id'
);
select results_eq(
  $$select count(*) from public.medications
    where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'$$,
  array[1::bigint], 'create inserts one medication'
);
select is(
  (
    select local_times from public.medication_schedules
    where medication_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'
      and retired_at is null
  ),
  array['08:00'::time, '20:00'::time],
  'create stores all exact daily times'
);

select is(
  public.create_medication_with_schedule(
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    'Reintento que no reemplaza',
    2,
    'tabletas',
    '2026-11-12',
    null,
    '{"kind":"indefinite","boundary":"inclusive"}',
    'daily',
    array['09:00'::time],
    'America/Bogota',
    '{"mode":"fixed"}'
  ),
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
  'repeated create is idempotent'
);
select results_eq(
  $$select name from public.medications
    where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'$$,
  array['Tratamiento original'],
  'idempotent retry does not overwrite the first request'
);

select is(
  public.update_medication_with_schedule(
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    'Tratamiento actualizado',
    1.5,
    'tabletas',
    '2026-11-12',
    '2026-11-25',
    '{"kind":"weeks","amount":2,"boundary":"inclusive"}',
    'interval',
    array['04:00'::time, '12:00'::time, '20:00'::time],
    'America/Bogota',
    '{"mode":"interval","firstTime":"20:00","intervalHours":8}'
  ),
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
  'update returns the medication id'
);
select results_eq(
  $$select name from public.medications
    where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'$$,
  array['Tratamiento actualizado'], 'update changes current data'
);
select results_eq(
  $$select count(*) from public.medication_schedules
    where medication_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'
      and retired_at is not null$$,
  array[1::bigint], 'update retires the previous schedule'
);
select results_eq(
  $$select count(*) from public.medication_versions
    where medication_id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'$$,
  array[1::bigint], 'update preserves the previous medication version'
);

select is(
  public.suspend_medication('dddddddd-dddd-dddd-dddd-ddddddddddd1'),
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
  'suspend returns the medication id'
);
select is(
  public.suspend_medication('dddddddd-dddd-dddd-dddd-ddddddddddd1'),
  'dddddddd-dddd-dddd-dddd-ddddddddddd1'::uuid,
  'repeated suspension is idempotent'
);
select results_eq(
  $$select status from public.medications
    where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'$$,
  array['paused'], 'suspend changes the current status'
);

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select throws_ok(
  $$select public.update_medication_with_schedule(
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    'Cruce', 1, 'tableta', '2026-11-12', null,
    '{"kind":"indefinite","boundary":"inclusive"}',
    'daily', array['10:00'::time], 'America/Bogota', '{"mode":"fixed"}'
  )$$,
  'P0002', null, 'another user cannot update the medication'
);

select * from finish();
rollback;
