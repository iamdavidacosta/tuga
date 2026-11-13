begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'medications', 'medications exists');
select has_table('public', 'medication_schedules', 'medication_schedules exists');
select has_table('public', 'dose_occurrences', 'dose_occurrences exists');
select has_table('public', 'medication_versions', 'medication_versions exists');

select results_eq(
  $$select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.profiles'::regclass$$,
  array[true],
  'profiles has RLS enabled and forced'
);
select results_eq(
  $$select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.medications'::regclass$$,
  array[true],
  'medications has RLS enabled and forced'
);
select results_eq(
  $$select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.medication_schedules'::regclass$$,
  array[true],
  'medication_schedules has RLS enabled and forced'
);
select results_eq(
  $$select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.dose_occurrences'::regclass$$,
  array[true],
  'dose_occurrences has RLS enabled and forced'
);
select results_eq(
  $$select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.medication_versions'::regclass$$,
  array[true],
  'medication_versions has RLS enabled and forced'
);

select results_eq(
  $$select count(*)::bigint from pg_policies
    where schemaname = 'public' and tablename = 'profiles'$$,
  array[4::bigint],
  'profiles has one policy per operation'
);
select results_eq(
  $$select count(*)::bigint from pg_policies
    where schemaname = 'public' and tablename = 'medications'$$,
  array[4::bigint],
  'medications has one policy per operation'
);
select results_eq(
  $$select count(*)::bigint from pg_policies
    where schemaname = 'public' and tablename = 'medication_schedules'$$,
  array[4::bigint],
  'medication_schedules has one policy per operation'
);
select results_eq(
  $$select count(*)::bigint from pg_policies
    where schemaname = 'public' and tablename = 'dose_occurrences'$$,
  array[4::bigint],
  'dose_occurrences has one policy per operation'
);
select results_eq(
  $$select count(*)::bigint from pg_policies
    where schemaname = 'public' and tablename = 'medication_versions'$$,
  array[1::bigint],
  'medication_versions exposes only an owner select policy'
);

select has_column(
  'public', 'medication_schedules', 'retired_at',
  'schedules can be retired without deletion'
);

select results_eq(
  $$select count(*)::bigint from pg_constraint
    where conrelid = 'public.medication_schedules'::regclass
      and contype = 'f'$$,
  array[2::bigint],
  'schedules enforce user and medication ownership relationships'
);
select results_eq(
  $$select count(*)::bigint from pg_constraint
    where conrelid = 'public.dose_occurrences'::regclass
      and contype = 'f'$$,
  array[2::bigint],
  'occurrences enforce user and schedule-medication ownership relationships'
);

select * from finish();
rollback;
