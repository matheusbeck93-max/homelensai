create schema if not exists private;

-- Recreate the function in the private schema (verbatim logic).
create or replace function private.prevent_subscription_tamper()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;
  if new.subscription_status is distinct from old.subscription_status or
     new.subscription_renews_at is distinct from old.subscription_renews_at or
     new.subscription_cancel_at is distinct from old.subscription_cancel_at then
    raise exception 'Subscription fields can only be modified by Stripe webhooks (service role).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.prevent_subscription_tamper() from public;
revoke execute on function private.prevent_subscription_tamper() from authenticated;

-- Repoint the trigger.
drop trigger if exists prevent_subscription_tamper_trigger on public.profiles;
create trigger prevent_subscription_tamper_trigger
before update on public.profiles
for each row execute function private.prevent_subscription_tamper();

-- Drop the old public-schema function now that nothing references it.
drop function if exists public.prevent_subscription_tamper();