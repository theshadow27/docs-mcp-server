-- Install the extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Connect to our database
\c docs_mcp;

-- Create necessary tables for LangChain
CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text,
    metadata jsonb,
    embedding vector(1536)
);
