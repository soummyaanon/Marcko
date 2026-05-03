-- Sanity checks: existing data must be untouched.

-- 1. Total documents (should match what you had before).
SELECT 'documents_total' AS check, COUNT(*)::text AS value FROM documents;

-- 2. Every document should have a v0 row.
SELECT 'documents_without_v0' AS check, COUNT(*)::text AS value
FROM documents d
WHERE NOT EXISTS (
  SELECT 1 FROM document_versions v
  WHERE v.document_id = d.id AND v.version = 0
);

-- 3. Each v0's content must equal the document's current content
--    (i.e. backfill copied the exact encrypted blob, no corruption).
SELECT 'v0_content_mismatch' AS check, COUNT(*)::text AS value
FROM documents d
JOIN document_versions v
  ON v.document_id = d.id AND v.version = 0
WHERE v.content IS DISTINCT FROM d.content;

-- 4. Version row totals.
SELECT 'document_versions_total' AS check, COUNT(*)::text AS value
FROM document_versions;
