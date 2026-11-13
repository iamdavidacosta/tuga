create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  display_name text not null,
  timezone text not null default 'America/Bogota',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_id_key unique (user_id),
  constraint profiles_display_name_length
    check (char_length(btrim(display_name)) between 1 and 120),
  constraint profiles_timezone_format
    check (timezone ~ '^[A-Za-z0-9_+./-]{1,100}$'),
  constraint profiles_timestamps_order check (updated_at >= created_at)
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null,
  dosage_amount numeric(12, 3) not null,
  dosage_unit text not null,
  instructions text,
  notes text,
  start_date date not null,
  end_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medications_id_user_id_key unique (id, user_id),
  constraint medications_name_length
    check (char_length(btrim(name)) between 1 and 160),
  constraint medications_dosage_amount_positive check (dosage_amount > 0),
  constraint medications_dosage_unit_length
    check (char_length(btrim(dosage_unit)) between 1 and 50),
  constraint medications_instructions_length
    check (instructions is null or char_length(instructions) <= 1000),
  constraint medications_notes_length
    check (notes is null or char_length(notes) <= 2000),
  constraint medications_date_range
    check (end_date is null or end_date >= start_date),
  constraint medications_status_allowed
    check (status in ('active', 'paused', 'completed')),
  constraint medications_timestamps_order check (updated_at >= created_at)
);

create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null,
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  schedule_type text not null,
  local_times time[] not null,
  timezone text not null default 'America/Bogota',
  recurrence_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_schedules_medication_owner_fk
    foreign key (medication_id, user_id)
    references public.medications (id, user_id)
    on delete cascade,
  constraint medication_schedules_id_medication_user_key
    unique (id, medication_id, user_id),
  constraint medication_schedules_type_allowed
    check (schedule_type in ('daily', 'weekly', 'interval', 'custom')),
  constraint medication_schedules_local_times_count
    check (cardinality(local_times) between 1 and 24),
  constraint medication_schedules_timezone_format
    check (timezone ~ '^[A-Za-z0-9_+./-]{1,100}$'),
  constraint medication_schedules_recurrence_object
    check (jsonb_typeof(recurrence_config) = 'object'),
  constraint medication_schedules_timestamps_order
    check (updated_at >= created_at)
);

create table public.dose_occurrences (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null,
  schedule_id uuid not null,
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dose_occurrences_schedule_medication_owner_fk
    foreign key (schedule_id, medication_id, user_id)
    references public.medication_schedules (id, medication_id, user_id)
    on delete cascade,
  constraint dose_occurrences_schedule_time_key
    unique (schedule_id, scheduled_at),
  constraint dose_occurrences_status_allowed
    check (status in ('pending', 'taken', 'omitted')),
  constraint dose_occurrences_taken_at_consistency
    check (
      (status = 'taken' and taken_at is not null)
      or (status <> 'taken' and taken_at is null)
    ),
  constraint dose_occurrences_timestamps_order
    check (updated_at >= created_at)
);

create index medications_user_id_idx
  on public.medications using btree (user_id);
create index medications_user_status_idx
  on public.medications using btree (user_id, status);
create index medication_schedules_user_id_idx
  on public.medication_schedules using btree (user_id);
create index medication_schedules_medication_id_idx
  on public.medication_schedules using btree (medication_id);
create index dose_occurrences_user_scheduled_at_idx
  on public.dose_occurrences using btree (user_id, scheduled_at);
create index dose_occurrences_medication_id_idx
  on public.dose_occurrences using btree (medication_id);
create index dose_occurrences_schedule_id_idx
  on public.dose_occurrences using btree (schedule_id);
create index dose_occurrences_pending_idx
  on public.dose_occurrences using btree (scheduled_at)
  where status = 'pending';

create function private.touch_owned_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed'
      using errcode = '42501';
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_owned_row
before update on public.profiles
for each row execute function private.touch_owned_row();

create trigger medications_touch_owned_row
before update on public.medications
for each row execute function private.touch_owned_row();

create trigger medication_schedules_touch_owned_row
before update on public.medication_schedules
for each row execute function private.touch_owned_row();

create trigger dose_occurrences_touch_owned_row
before update on public.dose_occurrences
for each row execute function private.touch_owned_row();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_display_name text;
begin
  profile_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Usuario de TUGA'
  );

  insert into public.profiles (user_id, display_name)
  values (new.id, left(profile_display_name, 120))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

revoke all on function private.touch_owned_row() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.dose_occurrences enable row level security;

alter table public.profiles force row level security;
alter table public.medications force row level security;
alter table public.medication_schedules force row level security;
alter table public.dose_occurrences force row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.medications from anon, authenticated;
revoke all on table public.medication_schedules from anon, authenticated;
revoke all on table public.dose_occurrences from anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.medications to authenticated;
grant select, insert, update, delete on table public.medication_schedules to authenticated;
grant select, insert, update, delete on table public.dose_occurrences to authenticated;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "profiles_delete_own"
on public.profiles for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "medications_select_own"
on public.medications for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "medications_insert_own"
on public.medications for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "medications_update_own"
on public.medications for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "medications_delete_own"
on public.medications for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "medication_schedules_select_own"
on public.medication_schedules for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "medication_schedules_insert_own"
on public.medication_schedules for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "medication_schedules_update_own"
on public.medication_schedules for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "medication_schedules_delete_own"
on public.medication_schedules for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "dose_occurrences_select_own"
on public.dose_occurrences for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "dose_occurrences_insert_own"
on public.dose_occurrences for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "dose_occurrences_update_own"
on public.dose_occurrences for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "dose_occurrences_delete_own"
on public.dose_occurrences for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

comment on table public.dose_occurrences is
  'Stable occurrence IDs are the future reference point for notification_deliveries.';
