-- Document version history.
-- v0 is the original (first save). Each content update appends v(max+1).
-- Content is stored encrypted, same format as documents.content.

CREATE TABLE IF NOT EXISTS document_versions (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc_created
  ON document_versions(document_id, created_at DESC);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'document_versions'
      AND policyname = 'Allow public read access'
  ) THEN
    CREATE POLICY "Allow public read access"
    ON document_versions
    FOR SELECT
    USING (true);
  END IF;
END
$$;

-- Backfill: seed v0 from documents.content for any document that has no versions yet.
INSERT INTO document_versions (document_id, version, content, created_at)
SELECT d.id, 0, d.content, COALESCE(d.created_at, NOW())
FROM documents d
LEFT JOIN document_versions v ON v.document_id = d.id
WHERE v.document_id IS NULL;
