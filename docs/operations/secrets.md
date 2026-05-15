# Secrets — Marcko

## Inventory

| Name | Where | Rotation |
|---|---|---|
| `OPENAI_API_KEY` | Vercel project env | Quarterly |
| `DODO_PAYMENTS_API_KEY` | Vercel project env | Quarterly |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Vercel project env | Two-step (see below) |
| `BETTER_AUTH_SECRET` | Vercel project env | Yearly (forces re-auth) |
| `DOCUMENT_ENCRYPTION_KEY` | Vercel project env | DO NOT rotate without re-encrypting all shared docs |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel project env | Yearly |

## Rules

- No secret has a `NEXT_PUBLIC_` prefix.
- The post-build grep in `Task 23` of the rollout plan blocks releases that leak any of the above into the client bundle; the same check should be wired into CI before public launch.
- Local `.env` is git-ignored. Never paste a real key into a commit or PR comment.

## Two-step webhook secret rotation

1. Add the new secret in the Dodo dashboard; keep the old one marked "still valid for 7 days".
2. Update `DODO_PAYMENTS_WEBHOOK_SECRET` in Vercel **preview** env first; deploy; verify a test webhook signs and verifies.
3. Update **production** env; redeploy.
4. After 7 days, retire the old secret in Dodo dashboard.

During the overlap, `app/api/billing/dodo/webhook/route.ts` can be patched to accept either secret. Only implement that branch when the first rotation is actually scheduled — keep the code simple in the meantime.
