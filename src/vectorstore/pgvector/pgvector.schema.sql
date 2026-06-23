CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
  id          UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  filename    TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text        TEXT NOT NULL,
  embedding   vector(768),  -- Gemini embeddings are configured to 768 dimensions
  page_number INTEGER,
  sheet_name  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS chunks_text_fts_idx ON chunks USING gin (to_tsvector('english', text));
