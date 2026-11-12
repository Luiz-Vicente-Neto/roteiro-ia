-- pgvector for the RAG search (stage 3). Enabled by migration, not by the
-- container, so the same step runs locally, in CI and on Supabase.
CREATE EXTENSION IF NOT EXISTS vector;
