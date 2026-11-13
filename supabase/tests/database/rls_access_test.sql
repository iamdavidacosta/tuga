begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com');

insert into public.medications (
  id, user_id, name, dosage_amount, dosage_unit, start_date
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111111',
    'Medicamento del propietario', 1, 'tableta', '2026-11-12'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '22222222-2222-2222-2222-222222222222',
    'Medicamento del otro usuario', 1, 'tableta', '2026-11-12'
  );

insert into public.medication_schedules (
  id, medication_id, user_id, schedule_type, local_times,
  effective_from, treatment_start, medication_name, dosage_amount, dosage_unit
)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111111',
    'daily', array['08:00'::time], '2026-11-12 05:00:00+00', '2026-11-12',
    'Medicamento del propietario', 1, 'tableta'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '22222222-2222-2222-2222-222222222222',
    'daily', array['09:00'::time], '2026-11-12 05:00:00+00', '2026-11-12',
    'Medicamento del otro usuario', 1, 'tableta'
  );

insert into public.dose_occurrences (
  id, medication_id, schedule_id, user_id, scheduled_at,
  medication_name, dosage_amount, dosage_unit
)
values
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    '11111111-1111-1111-1111-111111111111',
    '2026-11-12 13:00:00+00', 'Medicamento del propietario', 1, 'tableta'
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    '22222222-2222-2222-2222-222222222222',
    '2026-11-12 14:00:00+00', 'Medicamento del otro usuario', 1, 'tableta'
  );

set local role anon;

select throws_ok(
  $$select * from public.profiles$$,
  '42501', null, 'anon cannot read profiles'
);
select throws_ok(
  $$select * from public.medications$$,
  '42501', null, 'anon cannot read medications'
);
select throws_ok(
  $$select * from public.medication_schedules$$,
  '42501', null, 'anon cannot read schedules'
);
select throws_ok(
  $$select * from public.dose_occurrences$$,
  '42501', null, 'anon cannot read occurrences'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select count(*) from public.profiles$$,
  array[1::bigint], 'owner reads only their profile'
);
select results_eq(
  $$delete from public.profiles
    where user_id = '11111111-1111-1111-1111-111111111111'
    returning user_id$$,
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'owner deletes their profile'
);
select results_eq(
  $$insert into public.profiles (user_id, display_name)
    values ('11111111-1111-1111-1111-111111111111', 'Marta')
    returning display_name$$,
  array['Marta'], 'owner creates their profile'
);
select results_eq(
  $$update public.profiles set display_name = 'Marta TUGA'
    returning display_name$$,
  array['Marta TUGA'], 'owner updates their profile'
);
select results_eq(
  $$select count(*) from public.medications$$,
  array[1::bigint], 'owner reads only their medications'
);
select results_eq(
  $$select count(*) from public.medication_schedules$$,
  array[1::bigint], 'owner reads only their schedules'
);
select results_eq(
  $$select count(*) from public.dose_occurrences$$,
  array[1::bigint], 'owner reads only their occurrences'
);
select results_eq(
  $$insert into public.medications (
      name, dosage_amount, dosage_unit, start_date
    ) values ('Nuevo', 1, 'tableta', '2026-11-12')
    returning name$$,
  array['Nuevo'], 'owner creates a medication with auth.uid default'
);
select results_eq(
  $$update public.medications set name = 'Nuevo actualizado'
    where name = 'Nuevo' returning name$$,
  array['Nuevo actualizado'], 'owner updates their medication'
);
select results_eq(
  $$select count(*) from public.medication_versions$$,
  array[1::bigint], 'owner reads the history created by their update'
);
select results_eq(
  $$delete from public.medications where name = 'Nuevo actualizado'
    returning name$$,
  array['Nuevo actualizado'], 'owner deletes their medication'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select results_eq(
  $$select count(*) from public.profiles$$,
  array[1::bigint], 'other user reads only their profile'
);
select results_eq(
  $$select count(*) from public.medications$$,
  array[1::bigint], 'other user reads only their medication'
);
select results_eq(
  $$select count(*) from public.medication_schedules$$,
  array[1::bigint], 'other user reads only their schedule'
);
select results_eq(
  $$select count(*) from public.dose_occurrences$$,
  array[1::bigint], 'other user reads only their occurrence'
);
select results_eq(
  $$select count(*) from public.medication_versions$$,
  array[0::bigint], 'other user cannot read owner medication history'
);
select throws_ok(
  $$insert into public.medication_versions (
      medication_id, user_id, name, dosage_amount, dosage_unit,
      start_date, duration_config, status, valid_from, valid_to
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      '22222222-2222-2222-2222-222222222222',
      'Historia falsa', 1, 'tableta', '2026-11-12',
      '{"kind":"indefinite","boundary":"inclusive"}',
      'active', now(), now()
    )$$,
  '42501', null, 'authenticated clients cannot forge medication history'
);
select throws_ok(
  $$insert into public.medications (
      user_id, name, dosage_amount, dosage_unit, start_date
    ) values (
      '11111111-1111-1111-1111-111111111111',
      'Cruce', 1, 'tableta', '2026-11-12'
    )$$,
  '42501', null, 'other user cannot create medication for owner'
);
select is_empty(
  $$update public.medications set name = 'Alterado'
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
    returning id$$,
  'other user cannot update owner medication'
);
select is_empty(
  $$delete from public.medications
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
    returning id$$,
  'other user cannot delete owner medication'
);
select throws_ok(
  $$insert into public.medication_schedules (
      medication_id, user_id, schedule_type, local_times,
      effective_from, treatment_start, medication_name, dosage_amount, dosage_unit
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      '22222222-2222-2222-2222-222222222222',
      'daily', array['10:00'::time], '2026-11-12 05:00:00+00', '2026-11-12',
      'Cruce', 1, 'tableta'
    )$$,
  '23503', null, 'schedule cannot reference another user medication'
);
select throws_ok(
  $$insert into public.dose_occurrences (
      medication_id, schedule_id, user_id, scheduled_at
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
      '22222222-2222-2222-2222-222222222222',
      '2026-11-13 13:00:00+00'
    )$$,
  '42501', null, 'clients cannot insert occurrences directly'
);
select throws_ok(
  $$update public.dose_occurrences set status = 'skipped'
    where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
    returning id$$,
  '42501', null, 'clients cannot update occurrences directly'
);
select throws_ok(
  $$delete from public.dose_occurrences
    where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
    returning id$$,
  '42501', null, 'clients cannot delete occurrences directly'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select name from public.medications
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$$,
  array['Medicamento del propietario'],
  'denied cross-user writes left owner medication intact'
);
select throws_ok(
  $$update public.medications
    set user_id = '22222222-2222-2222-2222-222222222222'
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$$,
  '42501', null, 'owner cannot reassign a medication'
);
select throws_ok(
  $$update public.dose_occurrences set status = 'taken'
    where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'$$,
  '42501', null, 'owner cannot bypass atomic confirmation'
);
select throws_ok(
  $$update public.dose_occurrences
    set status = 'taken', taken_at = '2026-11-12 13:05:00+00'
    where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
    returning status$$,
  '42501', null, 'owner confirms only through the protected function'
);
select throws_ok(
  $$delete from public.dose_occurrences
    where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
    returning id$$,
  '42501', null, 'owner cannot delete occurrence history directly'
);

select * from finish();
rollback;
