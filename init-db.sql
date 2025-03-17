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
    WITH ranked_docs AS (
        SELECT 
            d.*,
            CASE 
                WHEN p_embedding IS NOT NULL THEN 1 - (d.embedding <=> p_embedding)
                ELSE ts_rank(d.content_search, websearch_to_tsquery('english', p_query))
            END as similarity
        FROM documents d
        WHERE 
            (p_library IS NULL OR d.library = p_library)
            AND (p_version IS NULL OR d.version = p_version)
            AND (
                (p_query IS NULL OR d.content_search @@ websearch_to_tsquery('english', p_query))
                OR (p_embedding IS NOT NULL AND 1 - (d.embedding <=> p_embedding) > 0.1)
            )
            AND LENGTH(d.content) > 10
        ORDER BY similarity DESC
        LIMIT p_limit
    )
    SELECT 
        r.id,
        r.library,
        r.version,
        CONCAT_WS(
            E'\n\n',
            prev.content,
            r.content,
            next.content
        ) as content,
        r.metadata,
        r.similarity
    FROM ranked_docs r
    LEFT JOIN documents prev ON
        prev.library = r.library 
        AND prev.version = r.version
        AND prev.url = r.url
        AND prev.sort_order = (
                SELECT MAX(documents.sort_order)
                FROM documents
                WHERE documents.library = r.library
                AND documents.version = r.version
                AND documents.url = r.url
                AND documents.sort_order < r.sort_order
        )
    LEFT JOIN documents next ON
        next.library = r.library
        AND next.version = r.version
        AND next.url = r.url
        AND next.sort_order = (
                SELECT MIN(documents.sort_order)
                FROM documents
                WHERE documents.library = r.library
                AND documents.version = r.version
                AND documents.url = r.url
                AND documents.sort_order > r.sort_order
        );
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
