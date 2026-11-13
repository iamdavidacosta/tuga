-- Stage 5: bounded dose generation, atomic transitions and immutable history.

alter table public.medication_schedules
  add column effective_from timestamptz,
  add column effective_until timestamptz,
  add column treatment_start date,
  add column treatment_end date,
  add column medication_name text,
  add column dosage_amount numeric,
  add column dosage_unit text;

update public.medication_schedules as schedule
set effective_from = medication.start_date::timestamp at time zone schedule.timezone,
    effective_until = schedule.retired_at,
    treatment_start = medication.start_date,
    treatment_end = medication.end_date,
    medication_name = medication.name,
    dosage_amount = medication.dosage_amount,
    dosage_unit = medication.dosage_unit
from public.medications as medication
where medication.id = schedule.medication_id
  and medication.user_id = schedule.user_id;

alter table public.medication_schedules
  alter column effective_from set not null,
  alter column treatment_start set not null,
  alter column medication_name set not null,
  alter column dosage_amount set not null,
  alter column dosage_unit set not null,
  add constraint medication_schedules_effective_range
    check (effective_until is null or effective_until >= effective_from),
  add constraint medication_schedules_treatment_range
    check (treatment_end is null or treatment_end >= treatment_start),
  add constraint medication_schedules_snapshot_name
    check (char_length(btrim(medication_name)) between 1 and 160),
  add constraint medication_schedules_snapshot_dosage
    check (dosage_amount > 0 and char_length(btrim(dosage_unit)) between 1 and 50);

create index medication_schedules_generation_idx
  on public.medication_schedules (user_id, treatment_start, treatment_end, effective_from, effective_until);

update public.dose_occurrences
set status = 'skipped'
where status = 'omitted';

alter table public.dose_occurrences
  drop constraint dose_occurrences_status_allowed,
  add constraint dose_occurrences_status_allowed
    check (status in ('pending', 'taken', 'skipped')),
  add column medication_name text,
  add column dosage_amount numeric,
  add column dosage_unit text;

update public.dose_occurrences as occurrence
set medication_name = schedule.medication_name,
    dosage_amount = schedule.dosage_amount,
    dosage_unit = schedule.dosage_unit
from public.medication_schedules as schedule
where schedule.id = occurrence.schedule_id
  and schedule.medication_id = occurrence.medication_id
  and schedule.user_id = occurrence.user_id;

alter table public.dose_occurrences
  alter column medication_name set not null,
  alter column dosage_amount set not null,
  alter column dosage_unit set not null,
  add constraint dose_occurrences_snapshot_name
    check (char_length(btrim(medication_name)) between 1 and 160),
  add constraint dose_occurrences_snapshot_dosage
    check (dosage_amount > 0 and char_length(btrim(dosage_unit)) between 1 and 50),
  add constraint dose_occurrences_id_medication_user_key
    unique (id, medication_id, user_id);

create table public.dose_occurrence_events (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null,
  medication_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  previous_status text not null,
  new_status text not null,
  previous_taken_at timestamptz,
  new_taken_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dose_occurrence_events_occurrence_owner_fk
    foreign key (occurrence_id, medication_id, user_id)
    references public.dose_occurrences (id, medication_id, user_id)
    on delete cascade,
  constraint dose_occurrence_events_status_allowed
    check (
      previous_status in ('pending', 'taken', 'skipped')
      and new_status in ('pending', 'taken', 'skipped')
      and previous_status <> new_status
    ),
  constraint dose_occurrence_events_previous_taken_consistency
    check ((previous_status = 'taken') = (previous_taken_at is not null)),
  constraint dose_occurrence_events_new_taken_consistency
    check ((new_status = 'taken') = (new_taken_at is not null))
);

create index dose_occurrence_events_user_created_idx
  on public.dose_occurrence_events (user_id, created_at desc);
create index dose_occurrence_events_occurrence_idx
  on public.dose_occurrence_events (occurrence_id, created_at);

alter table public.dose_occurrence_events enable row level security;
alter table public.dose_occurrence_events force row level security;
revoke all on table public.dose_occurrence_events from anon, authenticated;
grant select on table public.dose_occurrence_events to authenticated;

create policy "dose_occurrence_events_select_own"
on public.dose_occurrence_events for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- Occurrences can only be changed through the atomic functions below.
revoke insert, update, delete on table public.dose_occurrences from authenticated;

create or replace function private.assert_valid_timezone(p_timezone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'Unsupported timezone' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.generate_dose_occurrences_for_user(
  p_user_id uuid,
  p_from date,
  p_to date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_to < p_from or p_to - p_from > 64 then
    raise exception 'Invalid occurrence generation range' using errcode = '22023';
  end if;

  insert into public.dose_occurrences (
    medication_id,
    schedule_id,
    user_id,
    scheduled_at,
    medication_name,
    dosage_amount,
    dosage_unit
  )
  select
    schedule.medication_id,
    schedule.id,
    schedule.user_id,
    instant.scheduled_at,
    schedule.medication_name,
    schedule.dosage_amount,
    schedule.dosage_unit
  from public.medication_schedules as schedule
  cross join lateral generate_series(
    greatest(p_from, schedule.treatment_start),
    least(p_to, coalesce(schedule.treatment_end, p_to)),
    interval '1 day'
  ) as treatment_day
  cross join lateral (
    select (treatment_day::date + local_time)::timestamp at time zone schedule.timezone as scheduled_at
    from unnest(schedule.local_times) as local_time
  ) as instant
  where schedule.user_id = p_user_id
    and instant.scheduled_at >= schedule.effective_from
    and (schedule.effective_until is null or instant.scheduled_at < schedule.effective_until)
  on conflict (schedule_id, scheduled_at) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.ensure_dose_occurrences(p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Date range must contain at most 63 days' using errcode = '22023';
  end if;

  return private.generate_dose_occurrences_for_user(
    current_user_id,
    p_from - 1,
    p_to + 1
  );
end;
$$;

create or replace function public.list_dose_occurrences(p_from date, p_to date)
returns table (
  id uuid,
  medication_id uuid,
  schedule_id uuid,
  medication_name text,
  dosage_amount numeric,
  dosage_unit text,
  scheduled_at timestamptz,
  status text,
  taken_at timestamptz,
  updated_at timestamptz,
  local_date date,
  local_time time,
  display_timezone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_timezone text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Date range must contain at most 63 days' using errcode = '22023';
  end if;

  select profile.timezone
  into current_timezone
  from public.profiles as profile
  where profile.user_id = current_user_id;

  if current_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = current_timezone
  ) then
    current_timezone := 'America/Bogota';
  end if;

  return query
  select
    occurrence.id,
    occurrence.medication_id,
    occurrence.schedule_id,
    occurrence.medication_name,
    occurrence.dosage_amount,
    occurrence.dosage_unit,
    occurrence.scheduled_at,
    occurrence.status,
    occurrence.taken_at,
    occurrence.updated_at,
    (occurrence.scheduled_at at time zone current_timezone)::date,
    (occurrence.scheduled_at at time zone current_timezone)::time,
    current_timezone
  from public.dose_occurrences as occurrence
  where occurrence.user_id = current_user_id
    and (occurrence.scheduled_at at time zone current_timezone)::date between p_from and p_to
  order by occurrence.scheduled_at, occurrence.id;
end;
$$;

create or replace function public.get_dose_occurrence(p_occurrence_id uuid)
returns table (
  id uuid,
  medication_id uuid,
  schedule_id uuid,
  medication_name text,
  dosage_amount numeric,
  dosage_unit text,
  scheduled_at timestamptz,
  status text,
  taken_at timestamptz,
  updated_at timestamptz,
  local_date date,
  local_time time,
  display_timezone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_timezone text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select profile.timezone into current_timezone
  from public.profiles as profile where profile.user_id = current_user_id;
  if current_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = current_timezone
  ) then
    current_timezone := 'America/Bogota';
  end if;

  return query
  select
    occurrence.id, occurrence.medication_id, occurrence.schedule_id,
    occurrence.medication_name, occurrence.dosage_amount, occurrence.dosage_unit,
    occurrence.scheduled_at, occurrence.status, occurrence.taken_at, occurrence.updated_at,
    (occurrence.scheduled_at at time zone current_timezone)::date,
    (occurrence.scheduled_at at time zone current_timezone)::time,
    current_timezone
  from public.dose_occurrences as occurrence
  where occurrence.id = p_occurrence_id and occurrence.user_id = current_user_id;
end;
$$;

create or replace function public.get_dose_context()
returns table (display_timezone text, local_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_timezone text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select profile.timezone into current_timezone
  from public.profiles as profile where profile.user_id = current_user_id;
  if current_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = current_timezone
  ) then
    current_timezone := 'America/Bogota';
  end if;
  return query select current_timezone, (transaction_timestamp() at time zone current_timezone)::date;
end;
$$;

create or replace function public.confirm_dose_occurrence(p_occurrence_id uuid)
returns table (occurrence_id uuid, occurrence_status text, confirmed_at timestamptz, changed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_occurrence public.dose_occurrences%rowtype;
  confirmation_time timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into current_occurrence
  from public.dose_occurrences
  where id = p_occurrence_id and user_id = current_user_id
  for update;

  if not found then
    raise exception 'Dose occurrence not found' using errcode = 'P0002';
  end if;
  if current_occurrence.status = 'taken' then
    return query select current_occurrence.id, current_occurrence.status,
      current_occurrence.taken_at, current_occurrence.updated_at;
    return;
  end if;
  if current_occurrence.status <> 'pending' then
    raise exception 'Correct the occurrence before confirming it' using errcode = 'P0001';
  end if;

  confirmation_time := clock_timestamp();
  update public.dose_occurrences
  set status = 'taken', taken_at = confirmation_time, updated_at = confirmation_time
  where id = current_occurrence.id;

  insert into public.dose_occurrence_events (
    occurrence_id, medication_id, user_id, previous_status, new_status,
    previous_taken_at, new_taken_at, created_at
  ) values (
    current_occurrence.id, current_occurrence.medication_id, current_user_id,
    'pending', 'taken', null, confirmation_time, confirmation_time
  );

  return query select current_occurrence.id, 'taken'::text,
    confirmation_time, confirmation_time;
end;
$$;

create or replace function public.skip_dose_occurrence(p_occurrence_id uuid)
returns table (occurrence_id uuid, occurrence_status text, confirmed_at timestamptz, changed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_occurrence public.dose_occurrences%rowtype;
  change_time timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into current_occurrence
  from public.dose_occurrences
  where id = p_occurrence_id and user_id = current_user_id
  for update;

  if not found then
    raise exception 'Dose occurrence not found' using errcode = 'P0002';
  end if;
  if current_occurrence.status = 'skipped' then
    return query select current_occurrence.id, current_occurrence.status,
      current_occurrence.taken_at, current_occurrence.updated_at;
    return;
  end if;
  if current_occurrence.status <> 'pending' then
    raise exception 'Correct the occurrence before skipping it' using errcode = 'P0001';
  end if;

  change_time := clock_timestamp();
  update public.dose_occurrences
  set status = 'skipped', taken_at = null, updated_at = change_time
  where id = current_occurrence.id;
  insert into public.dose_occurrence_events (
    occurrence_id, medication_id, user_id, previous_status, new_status,
    previous_taken_at, new_taken_at, created_at
  ) values (
    current_occurrence.id, current_occurrence.medication_id, current_user_id,
    'pending', 'skipped', null, null, change_time
  );

  return query select current_occurrence.id, 'skipped'::text, null::timestamptz, change_time;
end;
$$;

create or replace function public.correct_dose_occurrence(p_occurrence_id uuid)
returns table (occurrence_id uuid, occurrence_status text, confirmed_at timestamptz, changed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_occurrence public.dose_occurrences%rowtype;
  change_time timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into current_occurrence
  from public.dose_occurrences
  where id = p_occurrence_id and user_id = current_user_id
  for update;

  if not found then
    raise exception 'Dose occurrence not found' using errcode = 'P0002';
  end if;
  if current_occurrence.status = 'pending' then
    return query select current_occurrence.id, current_occurrence.status,
      current_occurrence.taken_at, current_occurrence.updated_at;
    return;
  end if;

  change_time := clock_timestamp();
  update public.dose_occurrences
  set status = 'pending', taken_at = null, updated_at = change_time
  where id = current_occurrence.id;
  insert into public.dose_occurrence_events (
    occurrence_id, medication_id, user_id, previous_status, new_status,
    previous_taken_at, new_taken_at, created_at
  ) values (
    current_occurrence.id, current_occurrence.medication_id, current_user_id,
    current_occurrence.status, 'pending', current_occurrence.taken_at, null, change_time
  );

  return query select current_occurrence.id, 'pending'::text, null::timestamptz, change_time;
end;
$$;

create or replace function public.create_medication_with_schedule(
  p_medication_id uuid, p_name text, p_dosage_amount numeric, p_dosage_unit text,
  p_start_date date, p_end_date date, p_duration_config jsonb,
  p_schedule_type text, p_local_times time[], p_timezone text, p_recurrence_config jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  local_today date;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if exists (select 1 from public.medications where id = p_medication_id and user_id = current_user_id) then
    return p_medication_id;
  end if;
  if p_schedule_type not in ('daily', 'interval') then
    raise exception 'Unsupported schedule type' using errcode = '22023';
  end if;
  perform private.assert_valid_timezone(p_timezone);

  insert into public.medications (
    id, user_id, name, dosage_amount, dosage_unit, start_date, end_date, duration_config, status
  ) values (
    p_medication_id, current_user_id, p_name, p_dosage_amount, p_dosage_unit,
    p_start_date, p_end_date, p_duration_config, 'active'
  );
  insert into public.medication_schedules (
    medication_id, user_id, schedule_type, local_times, timezone, recurrence_config,
    effective_from, treatment_start, treatment_end, medication_name, dosage_amount, dosage_unit
  ) values (
    p_medication_id, current_user_id, p_schedule_type, p_local_times, p_timezone,
    p_recurrence_config, p_start_date::timestamp at time zone p_timezone,
    p_start_date, p_end_date, p_name, p_dosage_amount, p_dosage_unit
  );

  local_today := (transaction_timestamp() at time zone p_timezone)::date;
  perform private.generate_dose_occurrences_for_user(current_user_id, local_today - 1, local_today + 45);
  return p_medication_id;
end;
$$;

create or replace function public.update_medication_with_schedule(
  p_medication_id uuid, p_name text, p_dosage_amount numeric, p_dosage_unit text,
  p_start_date date, p_end_date date, p_duration_config jsonb,
  p_schedule_type text, p_local_times time[], p_timezone text, p_recurrence_config jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  change_boundary timestamptz := transaction_timestamp();
  schedule_start timestamptz;
  local_today date;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform 1 from public.medications
  where id = p_medication_id and user_id = current_user_id for update;
  if not found then
    raise exception 'Medication not found' using errcode = 'P0002';
  end if;
  if p_schedule_type not in ('daily', 'interval') then
    raise exception 'Unsupported schedule type' using errcode = '22023';
  end if;
  perform private.assert_valid_timezone(p_timezone);

  delete from public.dose_occurrences
  where medication_id = p_medication_id and user_id = current_user_id
    and status = 'pending' and scheduled_at >= change_boundary;
  update public.medication_schedules
  set retired_at = change_boundary,
      effective_until = change_boundary,
      updated_at = change_boundary
  where medication_id = p_medication_id and user_id = current_user_id and retired_at is null;

  update public.medications
  set name = p_name, dosage_amount = p_dosage_amount, dosage_unit = p_dosage_unit,
      start_date = p_start_date, end_date = p_end_date, duration_config = p_duration_config
  where id = p_medication_id and user_id = current_user_id;

  schedule_start := greatest(change_boundary, p_start_date::timestamp at time zone p_timezone);
  insert into public.medication_schedules (
    medication_id, user_id, schedule_type, local_times, timezone, recurrence_config,
    effective_from, treatment_start, treatment_end, medication_name, dosage_amount, dosage_unit
  ) values (
    p_medication_id, current_user_id, p_schedule_type, p_local_times, p_timezone,
    p_recurrence_config, schedule_start, p_start_date, p_end_date,
    p_name, p_dosage_amount, p_dosage_unit
  );

  local_today := (change_boundary at time zone p_timezone)::date;
  perform private.generate_dose_occurrences_for_user(current_user_id, local_today - 1, local_today + 45);
  return p_medication_id;
end;
$$;

create or replace function public.suspend_medication(p_medication_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_status text;
  change_boundary timestamptz := transaction_timestamp();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select status into current_status from public.medications
  where id = p_medication_id and user_id = current_user_id for update;
  if not found then
    raise exception 'Medication not found' using errcode = 'P0002';
  end if;
  if current_status = 'paused' then return p_medication_id; end if;
  if current_status = 'completed' then
    raise exception 'Completed medication cannot be suspended' using errcode = 'P0001';
  end if;

  delete from public.dose_occurrences
  where medication_id = p_medication_id and user_id = current_user_id
    and status = 'pending' and scheduled_at >= change_boundary;
  update public.medication_schedules
  set retired_at = change_boundary,
      effective_until = change_boundary,
      updated_at = change_boundary
  where medication_id = p_medication_id and user_id = current_user_id and retired_at is null;
  update public.medications set status = 'paused'
  where id = p_medication_id and user_id = current_user_id;
  return p_medication_id;
end;
$$;

revoke all on function private.assert_valid_timezone(text) from public, anon, authenticated;
revoke all on function private.generate_dose_occurrences_for_user(uuid, date, date) from public, anon, authenticated;
revoke all on function public.ensure_dose_occurrences(date, date) from public, anon;
revoke all on function public.list_dose_occurrences(date, date) from public, anon;
revoke all on function public.get_dose_occurrence(uuid) from public, anon;
revoke all on function public.get_dose_context() from public, anon;
revoke all on function public.confirm_dose_occurrence(uuid) from public, anon;
revoke all on function public.skip_dose_occurrence(uuid) from public, anon;
revoke all on function public.correct_dose_occurrence(uuid) from public, anon;

grant execute on function public.ensure_dose_occurrences(date, date) to authenticated;
grant execute on function public.list_dose_occurrences(date, date) to authenticated;
grant execute on function public.get_dose_occurrence(uuid) to authenticated;
grant execute on function public.get_dose_context() to authenticated;
grant execute on function public.confirm_dose_occurrence(uuid) to authenticated;
grant execute on function public.skip_dose_occurrence(uuid) to authenticated;
grant execute on function public.correct_dose_occurrence(uuid) to authenticated;

alter table public.dose_occurrences replica identity full;
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'dose_occurrences'
    ) then
    alter publication supabase_realtime add table public.dose_occurrences;
  end if;
end;
$$;

comment on column public.medication_schedules.effective_until is
  'Exclusive UTC boundary. Retired schedules remain valid before this instant.';
comment on table public.dose_occurrence_events is
  'Immutable audit of explicit confirmations, omissions and corrections.';
