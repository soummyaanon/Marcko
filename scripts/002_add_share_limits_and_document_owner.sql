-- Add user ownership to documents (Better Auth user id)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- Guest usage table to enforce exactly one anonymous share
CREATE TABLE IF NOT EXISTS guest_share_usage (
  guest_id TEXT PRIMARY KEY,
  share_count INTEGER NOT NULL DEFAULT 1,
  first_shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE guest_share_usage ENABLE ROW LEVEL SECURITY;

-- Keep public read on shared docs, but remove public insert.
DROP POLICY IF EXISTS "Allow public insert access" ON documents;

CREATE POLICY "Allow authenticated insert access" ON documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
