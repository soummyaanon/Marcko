-- Pro tier flag on Better-Auth's user table
alter table public."user"
  add column if not exists tier text not null default 'free';
alter table public."user"
  add column if not exists pro_until timestamptz;
alter table public."user"
  add column if not exists dodo_customer_id text;
create index if not exists user_dodo_customer_idx
  on public."user" (dodo_customer_id)
  where dodo_customer_id is not null;

-- AI usage metering (one row per successful AI action)
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public."user"(id) on delete cascade,
  kind text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  ms int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_month_idx
  on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;
create policy ai_usage_owner_read
  on public.ai_usage for select
  using (auth.uid()::text = user_id);

-- Burst rate-limit buckets (token-bucket per user)
create table if not exists public.ai_rate_buckets (
  user_id text primary key references public."user"(id) on delete cascade,
  window_start timestamptz not null default now(),
  tokens int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ai_rate_buckets enable row level security;

-- Dodo webhook idempotency
create table if not exists public.dodo_webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- Append-only subscription audit log
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public."user"(id) on delete restrict,
  source text not null,
  event_type text not null,
  dodo_event_id text,
  previous_tier text,
  new_tier text,
  previous_pro_until timestamptz,
  new_pro_until timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_user_idx
  on public.subscription_events (user_id, created_at desc);

-- Atomic tier mutator (called by webhook handler)
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
