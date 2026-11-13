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
    select case
      when schedule.recurrence_config ->> 'intervalDays' ~ '^[0-9]{1,4}$'
        and (schedule.recurrence_config ->> 'intervalDays')::integer between 1 and 3650
        then (schedule.recurrence_config ->> 'intervalDays')::integer
      else 1
    end as interval_days
  ) as frequency
  cross join lateral (
    select (treatment_day::date + local_time)::timestamp at time zone schedule.timezone as scheduled_at
    from unnest(schedule.local_times) as local_time
  ) as instant
  where schedule.user_id = p_user_id
    and mod(treatment_day::date - schedule.treatment_start, frequency.interval_days) = 0
    and instant.scheduled_at >= schedule.effective_from
    and (schedule.effective_until is null or instant.scheduled_at < schedule.effective_until)
  on conflict (schedule_id, scheduled_at) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

comment on function private.generate_dose_occurrences_for_user(uuid, date, date)
  is 'Generates bounded occurrences and honors recurrence_config.intervalDays from treatment_start.';
