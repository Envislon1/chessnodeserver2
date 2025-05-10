
-- Create a function to return the current server time with timezone info
create or replace function public.get_current_time()
returns json
language sql
security definer
as $$
  select json_build_object(
    'server_time', now(),
    'timezone', current_setting('timezone'),
    'timestamp_utc', now() at time zone 'UTC',
    'unix_timestamp', extract(epoch from now())::bigint
  );
$$;

-- Grant execute permission to authenticated and anon users
grant execute on function public.get_current_time() to authenticated, anon;

-- Add comment for documentation
comment on function public.get_current_time() is 'Returns current server time information in various formats';
