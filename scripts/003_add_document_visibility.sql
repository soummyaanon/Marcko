-- Migration: Add visibility column to documents table
-- Non-destructive: all existing rows default to 'public' so no data loss.

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'private'));

CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility);
