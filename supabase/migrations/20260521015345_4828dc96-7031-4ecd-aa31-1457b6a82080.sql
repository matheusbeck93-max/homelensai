-- 1. handle_new_user: trigger-only. Move to private and repoint auth trigger.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_full_name text;
begin
  v_full_name := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
  if v_full_name is not null and length(v_full_name) > 200 then
    v_full_name := substring(v_full_name from 1 for 200);
  end if;
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, v_full_name);
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public;
revoke execute on function private.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

drop function if exists public.handle_new_user();

-- 2. has_role: called from RLS policies. Move to private and repoint policies.
create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
-- RLS policies execute as the definer of policy expressions (table owner = postgres),
-- so they do not need EXECUTE granted to authenticated. Keep it locked down.
revoke execute on function private.has_role(uuid, public.app_role) from public;
revoke execute on function private.has_role(uuid, public.app_role) from authenticated;

-- Repoint user_roles policies.
drop policy if exists "Admins can delete roles" on public.user_roles;
drop policy if exists "Admins can insert roles" on public.user_roles;
drop policy if exists "Admins can view all roles" on public.user_roles;

create policy "Admins can delete roles" on public.user_roles
  for delete to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins can insert roles" on public.user_roles
  for insert to authenticated with check (private.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins can view all roles" on public.user_roles
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Repoint tool_call_telemetry policy.
drop policy if exists "Admins can view telemetry" on public.tool_call_telemetry;
create policy "Admins can view telemetry" on public.tool_call_telemetry
  for select to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role));

drop function if exists public.has_role(uuid, public.app_role);