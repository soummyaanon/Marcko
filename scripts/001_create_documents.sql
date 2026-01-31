-- Create documents table for storing shared markdown content
-- Drop existing table if it exists to apply schema changes
DROP TABLE IF EXISTS documents;

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS but allow public read access for shared documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read documents (for sharing functionality)
CREATE POLICY "Allow public read access" ON documents 
  FOR SELECT 
  USING (true);

-- Allow anyone to insert documents (no auth required for this app)
CREATE POLICY "Allow public insert access" ON documents 
  FOR INSERT 
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
