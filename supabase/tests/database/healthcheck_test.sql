begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function('public', 'tuga_healthcheck', array[]::text[], 'healthcheck function exists');

select results_eq(
  $$select count(*) from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'tuga_healthcheck'
      and privilege_type = 'EXECUTE'
      and grantee in ('PUBLIC', 'anon', 'authenticated')$$,
  array[0::bigint],
  'public and client roles cannot execute the database probe'
);

set local role anon;
select throws_ok(
  $$select public.tuga_healthcheck()$$,
  '42501',
  null,
  'anonymous database access is rejected'
);

reset role;
set local role service_role;
select results_eq(
  $$select public.tuga_healthcheck()$$,
  array[true],
  'service role performs a real read-only PostgreSQL query'
);

reset role;
select * from finish();
rollback;
