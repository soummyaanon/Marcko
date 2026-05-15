# Backups & Disaster Recovery

## Supabase Point-in-Time Recovery

- Required: PITR enabled on the production Supabase project (7-day window minimum).
- Upgrade to 14-day window before public launch.
- Verify in Supabase dashboard → Database → Backups.

## Weekly offsite dump

Cron task (Vercel Cron or external scheduler):

```bash
pg_dump "$BETTER_AUTH_DATABASE_URL" \
  --schema=public \
  --table=public.documents \
  --table=public.ai_usage \
  --table=public.subscription_events \
  --table=public.dodo_webhook_events \
  --table=public.feedback_widgets \
  --table=public.feedback_responses \
  --no-owner --no-privileges \
  | gzip > marcko-$(date +%Y-%m-%d).sql.gz
# Upload to S3-compatible offsite bucket (R2 / B2 / Backblaze).
```

## Restore drill

Run quarterly:

1. Spin up a throwaway Supabase project.
2. `psql $TARGET < marcko-YYYY-MM-DD.sql`.
3. Boot the app pointing at the throwaway project.
4. Verify: sign in, open a doc, view feedback dashboard, confirm `tier` and `ai_usage` rows present.
5. Tear down.
