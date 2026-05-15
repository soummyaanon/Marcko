-- DOWN script for 008. Manual use only. Reverses each step of
-- 008_pro_tier_constraints_and_existence_check.sql.

-- E. (comments) — optional reversal, leave as-is. The original migration
--    did not set these comments.
comment on column public.ai_rate_buckets.updated_at is null;

-- D. Restore the previous index shape (user_id, created_at).
drop index if exists public.ai_usage_user_kind_month_idx;
create index if not exists ai_usage_user_month_idx
  on public.ai_usage (user_id, created_at);

-- C. Disable RLS on the audit tables and re-create the original ai_usage policy.
comment on table public.subscription_events is null;
comment on table public.dodo_webhook_events is null;
alter table public.subscription_events disable row level security;
alter table public.dodo_webhook_events disable row level security;

comment on table public.ai_usage is null;
-- Re-create the auth.uid()-based read policy (matches the original 007 body).
create policy ai_usage_owner_read
  on public.ai_usage for select
  using (auth.uid()::text = user_id);

-- B. Drop the CHECK constraint on user.tier.
alter table public."user" drop constraint if exists user_tier_check;

-- A. Restore the previous apply_subscription_event body (no existence check).
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
