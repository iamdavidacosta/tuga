begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'push_subscriptions', 'push_subscriptions exists');
select has_table('public', 'notification_deliveries', 'notification_deliveries exists');
select has_table('public', 'dose_reminders', 'dose_reminders exists');
select has_table('public', 'push_test_requests', 'push_test_requests exists');
select results_eq(
  $$select count(*) from pg_class
    where oid in (
      'public.push_subscriptions'::regclass,
      'public.notification_deliveries'::regclass,
      'public.dose_reminders'::regclass,
      'public.push_test_requests'::regclass
    ) and relrowsecurity and relforcerowsecurity$$,
  array[4::bigint], 'all notification tables enable and force RLS'
);
select results_eq(
  $$select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('push_subscriptions', 'notification_deliveries', 'dose_reminders', 'push_test_requests')$$,
  array[16::bigint], 'notification tables have separate CRUD policies'
);

insert into auth.users (id, email)
values
  ('88888888-8888-8888-8888-888888888888', 'push-owner@example.com'),
  ('99999999-9999-9999-9999-999999999999', 'push-other@example.com');

insert into public.medications (id, user_id, name, dosage_amount, dosage_unit, start_date, status)
values
  ('a0000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', 'Pendiente', 1, 'tableta', current_date, 'active'),
  ('a0000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', 'Confirmada', 1, 'tableta', current_date, 'active'),
  ('a0000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', 'Suspendida', 1, 'tableta', current_date, 'paused'),
  ('a0000000-0000-0000-0000-000000000004', '99999999-9999-9999-9999-999999999999', 'Otro usuario', 1, 'tableta', current_date, 'active');

insert into public.medication_schedules (
  id, medication_id, user_id, schedule_type, local_times, timezone,
  effective_from, treatment_start, medication_name, dosage_amount, dosage_unit
)
select
  schedule_id, medication_id, user_id, 'daily', array['08:00'::time], 'America/Bogota',
  current_date::timestamp at time zone 'America/Bogota', current_date, medication_name, 1, 'tableta'
from (values
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, '88888888-8888-8888-8888-888888888888'::uuid, 'Pendiente'),
  ('b0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, '88888888-8888-8888-8888-888888888888'::uuid, 'Confirmada'),
  ('b0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000003'::uuid, '88888888-8888-8888-8888-888888888888'::uuid, 'Suspendida'),
  ('b0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000004'::uuid, '99999999-9999-9999-9999-999999999999'::uuid, 'Otro usuario')
) as fixture(schedule_id, medication_id, user_id, medication_name);

insert into public.dose_occurrences (
  id, medication_id, schedule_id, user_id, scheduled_at, status, taken_at,
  medication_name, dosage_amount, dosage_unit
)
values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', clock_timestamp() - interval '1 minute', 'pending', null, 'Pendiente', 1, 'tableta'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', clock_timestamp() - interval '1 minute', 'taken', clock_timestamp(), 'Confirmada', 1, 'tableta'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', clock_timestamp() - interval '1 minute', 'pending', null, 'Suspendida', 1, 'tableta'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', '99999999-9999-9999-9999-999999999999', clock_timestamp() - interval '1 minute', 'pending', null, 'Otro usuario', 1, 'tableta');

set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';

select ok(
  public.upsert_push_subscription(
    'https://push.example.test/owner-phone', repeat('A', 65), repeat('B', 16), null, 'Android'
  ) is not null,
  'an authenticated user registers a subscription derived from auth.uid'
);
select ok(
  public.upsert_push_subscription(
    'https://push.example.test/owner-tablet', repeat('C', 65), repeat('D', 16), null, 'Tablet'
  ) is not null,
  'the same user can register a second device'
);
select results_eq(
  $$select active_devices from public.get_push_notification_status('https://push.example.test/owner-phone')$$,
  array[2::bigint], 'notification status reports both active devices'
);
select throws_ok(
  $$select public.upsert_push_subscription('http://insecure.test/a', repeat('A', 65), repeat('B', 16), null, 'Inválida')$$,
  '22023', null, 'an invalid or insecure subscription is rejected'
);
select ok(
  public.postpone_dose_occurrence('c0000000-0000-0000-0000-000000000001') > clock_timestamp(),
  'a pending occurrence can be postponed for fifteen minutes'
);
select throws_ok(
  $$select * from public.begin_push_test('88888888-8888-8888-8888-888888888888')$$,
  '42501', null, 'clients cannot read raw push targets through the diagnostic RPC'
);
select throws_ok(
  $$select * from public.claim_due_notification_deliveries(100)$$,
  '42501', null, 'an ordinary authenticated user cannot invoke the scheduler operation'
);

set local request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select is(
  public.deactivate_push_subscription('https://push.example.test/owner-phone'),
  false, 'another user cannot deactivate an owner subscription'
);
select throws_ok(
  $$select public.postpone_dose_occurrence('c0000000-0000-0000-0000-000000000001')$$,
  'P0002', null, 'another user cannot postpone an owner occurrence'
);
select throws_ok(
  $$select public.upsert_push_subscription(
    'https://push.example.test/owner-phone', repeat('E', 65), repeat('F', 16), null, 'Cruce'
  )$$,
  '23505', null, 'another account cannot take over an existing endpoint'
);

reset role;
set local role service_role;
set local request.jwt.claim.role = 'service_role';

create temp table first_claim as
select * from public.claim_due_notification_deliveries(100);

select results_eq(
  $$select count(*) from public.begin_push_test('88888888-8888-8888-8888-888888888888')
    where subscription_id is not null$$,
  array[2::bigint], 'the service diagnostic targets every active device'
);
select throws_ok(
  $$select * from public.begin_push_test('88888888-8888-8888-8888-888888888888')$$,
  'P0001', null, 'the diagnostic is rate limited per user'
);

select results_eq(
  $$select count(*) from first_claim$$,
  array[2::bigint], 'one pending occurrence creates one claimed delivery per active device'
);
select results_eq(
  $$select count(*) from public.notification_deliveries
    where occurrence_id = 'c0000000-0000-0000-0000-000000000002'$$,
  array[0::bigint], 'a confirmed occurrence never creates a reminder delivery'
);
select results_eq(
  $$select count(*) from public.notification_deliveries
    where occurrence_id = 'c0000000-0000-0000-0000-000000000003'$$,
  array[0::bigint], 'a suspended treatment never creates a reminder delivery'
);
select results_eq(
  $$select count(*) from public.claim_due_notification_deliveries(100)$$,
  array[0::bigint], 'a concurrent or repeated worker cannot claim the same deliveries twice'
);
select results_eq(
  $$select count(*) from public.notification_deliveries
    where occurrence_id = 'c0000000-0000-0000-0000-000000000001'$$,
  array[2::bigint], 'idempotency prevents duplicate rows during repeated executions'
);

select is(
  public.complete_notification_delivery(
    (select delivery_id from first_claim order by endpoint limit 1),
    (select claim_token from first_claim order by endpoint limit 1),
    'accepted', 201, null
  ),
  'accepted', 'provider acceptance is recorded without calling it guaranteed delivery'
);
select is(
  public.complete_notification_delivery(
    (select delivery_id from first_claim order by endpoint desc limit 1),
    (select claim_token from first_claim order by endpoint desc limit 1),
    'expired', 410, 'subscription_expired'
  ),
  'expired', 'an expired provider subscription is recorded'
);
select results_eq(
  $$select count(*) from public.push_subscriptions
    where user_id = '88888888-8888-8888-8888-888888888888' and active$$,
  array[1::bigint], 'a 410 response disables only the invalid subscription'
);

update public.dose_reminders
set created_at = clock_timestamp() - interval '1 hour',
    remind_at = clock_timestamp() - interval '1 minute'
where occurrence_id = 'c0000000-0000-0000-0000-000000000001' and status = 'scheduled';
create temp table snooze_claim as
select * from public.claim_due_notification_deliveries(100);
select results_eq(
  $$select count(*) from snooze_claim$$,
  array[1::bigint], 'a due postponed reminder targets the remaining active device once'
);
select is(
  public.complete_notification_delivery(
    (select delivery_id from snooze_claim), (select claim_token from snooze_claim),
    'accepted', 201, null
  ),
  'accepted', 'a postponed reminder completes normally'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select public.postpone_dose_occurrence('c0000000-0000-0000-0000-000000000001');
select public.postpone_dose_occurrence('c0000000-0000-0000-0000-000000000001');
select throws_ok(
  $$select public.postpone_dose_occurrence('c0000000-0000-0000-0000-000000000001')$$,
  'P0001', null, 'postponing is bounded to three reminders'
);
select public.confirm_dose_occurrence('c0000000-0000-0000-0000-000000000001');
reset role;
select results_eq(
  $$select count(*) from public.dose_reminders
    where occurrence_id = 'c0000000-0000-0000-0000-000000000001' and status = 'scheduled'$$,
  array[0::bigint], 'confirming a dose cancels its outstanding postponed reminder'
);

insert into public.medications (id, user_id, name, dosage_amount, dosage_unit, start_date, status)
values ('a0000000-0000-0000-0000-000000000005', '88888888-8888-8888-8888-888888888888', 'Reintento', 1, 'tableta', current_date, 'active');
insert into public.medication_schedules (
  id, medication_id, user_id, schedule_type, local_times, timezone,
  effective_from, treatment_start, medication_name, dosage_amount, dosage_unit
) values (
  'b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005',
  '88888888-8888-8888-8888-888888888888', 'daily', array['08:00'::time], 'America/Bogota',
  current_date::timestamp at time zone 'America/Bogota', current_date, 'Reintento', 1, 'tableta'
);
insert into public.dose_occurrences (
  id, medication_id, schedule_id, user_id, scheduled_at, medication_name, dosage_amount, dosage_unit
) values (
  'c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000005', '88888888-8888-8888-8888-888888888888',
  clock_timestamp() - interval '1 minute', 'Reintento', 1, 'tableta'
);

set local role service_role;
set local request.jwt.claim.role = 'service_role';
create temp table retry_one as select * from public.claim_due_notification_deliveries(100);
select is(
  public.complete_notification_delivery(
    (select delivery_id from retry_one where occurrence_id = 'c0000000-0000-0000-0000-000000000005'),
    (select claim_token from retry_one where occurrence_id = 'c0000000-0000-0000-0000-000000000005'),
    'retry', 503, 'provider_temporary_error'
  ), 'retry', 'the first temporary provider failure schedules a retry'
);
update public.notification_deliveries set next_attempt_at = clock_timestamp()
where occurrence_id = 'c0000000-0000-0000-0000-000000000005';
create temp table retry_two as select * from public.claim_due_notification_deliveries(100);
select is(
  public.complete_notification_delivery(
    (select delivery_id from retry_two where occurrence_id = 'c0000000-0000-0000-0000-000000000005'),
    (select claim_token from retry_two where occurrence_id = 'c0000000-0000-0000-0000-000000000005'),
    'retry', 503, 'provider_temporary_error'
  ), 'retry', 'the second temporary provider failure remains bounded'
);
update public.notification_deliveries set next_attempt_at = clock_timestamp()
where occurrence_id = 'c0000000-0000-0000-0000-000000000005';
create temp table retry_three as select * from public.claim_due_notification_deliveries(100);
select is(
  public.complete_notification_delivery(
    (select delivery_id from retry_three where occurrence_id = 'c0000000-0000-0000-0000-000000000005'),
    (select claim_token from retry_three where occurrence_id = 'c0000000-0000-0000-0000-000000000005'),
    'retry', 503, 'provider_temporary_error'
  ), 'failed', 'the third provider failure stops retrying'
);
select results_eq(
  $$select attempt_count from public.notification_deliveries
    where occurrence_id = 'c0000000-0000-0000-0000-000000000005'$$,
  array[3::smallint], 'retry count never exceeds three attempts'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select throws_ok(
  $$select * from public.push_subscriptions$$,
  '42501', null, 'clients cannot read raw subscription keys directly'
);
select throws_ok(
  $$select * from public.notification_deliveries$$,
  '42501', null, 'clients cannot read delivery internals directly'
);

select * from finish();
rollback;
