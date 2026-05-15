-- 008: Tighten the schema introduced by 007.
-- MUST run AFTER 007_add_pro_tier_and_usage.sql.
--
-- This migration:
--   A. Adds an existence check inside apply_subscription_event so unknown
--      users raise no_data_found (webhook handler will ack and stop Dodo
--      retries) instead of failing later with an opaque FK violation.
--   B. Adds CHECK (tier in ('free','pro')) on public."user".
--   C. Cleans up RLS posture: drops the dead auth.uid()-based policy on
--      ai_usage (Marcko uses Better-Auth, not Supabase Auth), enables RLS
--      on the two audit tables for posture consistency, and documents the
--      service-role-only access path.
--   D. Replaces ai_usage_user_month_idx with (user_id, kind, created_at)
--      so the monthly-quota query is index-only.
--   E. Documents the caller-maintained updated_at contract on
--      ai_rate_buckets.

-- ---------------------------------------------------------------------------
-- A. Existence check in apply_subscription_event
-- ---------------------------------------------------------------------------
create or replace function public.apply_subscription_event(
  p_user_id text,
  p_new_tier text,
  p_new_pro_until timestamptz,
  p_event_type text,
  p_dodo_event_id text,
  p_raw jsonb
) returns void
language plpgsql
as $$
declare
  prev_tier text;
  prev_pro_until timestamptz;
begin
  select tier, pro_until into prev_tier, prev_pro_until
    from public."user" where id = p_user_id for update;

  if not found then
    raise exception 'apply_subscription_event: user % does not exist', p_user_id
      using errcode = 'no_data_found';
  end if;

  update public."user"
    set tier = p_new_tier, pro_until = p_new_pro_until
    where id = p_user_id;

  insert into public.subscription_events
    (user_id, source, event_type, dodo_event_id,
     previous_tier, new_tier, previous_pro_until, new_pro_until, raw)
  values
    (p_user_id, 'dodo_webhook', p_event_type, p_dodo_event_id,
     prev_tier, p_new_tier, prev_pro_until, p_new_pro_until, p_raw);
end;
$$;

-- ---------------------------------------------------------------------------
-- B. CHECK constraint on user.tier
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_tier_check'
  ) then
    alter table public."user"
      add constraint user_tier_check check (tier in ('free','pro'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- C. RLS posture cleanup
-- ---------------------------------------------------------------------------
drop policy if exists ai_usage_owner_read on public.ai_usage;
comment on table public.ai_usage is
  'Service-role only. Marcko uses Better-Auth; auth.uid() does not match user_id here. Reads go through server routes that use lib/supabase/admin.ts with the service-role key.';

alter table public.dodo_webhook_events enable row level security;
alter table public.subscription_events enable row level security;
comment on table public.dodo_webhook_events is 'Service-role only. RLS enabled with no policies.';
comment on table public.subscription_events is 'Service-role only. RLS enabled with no policies. Append-only audit log.';

-- ---------------------------------------------------------------------------
-- D. Recreate ai_usage index to include kind
-- ---------------------------------------------------------------------------
drop index if exists public.ai_usage_user_month_idx;
create index if not exists ai_usage_user_kind_month_idx
  on public.ai_usage (user_id, kind, created_at);

-- ---------------------------------------------------------------------------
-- E. Document ai_rate_buckets.updated_at caller contract
-- ---------------------------------------------------------------------------
comment on column public.ai_rate_buckets.updated_at is
  'Caller must set on every UPSERT — there is no trigger maintaining this.';
