-- Stage 6: PWA push subscriptions, bounded delivery retries and Supabase Cron.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  expiration_time bigint,
  device_label text,
  active boolean not null default true,
  failure_count smallint not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_subscriptions_id_user_key unique (id, user_id),
  constraint push_subscriptions_endpoint_format
    check (char_length(endpoint) between 20 and 2048 and endpoint ~ '^https://'),
  constraint push_subscriptions_p256dh_format
    check (char_length(p256dh) between 40 and 255 and p256dh ~ '^[A-Za-z0-9_-]+$'),
  constraint push_subscriptions_auth_format
    check (char_length(auth_key) between 10 and 255 and auth_key ~ '^[A-Za-z0-9_-]+$'),
  constraint push_subscriptions_expiration_valid
    check (expiration_time is null or expiration_time > 0),
  constraint push_subscriptions_device_label_length
    check (device_label is null or char_length(device_label) between 1 and 80),
  constraint push_subscriptions_failure_count_valid check (failure_count between 0 and 20),
  constraint push_subscriptions_disabled_consistency
    check ((active and disabled_at is null) or (not active and disabled_at is not null)),
  constraint push_subscriptions_timestamps_order check (updated_at >= created_at)
);

create table public.dose_reminders (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null,
  medication_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  remind_at timestamptz not null,
  status text not null default 'scheduled',
  snooze_number smallint not null,
  processed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dose_reminders_occurrence_owner_fk
    foreign key (occurrence_id, medication_id, user_id)
    references public.dose_occurrences (id, medication_id, user_id) on delete cascade,
  constraint dose_reminders_id_user_key unique (id, user_id),
  constraint dose_reminders_status_allowed
    check (status in ('scheduled', 'processed', 'cancelled')),
  constraint dose_reminders_snooze_limit check (snooze_number between 1 and 3),
  constraint dose_reminders_time_valid check (remind_at > created_at),
  constraint dose_reminders_status_timestamps
    check (
      (status = 'scheduled' and processed_at is null and cancelled_at is null)
      or (status = 'processed' and processed_at is not null and cancelled_at is null)
      or (status = 'cancelled' and processed_at is null and cancelled_at is not null)
    )
);

create unique index dose_reminders_one_scheduled_idx
  on public.dose_reminders (occurrence_id) where status = 'scheduled';
create index dose_reminders_due_idx
  on public.dose_reminders (remind_at) where status = 'scheduled';

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null,
  medication_id uuid not null,
  subscription_id uuid not null,
  reminder_id uuid,
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_kind text not null,
  scheduled_for timestamptz not null,
  status text not null default 'queued',
  attempt_count smallint not null default 0,
  next_attempt_at timestamptz not null,
  last_attempt_at timestamptz,
  accepted_at timestamptz,
  provider_response_code integer,
  error_code text,
  claim_token uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_occurrence_owner_fk
    foreign key (occurrence_id, medication_id, user_id)
    references public.dose_occurrences (id, medication_id, user_id) on delete cascade,
  constraint notification_deliveries_subscription_owner_fk
    foreign key (subscription_id, user_id)
    references public.push_subscriptions (id, user_id) on delete cascade,
  constraint notification_deliveries_reminder_owner_fk
    foreign key (reminder_id, user_id)
    references public.dose_reminders (id, user_id) on delete cascade,
  constraint notification_deliveries_idempotency_key
    unique (occurrence_id, subscription_id, reminder_kind, scheduled_for),
  constraint notification_deliveries_kind_allowed check (reminder_kind in ('initial', 'snoozed')),
  constraint notification_deliveries_status_allowed
    check (status in ('queued', 'processing', 'accepted', 'retry', 'expired', 'failed', 'cancelled')),
  constraint notification_deliveries_attempt_limit check (attempt_count between 0 and 3),
  constraint notification_deliveries_response_code_valid
    check (provider_response_code is null or provider_response_code between 100 and 599),
  constraint notification_deliveries_error_code_length
    check (error_code is null or char_length(error_code) between 1 and 80),
  constraint notification_deliveries_claim_consistency
    check ((status = 'processing') = (claim_token is not null and claimed_at is not null)),
  constraint notification_deliveries_acceptance_consistency
    check ((status = 'accepted') = (accepted_at is not null)),
  constraint notification_deliveries_timestamps_order check (updated_at >= created_at)
);

create index notification_deliveries_due_idx
  on public.notification_deliveries (next_attempt_at)
  where status in ('queued', 'retry');
create index notification_deliveries_user_created_idx
  on public.notification_deliveries (user_id, created_at desc);

create table public.push_test_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'processing',
  target_count smallint not null default 0,
  accepted_count smallint not null default 0,
  failed_count smallint not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint push_test_requests_status_allowed check (status in ('processing', 'completed', 'failed')),
  constraint push_test_requests_counts_valid
    check (target_count >= 0 and accepted_count >= 0 and failed_count >= 0),
  constraint push_test_requests_completion_consistency
    check ((status = 'processing') = (completed_at is null))
);

create index push_test_requests_rate_limit_idx
  on public.push_test_requests (user_id, created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.dose_reminders enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.push_test_requests enable row level security;
alter table public.push_subscriptions force row level security;
alter table public.dose_reminders force row level security;
alter table public.notification_deliveries force row level security;
alter table public.push_test_requests force row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.dose_reminders from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;
revoke all on table public.push_test_requests from anon, authenticated;

create policy "push_subscriptions_select_own" on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "dose_reminders_select_own" on public.dose_reminders for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "dose_reminders_insert_own" on public.dose_reminders for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "dose_reminders_update_own" on public.dose_reminders for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "dose_reminders_delete_own" on public.dose_reminders for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "notification_deliveries_select_own" on public.notification_deliveries for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "notification_deliveries_insert_own" on public.notification_deliveries for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "notification_deliveries_update_own" on public.notification_deliveries for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "notification_deliveries_delete_own" on public.notification_deliveries for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "push_test_requests_select_own" on public.push_test_requests for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "push_test_requests_insert_own" on public.push_test_requests for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "push_test_requests_update_own" on public.push_test_requests for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "push_test_requests_delete_own" on public.push_test_requests for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function private.assert_service_role()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_key text,
  p_expiration_time bigint,
  p_device_label text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  subscription_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(p_endpoint) not between 20 and 2048 or p_endpoint !~ '^https://' then
    raise exception 'Invalid push endpoint' using errcode = '22023';
  end if;
  if char_length(p_p256dh) not between 40 and 255 or p_p256dh !~ '^[A-Za-z0-9_-]+$'
    or char_length(p_auth_key) not between 10 and 255 or p_auth_key !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid push keys' using errcode = '22023';
  end if;
  if p_device_label is not null and char_length(btrim(p_device_label)) not between 1 and 80 then
    raise exception 'Invalid device label' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id, endpoint, p256dh, auth_key, expiration_time, device_label, active, disabled_at
  ) values (
    current_user_id, p_endpoint, p_p256dh, p_auth_key, p_expiration_time,
    nullif(btrim(p_device_label), ''), true, null
  )
  on conflict (endpoint) do update
  set p256dh = excluded.p256dh,
      auth_key = excluded.auth_key,
      expiration_time = excluded.expiration_time,
      device_label = excluded.device_label,
      active = true,
      failure_count = 0,
      disabled_at = null,
      updated_at = now()
  where push_subscriptions.user_id = current_user_id
  returning id into subscription_id;

  if subscription_id is null then
    raise exception 'Subscription belongs to another account' using errcode = '23505';
  end if;
  return subscription_id;
end;
$$;

create or replace function public.deactivate_push_subscription(p_endpoint text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.push_subscriptions
  set active = false, disabled_at = clock_timestamp(), updated_at = clock_timestamp()
  where endpoint = p_endpoint and user_id = current_user_id and active;
  return found;
end;
$$;

create or replace function public.get_push_notification_status(p_endpoint text)
returns table (
  current_device_active boolean,
  active_devices bigint,
  last_test_at timestamptz,
  last_test_status text
)
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return query
  select
    exists (
      select 1 from public.push_subscriptions
      where user_id = current_user_id and endpoint = p_endpoint and active
    ),
    (select count(*) from public.push_subscriptions where user_id = current_user_id and active),
    test.created_at,
    test.status
  from (select 1) as singleton
  left join lateral (
    select created_at, status from public.push_test_requests
    where user_id = current_user_id order by created_at desc limit 1
  ) as test on true;
end;
$$;

create or replace function public.postpone_dose_occurrence(p_occurrence_id uuid)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  current_occurrence public.dose_occurrences%rowtype;
  previous_count integer;
  next_reminder_at timestamptz := clock_timestamp() + interval '15 minutes';
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select occurrence.* into current_occurrence
  from public.dose_occurrences as occurrence
  join public.medications as medication
    on medication.id = occurrence.medication_id and medication.user_id = occurrence.user_id
  where occurrence.id = p_occurrence_id
    and occurrence.user_id = current_user_id
    and occurrence.status = 'pending'
    and medication.status = 'active'
  for update of occurrence;
  if not found then
    raise exception 'Pending occurrence not found' using errcode = 'P0002';
  end if;

  select count(*) into previous_count from public.dose_reminders
  where occurrence_id = p_occurrence_id and user_id = current_user_id;
  if previous_count >= 3 then
    raise exception 'Snooze limit reached' using errcode = 'P0001';
  end if;

  update public.dose_reminders
  set status = 'cancelled', cancelled_at = clock_timestamp()
  where occurrence_id = p_occurrence_id and user_id = current_user_id and status = 'scheduled';
  insert into public.dose_reminders (
    occurrence_id, medication_id, user_id, remind_at, snooze_number
  ) values (
    current_occurrence.id, current_occurrence.medication_id, current_user_id,
    next_reminder_at, previous_count + 1
  );
  return next_reminder_at;
end;
$$;

create or replace function private.cancel_dose_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pending' and new.status <> 'pending' then
    update public.dose_reminders
    set status = 'cancelled', cancelled_at = clock_timestamp()
    where occurrence_id = new.id and status = 'scheduled';
    update public.notification_deliveries
    set status = 'cancelled', claim_token = null, claimed_at = null, updated_at = clock_timestamp()
    where occurrence_id = new.id and status in ('queued', 'retry', 'processing');
  end if;
  return new;
end;
$$;

create trigger dose_occurrences_cancel_notifications
after update of status on public.dose_occurrences
for each row execute function private.cancel_dose_notifications();

create or replace function public.claim_due_notification_deliveries(p_limit integer default 100)
returns table (
  delivery_id uuid,
  claim_token uuid,
  occurrence_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth_key text,
  attempt_count smallint
)
language plpgsql security definer set search_path = '' as $$
declare
  owner record;
  generation_day date := (transaction_timestamp() at time zone 'UTC')::date;
begin
  perform private.assert_service_role();
  if p_limit < 1 or p_limit > 250 then
    raise exception 'Invalid batch limit' using errcode = '22023';
  end if;

  for owner in
    select distinct schedule.user_id
    from public.medication_schedules as schedule
    join public.medications as medication
      on medication.id = schedule.medication_id and medication.user_id = schedule.user_id
    where schedule.retired_at is null and medication.status = 'active'
  loop
    perform private.generate_dose_occurrences_for_user(
      owner.user_id, generation_day - 1, generation_day + 2
    );
  end loop;

  update public.notification_deliveries as delivery
  set status = 'cancelled', claim_token = null, claimed_at = null, updated_at = clock_timestamp()
  where delivery.status in ('queued', 'retry', 'processing')
    and not exists (
      select 1 from public.dose_occurrences as occurrence
      join public.medications as medication
        on medication.id = occurrence.medication_id and medication.user_id = occurrence.user_id
      where occurrence.id = delivery.occurrence_id
        and occurrence.user_id = delivery.user_id
        and occurrence.status = 'pending'
        and medication.status = 'active'
    );

  insert into public.notification_deliveries (
    occurrence_id, medication_id, subscription_id, user_id,
    reminder_kind, scheduled_for, next_attempt_at
  )
  select occurrence.id, occurrence.medication_id, subscription.id, occurrence.user_id,
    'initial', occurrence.scheduled_at, clock_timestamp()
  from public.dose_occurrences as occurrence
  join public.medications as medication
    on medication.id = occurrence.medication_id and medication.user_id = occurrence.user_id
  join public.push_subscriptions as subscription
    on subscription.user_id = occurrence.user_id and subscription.active
  where occurrence.status = 'pending'
    and medication.status = 'active'
    and occurrence.scheduled_at <= clock_timestamp() + interval '30 seconds'
    and occurrence.scheduled_at >= clock_timestamp() - interval '30 minutes'
  on conflict on constraint notification_deliveries_idempotency_key do nothing;

  insert into public.notification_deliveries (
    occurrence_id, medication_id, subscription_id, reminder_id, user_id,
    reminder_kind, scheduled_for, next_attempt_at
  )
  select occurrence.id, occurrence.medication_id, subscription.id, reminder.id,
    occurrence.user_id, 'snoozed', reminder.remind_at, clock_timestamp()
  from public.dose_reminders as reminder
  join public.dose_occurrences as occurrence
    on occurrence.id = reminder.occurrence_id and occurrence.user_id = reminder.user_id
  join public.medications as medication
    on medication.id = occurrence.medication_id and medication.user_id = occurrence.user_id
  join public.push_subscriptions as subscription
    on subscription.user_id = occurrence.user_id and subscription.active
  where reminder.status = 'scheduled'
    and reminder.remind_at <= clock_timestamp() + interval '30 seconds'
    and occurrence.status = 'pending'
    and medication.status = 'active'
  on conflict on constraint notification_deliveries_idempotency_key do nothing;

  update public.dose_reminders as reminder
  set status = 'processed', processed_at = clock_timestamp()
  where reminder.status = 'scheduled' and reminder.remind_at <= clock_timestamp() + interval '30 seconds'
    and exists (select 1 from public.notification_deliveries where reminder_id = reminder.id);

  return query
  with candidates as (
    select delivery.id
    from public.notification_deliveries as delivery
    where delivery.status in ('queued', 'retry')
      and delivery.next_attempt_at <= clock_timestamp()
    order by delivery.next_attempt_at, delivery.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.notification_deliveries as delivery
    set status = 'processing',
        claim_token = gen_random_uuid(),
        claimed_at = clock_timestamp(),
        last_attempt_at = clock_timestamp(),
        attempt_count = delivery.attempt_count + 1,
        updated_at = clock_timestamp()
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select claimed.id, claimed.claim_token, claimed.occurrence_id, claimed.subscription_id,
    subscription.endpoint, subscription.p256dh, subscription.auth_key, claimed.attempt_count
  from claimed
  join public.push_subscriptions as subscription
    on subscription.id = claimed.subscription_id and subscription.user_id = claimed.user_id;
end;
$$;

create or replace function public.is_notification_delivery_current(
  p_delivery_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  is_current boolean;
begin
  perform private.assert_service_role();
  select exists (
    select 1 from public.notification_deliveries as delivery
    join public.dose_occurrences as occurrence
      on occurrence.id = delivery.occurrence_id and occurrence.user_id = delivery.user_id
    join public.medications as medication
      on medication.id = occurrence.medication_id and medication.user_id = occurrence.user_id
    join public.push_subscriptions as subscription
      on subscription.id = delivery.subscription_id and subscription.user_id = delivery.user_id
    where delivery.id = p_delivery_id and delivery.claim_token = p_claim_token
      and delivery.status = 'processing' and occurrence.status = 'pending'
      and medication.status = 'active' and subscription.active
  ) into is_current;
  if not is_current then
    update public.notification_deliveries
    set status = 'cancelled', claim_token = null, claimed_at = null, updated_at = clock_timestamp()
    where id = p_delivery_id and claim_token = p_claim_token and status = 'processing';
  end if;
  return is_current;
end;
$$;

create or replace function public.complete_notification_delivery(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_response_code integer,
  p_error_code text
)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  current_delivery public.notification_deliveries%rowtype;
  final_status text;
begin
  perform private.assert_service_role();
  if p_outcome not in ('accepted', 'expired', 'retry', 'failed') then
    raise exception 'Invalid delivery outcome' using errcode = '22023';
  end if;
  if p_response_code is not null and p_response_code not between 100 and 599 then
    raise exception 'Invalid response code' using errcode = '22023';
  end if;
  if p_error_code is not null and char_length(p_error_code) not between 1 and 80 then
    raise exception 'Invalid error code' using errcode = '22023';
  end if;

  select * into current_delivery from public.notification_deliveries
  where id = p_delivery_id and claim_token = p_claim_token and status = 'processing'
  for update;
  if not found then
    raise exception 'Claimed delivery not found' using errcode = 'P0002';
  end if;

  final_status := case
    when p_outcome = 'retry' and current_delivery.attempt_count < 3 then 'retry'
    when p_outcome = 'retry' then 'failed'
    else p_outcome
  end;
  update public.notification_deliveries
  set status = final_status,
      next_attempt_at = case final_status
        when 'retry' then clock_timestamp() +
          case current_delivery.attempt_count when 1 then interval '1 minute' else interval '5 minutes' end
        else next_attempt_at end,
      accepted_at = case when final_status = 'accepted' then clock_timestamp() else null end,
      provider_response_code = p_response_code,
      error_code = p_error_code,
      claim_token = null,
      claimed_at = null,
      updated_at = clock_timestamp()
  where id = current_delivery.id;

  if final_status = 'accepted' then
    update public.push_subscriptions
    set failure_count = 0, last_success_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = current_delivery.subscription_id;
  elsif final_status = 'expired' then
    update public.push_subscriptions
    set active = false, disabled_at = clock_timestamp(),
        failure_count = least(failure_count + 1, 20),
        last_failure_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = current_delivery.subscription_id;
  else
    update public.push_subscriptions
    set failure_count = least(failure_count + 1, 20),
        last_failure_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = current_delivery.subscription_id;
  end if;
  return final_status;
end;
$$;

create or replace function public.begin_push_test(p_user_id uuid)
returns table (
  request_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth_key text
)
language plpgsql security definer set search_path = '' as $$
declare
  current_request_id uuid;
  target_total integer;
begin
  perform private.assert_service_role();
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if exists (
    select 1 from public.push_test_requests
    where user_id = p_user_id and created_at > clock_timestamp() - interval '5 minutes'
  ) then
    raise exception 'Push test rate limit reached' using errcode = 'P0001';
  end if;
  select count(*) into target_total from public.push_subscriptions
  where user_id = p_user_id and active;
  insert into public.push_test_requests (user_id, target_count)
  values (p_user_id, target_total) returning id into current_request_id;

  return query
  select current_request_id, subscription.id, subscription.endpoint,
    subscription.p256dh, subscription.auth_key
  from (select 1) as singleton
  left join public.push_subscriptions as subscription
    on subscription.user_id = p_user_id and subscription.active;
end;
$$;

create or replace function public.complete_push_test_request(
  p_request_id uuid,
  p_accepted_count integer,
  p_failed_count integer,
  p_expired_subscription_ids uuid[]
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  request_user_id uuid;
begin
  perform private.assert_service_role();
  select user_id into request_user_id from public.push_test_requests
  where id = p_request_id and status = 'processing' for update;
  if not found then
    raise exception 'Push test request not found' using errcode = 'P0002';
  end if;
  if p_accepted_count < 0 or p_failed_count < 0 then
    raise exception 'Invalid push test counts' using errcode = '22023';
  end if;
  update public.push_test_requests
  set status = case when p_accepted_count > 0 then 'completed' else 'failed' end,
      accepted_count = p_accepted_count,
      failed_count = p_failed_count,
      completed_at = clock_timestamp()
  where id = p_request_id;
  update public.push_subscriptions
  set active = false, disabled_at = clock_timestamp(),
      failure_count = least(failure_count + 1, 20),
      last_failure_at = clock_timestamp(), updated_at = clock_timestamp()
  where user_id = request_user_id and id = any(coalesce(p_expired_subscription_ids, array[]::uuid[]));
end;
$$;

create or replace function private.invoke_tuga_reminder_processor()
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  project_url text;
  edge_secret text;
  request_id bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'tuga_project_url' limit 1;
  select decrypted_secret into edge_secret
  from vault.decrypted_secrets where name = 'tuga_edge_secret_key' limit 1;
  if project_url is null or edge_secret is null then return null; end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', edge_secret
    ),
    body := '{"mode":"process"}'::jsonb,
    timeout_milliseconds := 50000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function private.assert_service_role() from public, anon, authenticated;
revoke all on function private.cancel_dose_notifications() from public, anon, authenticated;
revoke all on function private.invoke_tuga_reminder_processor() from public, anon, authenticated;
revoke all on function public.upsert_push_subscription(text, text, text, bigint, text) from public, anon;
revoke all on function public.deactivate_push_subscription(text) from public, anon;
revoke all on function public.get_push_notification_status(text) from public, anon;
revoke all on function public.postpone_dose_occurrence(uuid) from public, anon;
revoke all on function public.begin_push_test(uuid) from public, anon, authenticated;
revoke all on function public.claim_due_notification_deliveries(integer) from public, anon, authenticated;
revoke all on function public.is_notification_delivery_current(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(uuid, uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.complete_push_test_request(uuid, integer, integer, uuid[]) from public, anon, authenticated;

grant execute on function public.upsert_push_subscription(text, text, text, bigint, text) to authenticated;
grant execute on function public.deactivate_push_subscription(text) to authenticated;
grant execute on function public.get_push_notification_status(text) to authenticated;
grant execute on function public.postpone_dose_occurrence(uuid) to authenticated;
grant execute on function public.begin_push_test(uuid) to service_role;
grant execute on function public.claim_due_notification_deliveries(integer) to service_role;
grant execute on function public.is_notification_delivery_current(uuid, uuid) to service_role;
grant execute on function public.complete_notification_delivery(uuid, uuid, text, integer, text) to service_role;
grant execute on function public.complete_push_test_request(uuid, integer, integer, uuid[]) to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'tuga-process-reminders';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'tuga-process-reminders',
    '* * * * *',
    'select private.invoke_tuga_reminder_processor()'
  );
end;
$$;

comment on table public.notification_deliveries is
  'Push provider attempts. accepted means accepted by the push service, never guaranteed device delivery.';
comment on function private.invoke_tuga_reminder_processor() is
  'Cron target. Inert until tuga_project_url and tuga_edge_secret_key exist in Vault.';
