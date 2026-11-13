create or replace function public.tuga_healthcheck()
returns boolean
language sql
stable
set search_path = ''
as $$
  select true;
$$;

comment on function public.tuga_healthcheck() is
  'Performs a read-only PostgreSQL availability probe without accessing user data.';

revoke all on function public.tuga_healthcheck() from public, anon, authenticated;
grant execute on function public.tuga_healthcheck() to service_role;
