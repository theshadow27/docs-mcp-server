-- Install required extensions
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Connect to our database
\c docs_mcp;

-- Create necessary tables for LangChain with improved search capabilities
CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    library VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    content text,
    metadata jsonb,
    embedding vector(1536),
    content_search tsvector
);

-- Create indexes for improved search performance
CREATE INDEX IF NOT EXISTS idx_documents_library ON documents(library);
CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(version);
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON documents USING GIN(content_search);

-- Function to add a new document
CREATE OR REPLACE FUNCTION add_document(
    p_library VARCHAR(255),
    p_version VARCHAR(100),
    p_content TEXT,
    p_metadata JSONB,
    p_embedding vector(1536)
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO documents (library, version, content, metadata, embedding, content_search)
    VALUES (p_library, p_version, p_content, p_metadata, p_embedding, to_tsvector('english', p_content))
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to search documents (supports both keyword and vector search)
CREATE OR REPLACE FUNCTION search_documents(
    p_library VARCHAR(255) DEFAULT NULL,
    p_version VARCHAR(100) DEFAULT NULL,
    p_query TEXT DEFAULT NULL,
    p_embedding vector(1536) DEFAULT NULL,
    p_limit INT DEFAULT 5
) RETURNS TABLE (
    id UUID,
    library VARCHAR(255),
    version VARCHAR(100),
    content TEXT,
    metadata JSONB,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.library,
        d.version,
        d.content,
        d.metadata,
        CASE 
            WHEN p_embedding IS NOT NULL THEN 1 - (d.embedding <=> p_embedding)
            ELSE ts_rank(d.content_search, to_tsquery('english', p_query))
        END as similarity
    FROM documents d
    WHERE 
        (p_library IS NULL OR d.library = p_library)
        AND (p_version IS NULL OR d.version = p_version)
        AND (
            (p_query IS NULL OR d.content_search @@ to_tsquery('english', p_query))
            OR (p_embedding IS NOT NULL)
        )
    ORDER BY similarity DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to delete documents
CREATE OR REPLACE FUNCTION delete_documents(
    p_library VARCHAR(255),
    p_version VARCHAR(100) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM documents
        WHERE library = p_library
        AND (p_version IS NULL OR version = p_version)
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
