-- DOWN script. Manual use only. Run BEFORE deploying any later migration
-- that depends on these objects. Will fail if subscription_events has rows
-- (the on-delete-restrict guards user deletion separately).

drop function if exists public.apply_subscription_event(text, text, timestamptz, text, text, jsonb);

drop table if exists public.subscription_events;
drop table if exists public.dodo_webhook_events;
drop table if exists public.ai_rate_buckets;
drop table if exists public.ai_usage;

alter table public."user" drop column if exists dodo_customer_id;
alter table public."user" drop column if exists pro_until;
alter table public."user" drop column if exists tier;
