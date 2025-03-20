-- Install required extensions
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Connect to our database
\c docs_mcp;

-- Create necessary tables for LangChain with improved search capabilities
CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    library VARCHAR(255) NOT NULL CHECK (length(trim(library)) > 0),
    version VARCHAR(100) NOT NULL CHECK (length(trim(version)) > 0),
    url TEXT NOT NULL CHECK (length(trim(url)) > 0),
    content text,
    metadata jsonb,
    embedding vector(1536),
    content_search tsvector,
    sort_order BIGSERIAL
);

-- Create indexes for improved search performance
CREATE INDEX IF NOT EXISTS idx_documents_library ON documents(library);
CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(version);
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON documents USING GIN(content_search);
CREATE INDEX IF NOT EXISTS idx_documents_url_sort ON documents(url, library, version, sort_order);

-- Function to add a new document
CREATE OR REPLACE FUNCTION add_document(
    p_library VARCHAR(255),
    p_version VARCHAR(100),
    p_url TEXT,
    p_content TEXT,
    p_metadata JSONB,
    p_embedding vector(1536)
) RETURNS RECORD AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Validate input parameters
    IF p_library IS NULL OR trim(p_library) = '' THEN
        RAISE EXCEPTION 'library cannot be null or empty';
    END IF;
    
    IF p_version IS NULL OR trim(p_version) = '' THEN
        RAISE EXCEPTION 'version cannot be null or empty';
    END IF;
    
    IF p_url IS NULL OR trim(p_url) = '' THEN
        RAISE EXCEPTION 'url cannot be null or empty';
    END IF;
    
    INSERT INTO documents (library, version, url, content, metadata, embedding, content_search)
    VALUES (p_library, p_version, p_url, p_content, p_metadata, p_embedding, to_tsvector('english', p_content))
    RETURNING id, sort_order INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to delete documents
CREATE OR REPLACE FUNCTION delete_documents(
    p_library VARCHAR(255),
    p_version VARCHAR(100)
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Validate input parameters
    IF p_library IS NULL OR trim(p_library) = '' THEN
        RAISE EXCEPTION 'library cannot be null or empty';
    END IF;
    
    IF p_version IS NULL OR trim(p_version) = '' THEN
        RAISE EXCEPTION 'version cannot be null or empty';
    END IF;
    
    WITH deleted AS (
        DELETE FROM documents
        WHERE library = p_library
        AND version = p_version
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
