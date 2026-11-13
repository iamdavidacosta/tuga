alter table public.medications
  add column duration_config jsonb;

update public.medications
set duration_config = case
  when end_date is null then
    '{"kind":"indefinite","boundary":"inclusive"}'::jsonb
  else
    jsonb_build_object(
      'kind', 'days',
      'amount', (end_date - start_date) + 1,
      'boundary', 'inclusive'
    )
end;

alter table public.medications
  alter column duration_config set default
    '{"kind":"indefinite","boundary":"inclusive"}'::jsonb,
  alter column duration_config set not null,
  add constraint medications_duration_config_object
    check (jsonb_typeof(duration_config) = 'object');

alter table public.medication_schedules
  add column retired_at timestamptz,
  add constraint medication_schedules_retired_after_created
    check (retired_at is null or retired_at >= created_at);

create index medication_schedules_active_medication_idx
  on public.medication_schedules using btree (medication_id)
  where retired_at is null;

create table public.medication_versions (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null,
  user_id uuid not null,
  name text not null,
  dosage_amount numeric(12, 3) not null,
  dosage_unit text not null,
  instructions text,
  notes text,
  start_date date not null,
  end_date date,
  duration_config jsonb not null,
  status text not null,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  created_at timestamptz not null default now(),
  constraint medication_versions_medication_owner_fk
    foreign key (medication_id, user_id)
    references public.medications (id, user_id)
    on delete cascade,
  constraint medication_versions_name_length
    check (char_length(btrim(name)) between 1 and 160),
  constraint medication_versions_dosage_positive
    check (dosage_amount > 0),
  constraint medication_versions_unit_length
    check (char_length(btrim(dosage_unit)) between 1 and 50),
  constraint medication_versions_date_range
    check (end_date is null or end_date >= start_date),
  constraint medication_versions_duration_object
    check (jsonb_typeof(duration_config) = 'object'),
  constraint medication_versions_status_allowed
    check (status in ('active', 'paused', 'completed')),
  constraint medication_versions_valid_range
    check (valid_to >= valid_from)
);

create index medication_versions_user_medication_idx
  on public.medication_versions using btree (user_id, medication_id, valid_to desc);

create function private.archive_medication_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row(
    new.name,
    new.dosage_amount,
    new.dosage_unit,
    new.instructions,
    new.notes,
    new.start_date,
    new.end_date,
    new.duration_config,
    new.status
  ) is distinct from row(
    old.name,
    old.dosage_amount,
    old.dosage_unit,
    old.instructions,
    old.notes,
    old.start_date,
    old.end_date,
    old.duration_config,
    old.status
  ) then
    insert into public.medication_versions (
      medication_id,
      user_id,
      name,
      dosage_amount,
      dosage_unit,
      instructions,
      notes,
      start_date,
      end_date,
      duration_config,
      status,
      valid_from,
      valid_to
    ) values (
      old.id,
      old.user_id,
      old.name,
      old.dosage_amount,
      old.dosage_unit,
      old.instructions,
      old.notes,
      old.start_date,
      old.end_date,
      old.duration_config,
      old.status,
      least(old.updated_at, now()),
      now()
    );
  end if;

  return new;
end;
$$;

create trigger medications_archive_version
before update on public.medications
for each row execute function private.archive_medication_version();

revoke all on function private.archive_medication_version()
  from public, anon, authenticated;

alter table public.medication_versions enable row level security;
alter table public.medication_versions force row level security;

revoke all on table public.medication_versions from anon, authenticated;
grant select on table public.medication_versions to authenticated;

create policy "medication_versions_select_own"
on public.medication_versions for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create function public.create_medication_with_schedule(
  p_medication_id uuid,
  p_name text,
  p_dosage_amount numeric,
  p_dosage_unit text,
  p_start_date date,
  p_end_date date,
  p_duration_config jsonb,
  p_schedule_type text,
  p_local_times time[],
  p_timezone text,
  p_recurrence_config jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.medications
    where id = p_medication_id and user_id = current_user_id
  ) then
    return p_medication_id;
  end if;

  if p_schedule_type not in ('daily', 'interval') then
    raise exception 'Unsupported schedule type' using errcode = '22023';
  end if;

  insert into public.medications (
    id,
    user_id,
    name,
    dosage_amount,
    dosage_unit,
    start_date,
    end_date,
    duration_config,
    status
  ) values (
    p_medication_id,
    current_user_id,
    p_name,
    p_dosage_amount,
    p_dosage_unit,
    p_start_date,
    p_end_date,
    p_duration_config,
    'active'
  );

  insert into public.medication_schedules (
    medication_id,
    user_id,
    schedule_type,
    local_times,
    timezone,
    recurrence_config
  ) values (
    p_medication_id,
    current_user_id,
    p_schedule_type,
    p_local_times,
    p_timezone,
    p_recurrence_config
  );

  return p_medication_id;
end;
$$;

create function public.update_medication_with_schedule(
  p_medication_id uuid,
  p_name text,
  p_dosage_amount numeric,
  p_dosage_unit text,
  p_start_date date,
  p_end_date date,
  p_duration_config jsonb,
  p_schedule_type text,
  p_local_times time[],
  p_timezone text,
  p_recurrence_config jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.medications
  where id = p_medication_id and user_id = current_user_id
  for update;

  if not found then
    raise exception 'Medication not found' using errcode = 'P0002';
  end if;

  if p_schedule_type not in ('daily', 'interval') then
    raise exception 'Unsupported schedule type' using errcode = '22023';
  end if;

  update public.medications
  set name = p_name,
      dosage_amount = p_dosage_amount,
      dosage_unit = p_dosage_unit,
      start_date = p_start_date,
      end_date = p_end_date,
      duration_config = p_duration_config
  where id = p_medication_id and user_id = current_user_id;

  update public.medication_schedules
  set retired_at = now()
  where medication_id = p_medication_id
    and user_id = current_user_id
    and retired_at is null;

  insert into public.medication_schedules (
    medication_id,
    user_id,
    schedule_type,
    local_times,
    timezone,
    recurrence_config
  ) values (
    p_medication_id,
    current_user_id,
    p_schedule_type,
    p_local_times,
    p_timezone,
    p_recurrence_config
  );

  return p_medication_id;
end;
$$;

create function public.suspend_medication(p_medication_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_status text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select status into current_status
  from public.medications
  where id = p_medication_id and user_id = current_user_id
  for update;

  if not found then
    raise exception 'Medication not found' using errcode = 'P0002';
  end if;

  if current_status = 'paused' then
    return p_medication_id;
  end if;

  if current_status = 'completed' then
    raise exception 'Completed medication cannot be suspended' using errcode = 'P0001';
  end if;

  update public.medications
  set status = 'paused'
  where id = p_medication_id and user_id = current_user_id;

  return p_medication_id;
end;
$$;

revoke all on function public.create_medication_with_schedule(
  uuid, text, numeric, text, date, date, jsonb, text, time[], text, jsonb
) from public, anon;
revoke all on function public.update_medication_with_schedule(
  uuid, text, numeric, text, date, date, jsonb, text, time[], text, jsonb
) from public, anon;
revoke all on function public.suspend_medication(uuid) from public, anon;

grant execute on function public.create_medication_with_schedule(
  uuid, text, numeric, text, date, date, jsonb, text, time[], text, jsonb
) to authenticated;
grant execute on function public.update_medication_with_schedule(
  uuid, text, numeric, text, date, date, jsonb, text, time[], text, jsonb
) to authenticated;
grant execute on function public.suspend_medication(uuid) to authenticated;

comment on table public.medication_versions is
  'Immutable snapshots created before medication updates to preserve history.';
comment on column public.medication_schedules.retired_at is
  'A retired schedule remains available to historical dose occurrences.';
