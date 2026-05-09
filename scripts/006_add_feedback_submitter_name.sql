-- Marcko Feedback: built-in submitter name field.
-- Idempotent.

ALTER TABLE feedback_widgets
  ADD COLUMN IF NOT EXISTS collect_name BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE feedback_widgets
  ADD COLUMN IF NOT EXISTS name_required BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE feedback_responses
  ADD COLUMN IF NOT EXISTS submitter_name TEXT;
