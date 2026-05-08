-- Marcko Feedback widget tables.
-- Idempotent: safe to run on a fresh DB or one where lib/feedback.ts has
-- already lazy-created these tables.

CREATE TABLE IF NOT EXISTS feedback_widgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_label TEXT NOT NULL DEFAULT 'Feedback',
  accent TEXT NOT NULL DEFAULT '#111111',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_widgets_user
  ON feedback_widgets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback_responses (
  id TEXT PRIMARY KEY,
  widget_id TEXT NOT NULL REFERENCES feedback_widgets(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_widget
  ON feedback_responses (widget_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_ip_recent
  ON feedback_responses (widget_id, ip_hash, submitted_at DESC);
