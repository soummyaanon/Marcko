# Marcko Pro — "Ask Marcko" Agent (Design)

**Date:** 2026-05-15
**Status:** Draft for review
**Author:** brainstorming session (Soumyaranjan + Claude)

---

## 1. Goal

Ship a paid tier — **Marcko Pro at $6/month** — built around a single in-product agent ("Ask Marcko") that leverages Marcko's unique data surfaces:

- Your private document library
- Your shared/published docs (and their readers)
- Your feedback widget responses
- Your MCP/API tool surface

The agent must feel like one product (one mental model, one chat primitive) but operate in five concrete feature modes, each rolled out in phases.

## 2. Top-5 Pro Features (the product surface)

| # | Feature | Phase | One-line value |
|---|---|---|---|
| 1 | **Inline AI in the editor** | 1 | Select → rewrite / expand / shorten / fix grammar / translate / change tone; `/ai` slash to generate sections, mermaid diagrams, tables, HTML/CSS/JS snippets. |
| 2 | **Ask-Your-Library** | 2 | Sidebar chat indexed over every doc you saved; answers cite sources with deep links. |
| 3 | **Talkable Shared Docs** | 3 | Each shared doc gets an optional "Ask this doc" widget for readers. Owner sees question analytics. |
| 4 | **Feedback Intelligence** | 4 | Cluster themes / sentiment / draft reply suggestions / weekly digest over feedback responses. |
| 5 | **Marcko Agent (tool-using)** | 5 | Chat that *acts*: drafts a doc, attaches a feedback widget, publishes — reuses your `marcko-mcp` tool surface in-app. |

This design doc fully specifies **Phase 0 (Foundation) + Phase 1 (Inline AI)**. Phases 2–5 each get their own spec.

## 3. Non-Goals (Phase 0/1)

- No multi-tenant team/workspace billing — single-user Pro only for v1.
- No image generation, no voice, no agent memory persistence beyond the current chat.
- No fine-tuning. No custom models.
- No webhook to push events back to Marcko users (one-way: Dodo → Marcko).
- No prorations / mid-cycle plan switches — single $6/mo product only.

## 4. Tech Stack Decisions

| Concern | Pick | Rationale |
|---|---|---|
| AI SDK | **Vercel AI SDK v6** (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) | Streaming `useChat`, first-class tools, MCP client built-in, native to Next.js App Router. |
| Provider | **OpenAI direct** via `@ai-sdk/openai` | User decision. Default models: `gpt-5-mini` (fast/cheap for inline edits), `gpt-5` (agent/complex). Constants live in `lib/ai/models.ts` for easy swap. |
| Embeddings | `openai.textEmbeddingModel('text-embedding-3-small')` | Cheap, 1536-dim, plays nice with pgvector. |
| Vector store | **Supabase pgvector** | Already on Supabase; encrypted at rest; no new vendor. |
| Payments | **Dodo Payments** (`dodopayments` Node SDK + `@dodopayments/next` adapter where useful) | User decision. Standard Webhooks signature verification. |
| Quota store | Supabase `ai_usage` table (monthly aggregate) | Simple, no Redis dep. |
| Tier flag | `users.tier` column ('free' \| 'pro') + `users.pro_until` timestamp | Authoritative source for gating. Set by Dodo webhook. |

## 5. Architecture

### 5.1 High-level data flow (Phase 0 + 1)

```
┌────────────────┐         ┌──────────────────────┐
│  Editor (RSC)  │ ──POST──▶ /api/ai/inline       │
│  client comp.  │ ◀─SSE──  │   (streamText)      │
└────────────────┘         └────────┬─────────────┘
                                    │
                                    ▼
                          ┌───────────────────────┐
                          │  withProGate()        │
                          │  withQuota()          │
                          │  withUsageLogging()   │
                          └────────┬──────────────┘
                                   │
                                   ▼
                          @ai-sdk/openai → OpenAI

┌─────────────┐  webhook  ┌──────────────────────┐
│   Dodo      │ ─────────▶│ /api/billing/dodo/   │
│ Payments    │           │   webhook            │
└─────────────┘           │  (verify signature → │
                          │   update users.tier) │
                          └──────────────────────┘
```

### 5.2 Module layout

```
lib/ai/
  models.ts              // model id constants + per-task model picker
  openai.ts              // shared @ai-sdk/openai instance
  guards.ts              // withProGate, withQuota, withUsageLogging wrappers
  usage.ts               // recordUsage(userId, kind, tokens)
  prompts/
    inline.ts            // prompt builders for rewrite/expand/shorten/...
lib/billing/
  dodo.ts                // dodo client + helpers (createCheckout, listSubs)
  webhook.ts             // signature verification + event dispatch
  plans.ts               // PRO_PRODUCT_ID, PRO_MONTHLY_QUOTAS
app/api/ai/
  inline/route.ts        // POST  streaming inline-edit endpoint
app/api/billing/
  checkout/route.ts      // POST  create Dodo checkout session, return url
  dodo/webhook/route.ts  // POST  Dodo webhook receiver
  portal/route.ts        // POST  customer portal redirect
app/pricing/page.tsx     // server component, public marketing + CTA
components/
  pro-gate.tsx           // shows lock + upgrade CTA when tier=free
  editor/
    ai-inline-menu.tsx   // selection-aware floating menu
    ai-slash-menu.tsx    // "/" menu inside editor for generate actions
```

### 5.3 Database additions (Supabase migrations)

`scripts/003_add_pro_tier_and_usage.sql`:

```sql
-- Tier flag on the users table managed by Better-Auth
alter table public.user add column if not exists tier text not null default 'free';
alter table public.user add column if not exists pro_until timestamptz;
alter table public.user add column if not exists dodo_customer_id text;

-- Quota / metering
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.user(id) on delete cascade,
  kind text not null,           -- 'inline_edit' | 'library_chat' | ...
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  ms int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_month_idx
  on public.ai_usage (user_id, created_at);

-- Idempotency for Dodo webhooks (avoid double-processing on retries)
create table if not exists public.dodo_webhook_events (
  id text primary key,           -- event id from Dodo
  type text not null,
  received_at timestamptz not null default now()
);
```

Plus `subscription_events` (append-only audit table — see §8.10).

Phase-2+ adds `document_embeddings` (deferred to its own spec).

### 5.4 Pro gating

`withProGate(handler)` middleware:

1. Authenticate via Better-Auth `getSession()`.
2. Look up `users.tier` and `users.pro_until`.
3. `isPro = tier === 'pro' && (pro_until == null || pro_until > now())`.
4. If not pro → return 402 `{ error: 'pro_required', upgradeUrl: '/pricing' }`.

Client `<ProGate>` component reads the same flag from a `useSession()` hook and renders a lock overlay + "Upgrade" button when needed. Inline AI menu items are visible but disabled with a "Pro" badge for free users (don't hide — drives upgrades).

### 5.5 Quota

`withQuota(kind)` reads `ai_usage` rows for `user_id` in the current calendar month, sums actions of `kind`, compares to `PRO_MONTHLY_QUOTAS[kind]`. Returns 429 with quota info when over.

Phase-1 quota (final numbers tune-able in `lib/billing/plans.ts`):

```ts
export const PRO_MONTHLY_QUOTAS = {
  inline_edit: 500,
  // Reserved for later phases (not yet enforced):
  library_chat: 200,
  shared_doc_chat: 1_000,   // counted on the doc owner's account
  feedback_digest: 30,
  agent_run: 100,
} as const;
```

Free tier: **inline_edit: 10/month trial credit** — enough to feel the magic, not enough to live on.

### 5.6 Usage logging

After each successful stream completes, write one `ai_usage` row using AI SDK's `onFinish` callback (provides `usage` token counts).

## 6. Phase 1: Inline AI in the editor

### 6.1 UX

- **Selection menu**: select text in `MarkdownEditor` → floating menu appears with: Rewrite · Expand · Shorten · Fix grammar · Translate (sub-menu) · Change tone (sub-menu). Each runs in place, streaming a unified diff preview; user accepts/rejects.
- **Slash menu**: type `/ai` on an empty line → menu: Generate section · Mermaid diagram · Table · Code snippet · Summarize selection. Streams output into the editor where the slash was triggered.
- **Cancellation**: ESC cancels mid-stream; partial output is discarded (no half-edits).
- **Free tier**: menu visible, item shows "Pro" pill; clicking opens `/pricing` modal.

### 6.2 API contract — `POST /api/ai/inline`

Request:
```ts
{
  action: 'rewrite' | 'expand' | 'shorten' | 'grammar'
        | 'translate' | 'tone'
        | 'generate_section' | 'mermaid' | 'table' | 'code' | 'summarize',
  selection: string,        // empty for slash-generated content
  context?: string,         // surrounding paragraph(s), capped server-side
  options?: {
    targetLanguage?: string,    // for translate
    tone?: 'casual' | 'formal' | 'technical' | 'friendly',
    instructions?: string,      // free-form for /ai generate
  }
}
```

Response: AI SDK data stream (consumed by `useCompletion` on the client).

Server:
- Wrapped in `withProGate → withQuota('inline_edit') → withUsageLogging`.
- Prompts built per-action in `lib/ai/prompts/inline.ts`. Each enforces "return only the replacement text, no commentary."
- Model: `gpt-5-mini` for all inline actions. Slash `generate_section` upgrades to `gpt-5` when `selection.length === 0 && context.length > 4000`.
- Hard caps: input ≤ 12k chars trimmed from `context` (keep the selection + nearest paragraphs), output `maxOutputTokens: 1024` (raise to 2048 for `generate_section`).

### 6.3 Prompt strategy

Each action has a small system prompt + a user message of the form:
```
<context>{context}</context>
<selection>{selection}</selection>
Task: <action-specific instruction>
Output: replacement for <selection> only. No explanations, no fences unless the original was in a fence.
```

Mermaid action wraps output in ```` ```mermaid ```` fences automatically.

### 6.4 Streaming + apply

Client uses `useCompletion({ api: '/api/ai/inline' })` and writes tokens into a transient diff overlay. On stop, user clicks ✓ to apply (replace selection / insert at cursor) or ✗ to discard.

## 7. Phase 0: Billing (Dodo Payments)

### 7.1 Product setup (one-time, in Dodo dashboard)

- Create one subscription product: **Marcko Pro — $6/month**.
- Record `PRO_PRODUCT_ID` in env: `DODO_PRO_PRODUCT_ID`.

### 7.2 Env

```env
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_WEBHOOK_SECRET=
DODO_PRO_PRODUCT_ID=
NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT=test_mode   # 'live_mode' in prod
NEXT_PUBLIC_APP_URL=                               # already exists
OPENAI_API_KEY=                                    # already provided
```

### 7.3 Checkout flow — `POST /api/billing/checkout`

1. Auth required.
2. If `users.dodo_customer_id` missing → create / find customer via `dodo.customers.create({ email, name })`, persist id.
3. `dodo.checkoutSessions.create({ product_cart: [{ product_id: DODO_PRO_PRODUCT_ID, quantity: 1 }], customer: { customer_id }, return_url: ${APP_URL}/pricing?status=success })`.
4. Return `{ checkoutUrl }` to client → redirect.

### 7.4 Webhook — `POST /api/billing/dodo/webhook`

- Raw body read once for signature verify.
- Verify `webhook-signature` header per Standard Webhooks (HMAC-SHA256 against `DODO_PAYMENTS_WEBHOOK_SECRET`). Reject on failure with 400.
- Insert into `dodo_webhook_events`; if conflict → already processed, return 200 immediately.
- Dispatch by `type`:
  - `subscription.active` → `users.tier='pro'`, `users.pro_until = current_period_end`, set `dodo_customer_id`.
  - `subscription.updated` → refresh `pro_until` from event.
  - `subscription.cancelled` / `subscription.expired` → `users.tier='free'`, `users.pro_until = null`.
- Always 200 on processed events (idempotent). 5xx only on infra failure (so Dodo retries).

### 7.5 Portal — `POST /api/billing/portal`

Thin wrapper around `dodo.customers.portal.create()` (or equivalent) returning a redirect URL.

### 7.6 Pricing page

`app/pricing/page.tsx` — public; if signed in, CTA hits `/api/billing/checkout`; if not, opens Google sign-in modal first. Shows all 5 Pro features as "Coming with Pro" — even Phases 2–5 — to set expectations.

## 8. Security & Data Integrity (cross-cutting, non-negotiable)

This applies to every phase. Every PR must check the box for the items relevant to it.

### 8.1 Secrets & keys

- `OPENAI_API_KEY`, `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DOCUMENT_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` — **server-only**. Never imported into a `"use client"` file, never prefixed `NEXT_PUBLIC_`.
- Enforce via an ESLint rule (`no-restricted-imports` on `process.env.*` from client files) and a CI grep that fails the build if any of the secret names appear in the client bundle (`.next/static`).
- Add a startup assertion in `lib/env.ts` (zod-validated) that throws if any required secret is missing in production. No silent fallbacks.
- Rotation: document keys in `docs/operations/secrets.md`; quarterly rotation cadence. Webhook secret rotation is a two-step (add new, drain old) — handler accepts either during the window.

### 8.2 Authentication & authorization

- Every route under `/api/ai/*` and `/api/billing/*` calls `getSession()` first. No anonymous access except the Dodo webhook (which authenticates via signature) and Phase-3 talkable-doc reader endpoint (rate-limited, no PII).
- Authorization is **resource-scoped**: any route that touches a `document` or `feedback_widget` must verify `row.owner_id === session.user.id` before doing anything else. Centralize in `lib/auth/can.ts` so the same predicate is used in API + RSC.
- Better-Auth sessions are HttpOnly cookies, `Secure`, `SameSite=Lax`. Confirm CSRF protection is on for state-changing POSTs (Better-Auth handles this; we verify in tests).
- Don't trust `users.tier` from the client — always re-read server-side inside `withProGate`.

### 8.3 Input validation

- Every API route validates its body with **zod** at the boundary; reject with 400 + safe message on parse fail.
- Hard limits enforced server-side regardless of client UI:
  - `selection` ≤ 8 KB, `context` ≤ 16 KB (truncated, not rejected, for `inline`).
  - `messages` array ≤ 50 entries, each message ≤ 16 KB (later phases).
  - Reject any field containing non-printable control chars except `\n`, `\r`, `\t`.

### 8.4 Prompt-injection defense

- AI output is **never** executed or trusted as control flow. Tool-calling (Phase 5) requires every tool call to map to a typed action — model output is data, not code.
- Content from other users (Phase 3 talkable-doc reader chat) is wrapped in `<untrusted_content>` tags in the prompt; system prompt explicitly tells the model to ignore instructions inside those tags.
- AI-rendered HTML/JS stays inside the existing **iframe sandbox** (`live-preview-sandbox.tsx`, `sandbox="allow-scripts"` only, no `allow-same-origin`). Mermaid output is rendered by the existing mermaid component, which doesn't `eval`.
- Document content sent to OpenAI is never logged into `ai_usage`; we store only token counts, model id, ms, and action kind.

### 8.5 Rate limiting (separate from monthly quota)

- Per-user burst: ≤ **10 AI requests / 10s**, ≤ **60 / minute**. Enforced via Supabase (token-bucket row keyed by user id) — no Redis dep.
- Per-IP for unauthenticated talkable-doc reader chat (Phase 3): ≤ **20 / minute / IP**, ≤ **200 / day / IP / doc**.
- `/api/billing/checkout` is limited to ≤ **5 / hour / user** to prevent abuse loops.

### 8.6 Webhook security

- Read raw body **before** `req.json()` so the signature is verified against the exact bytes Dodo signed.
- Signature comparison uses **`crypto.timingSafeEqual`** to prevent timing leaks.
- Reject events older than **5 minutes** (replay window).
- `dodo_webhook_events.id` is a primary key — duplicate insert means "already processed, return 200 immediately." Verification happens **before** the idempotency insert; an invalid signature never touches the DB.
- All `users.tier` mutations triggered by webhooks happen inside a single SQL `UPDATE` (atomic). We never read-then-write.
- Audit log: every successful webhook also writes a row to `subscription_events` (see §8.10) — append-only, never deleted.

### 8.7 Data integrity in the editor (no-data-loss rules)

- AI inline edits **never** overwrite the user's text directly. The streamed result lives in a transient overlay; the underlying buffer is unchanged until the user clicks ✓ accept. ESC / ✗ discards the suggestion.
- Before applying an accepted suggestion, push the prior selection onto a **client-side undo stack** (≥ 25 entries, in-memory). Browser back/forward never closes the page without confirming if there are unsaved changes.
- Existing **encrypted draft autosave** (`/api/draft`) continues to run on a debounce (≤ 2s) independently of AI; AI flows don't bypass it. Verified by an integration test.
- On AI stream error, the overlay is discarded — we never write a partial AI completion to the document or to the draft.
- Local-storage `marcko-content` backup is kept in addition to server draft, so a single source failure can't lose work.

### 8.8 Encryption boundaries

- `DOCUMENT_ENCRYPTION_KEY` already encrypts shared document content at rest (existing system, do not change).
- Embeddings (Phase 2) are derived from plaintext but stored as float vectors; we treat them as **sensitive but reversible-ish** — accessible only via the user's own session, never returned over public APIs. The `document_embeddings` table has Supabase Row-Level Security: `auth.uid()::text = owner_id`.
- Phase-3 talkable-doc reader chat retrieves embeddings only for the **specific shared doc** the reader has access to (via the same access-token check as the existing share-view). Never cross-doc retrieval for readers.

### 8.9 Tier-downgrade data preservation

When a Dodo `subscription.cancelled` / `expired` event flips a user back to `free`:

- **Nothing is deleted.** Documents, drafts, embeddings, feedback widgets, responses, usage history — all preserved.
- Pro features become gated (return 402 + upgrade CTA), not destructive.
- `ai_usage` rows are kept for at least **12 months** (analytics + dispute resolution); only quota-counting reads the current month.
- Re-subscribing restores access instantly — no re-onboarding, no data migration.

### 8.10 Audit log

New table, append-only, never modified:

```sql
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.user(id) on delete restrict,
  source text not null,         -- 'dodo_webhook' | 'admin' | 'system'
  event_type text not null,     -- mirrors Dodo event type
  dodo_event_id text,           -- nullable, for non-Dodo sources
  previous_tier text,
  new_tier text,
  previous_pro_until timestamptz,
  new_pro_until timestamptz,
  raw jsonb,                    -- redacted event payload
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_user_idx
  on public.subscription_events (user_id, created_at desc);
```

`on delete restrict` deliberately blocks user deletion when audit rows exist; user deletion goes through a separate soft-delete path (out of scope this phase but documented).

### 8.11 Database safety

- All migrations are **idempotent** (`if not exists`, `add column if not exists`). Each migration has a paired down-script in `scripts/down/` (manually run only).
- Supabase **Point-in-Time Recovery** (PITR) must be enabled on the project (operations checklist). Add to README setup.
- `ai_usage`, `subscription_events`, `dodo_webhook_events`, and Phase-2 `document_embeddings` all have **Row-Level Security** policies enforcing `auth.uid()::text = user_id` (or equivalent owner predicate).
- All cross-table mutations triggered by webhooks use a single transactional function (`process_subscription_event(...)` SQL function) so partial state is impossible.

### 8.12 Logging & PII

- Server logs **never** contain: document/selection content, feedback response text, user emails (use user id), API keys, full webhook payloads (store in `subscription_events.raw` redacted).
- Error responses to clients are **safe by default** — internal errors return `{ error: 'internal_error', requestId }`; full detail is in server logs keyed by `requestId`.

### 8.13 Backups & disaster recovery

- Supabase PITR: 7-day window (free) — upgrade to 14-day before public launch.
- Weekly logical `pg_dump` of all custom tables (`ai_usage`, `subscription_events`, `dodo_webhook_events`, `document_embeddings`, `documents`, `feedback_*`) to an offsite bucket. Documented in `docs/operations/backups.md` (created with the rollout PR).
- Restore drill: documented procedure, run before public launch.

### 8.14 Verification gates per PR

Each implementation PR adds a checklist comment confirming relevance to:

- [ ] Zod validation on new endpoints
- [ ] `getSession()` + resource ownership check on new endpoints
- [ ] No secret leaks to client bundle (verified by build grep)
- [ ] Idempotent migration + RLS policies
- [ ] Tests cover failure paths (auth fail, quota over, webhook bad sig, AI error)
- [ ] No raw user content in logs

## 9. Error handling

| Surface | Failure mode | Behavior |
|---|---|---|
| `/api/ai/inline` | OpenAI 5xx / rate limit | Stream a final `error` chunk; client surfaces toast and rolls back overlay; **does not** count against quota. |
| `/api/ai/inline` | Quota exceeded | 429 `{ error: 'quota_exceeded', kind, used, limit, resetsAt }` → client shows quota toast with link to `/pricing` (or upgrade). |
| `/api/billing/checkout` | Dodo 4xx/5xx | Return 502 with safe message; log raw error server-side. |
| Webhook | Signature mismatch | 400 (no body); alert via server log. |
| Webhook | Unknown event type | 200 (acknowledge, ignore). |
| Webhook | DB write fails post-verify | 500 → Dodo retries (idempotency table prevents double-apply). |

## 10. Testing strategy

- **Unit:** `lib/billing/webhook.ts` signature verification (good/bad signature, replay), prompt builders (snapshot tests), quota math.
- **Integration (vitest + Supabase test schema):** webhook handler updates `users.tier` correctly for each event; quota wrapper rejects at limit; `withProGate` returns 402 for free user.
- **Manual smoke (recorded in QA checklist):**
  1. Free user sees Pro pills, click → `/pricing`.
  2. Test-mode Dodo checkout → returns to app → tier flips to `pro` within 5s.
  3. Inline rewrite on a 200-char selection completes <4s.
  4. Cancel via portal → tier flips back to `free`.
  5. Replay a captured webhook → no double-credit.

## 11. Rollout

1. Ship behind `NEXT_PUBLIC_PRO_ENABLED=false` to start; QA team flips it on per env.
2. Soft-launch to existing signed-in users with a "Free 10 inline edits this month" banner.
3. Public `/pricing` page goes live after smoke tests pass on `live_mode` Dodo product.

## 12. Open decisions deferred to later phase specs

- **Phase 2 (Ask-Your-Library):** how/when documents get embedded (on save? nightly? on first chat?); chunking strategy; retrieval reranker (start without one).
- **Phase 3 (Talkable Shared Docs):** abuse / rate-limit by IP for anonymous readers; per-doc owner toggle and analytics view; cost attribution to doc owner's quota.
- **Phase 4 (Feedback Intelligence):** digest delivery (email vs. in-app); theming algorithm (cluster vs. taxonomy prompt).
- **Phase 5 (Marcko Agent):** whether to re-host `marcko-mcp` in-process or call its tools directly; tool permissioning UI; confirmation prompts before destructive actions.

## 13. Definition of done — Phase 0 + 1

- [ ] Migration `003_*.sql` applied in staging.
- [ ] OpenAI + Dodo env vars present in Vercel project (test_mode).
- [ ] Free user: inline menu shows Pro pills; click → pricing.
- [ ] Pro user: rewrite / expand / shorten / grammar / translate / tone / `/ai` generate-section + mermaid all work end-to-end with streaming.
- [ ] Dodo test-mode checkout → user flips to `pro` via webhook within 5 seconds.
- [ ] Quota wrapper enforces 500/mo, free-trial 10/mo.
- [ ] Usage rows written on every successful stream.
- [ ] Replayed webhook is a no-op.
- [ ] `/pricing` page live, shows all 5 features.
- [ ] All §8 security checklist items verified (zod, auth, RLS, no secrets in client bundle, rate-limit, timing-safe webhook compare, audit log writing).
- [ ] Inline AI never overwrites text without explicit accept (verified by integration test).
- [ ] Tier downgrade preserves all user data; re-subscribe restores instantly (verified by manual test #4 + integration test).
- [ ] PITR enabled on Supabase project; backup procedure documented in `docs/operations/backups.md`.
