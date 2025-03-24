import type { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import pg from "pg";
import { ConnectionError, StoreError } from "./errors";
import { DocumentMetadata } from "../types";

/**
 * Manages document storage and retrieval using pgvector for vector similarity search.
 * Provides an abstraction layer over PostgreSQL with vector extensions to store and
 * query document embeddings along with their metadata. Supports versioned storage
 * of documents for different libraries, enabling version-specific document retrieval
 * and searches.
 */
export class DocumentStore {
  private readonly pool: pg.Pool;
  private embeddings: OpenAIEmbeddings;

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new StoreError("Missing required environment variable: POSTGRES_CONNECTION");
    }
    this.pool = new pg.Pool(this.parseConnectionString(connectionString));
    this.embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
      stripNewLines: true,
      batchSize: 512,
    });
  }

  private parseConnectionString(connectionString: string): pg.PoolConfig {
    const url = new URL(connectionString);
    return {
      type: "postgres",
      host: url.hostname,
      port: Number.parseInt(url.port) || 5432,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    } as pg.PoolConfig;
  }

  /**
   * Initializes database connection and ensures readiness
   */
  async initialize(): Promise<void> {
    try {
      await this.pool.query("SELECT 1");
    } catch (error) {
      throw new ConnectionError(
        "Failed to initialize database connection",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Gracefully closes database connections
   */
  async shutdown(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Retrieves all unique versions for a specific library
   */
  async queryUniqueVersions(library: string): Promise<string[]> {
    try {
      const result = await this.pool.query(
        "SELECT DISTINCT version FROM documents WHERE library = $1",
        [library],
      );
      return result.rows.map((row) => row.version);
    } catch (error) {
      throw new ConnectionError(
        "Failed to query versions",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Verifies existence of documents for a specific library version
   */
  async checkDocumentExists(library: string, version: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "SELECT EXISTS(SELECT 1 FROM documents WHERE library = $1 AND version = $2)",
        [library, version],
      );
      return result.rows[0].exists;
    } catch (error) {
      throw new ConnectionError(
        "Failed to check document existence",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Retrieves a mapping of all libraries to their available versions
   */
  async queryLibraryVersions(): Promise<Map<string, Set<string>>> {
    interface QueryResult {
      library: string;
      version: string;
    }
    try {
      const result = await this.pool.query<QueryResult>(
        "SELECT DISTINCT library, version FROM documents",
      );
      const libraryMap = new Map<string, Set<string>>();

      for (const row of result.rows) {
        const library = row.library;
        const version = row.version;

        if (!libraryMap.has(library)) {
          libraryMap.set(library, new Set());
        }
        libraryMap.get(library)?.add(version);
      }

      return libraryMap;
    } catch (error) {
      throw new ConnectionError(
        "Failed to query library versions",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Stores documents with library and version metadata, generating embeddings
   * for vector similarity search
   */
  async addDocuments(
    library: string,
    version: string,
    documents: Document[],
  ): Promise<void> {
    try {
      // Generate embeddings in batch
      const texts = documents.map((doc) => {
        const header = `<title>${doc.metadata.title}</title>\n<url>${doc.metadata.url}</url>\n<path>${doc.metadata.path.join(" / ")}</path>\n`;
        return `${header}${doc.pageContent}`;
      });
      const embeddings = await this.embeddings.embedDocuments(texts);

      // Add documents using SQL function
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        // Convert embedding array to PostgreSQL vector format
        const vectorStr = `[${embeddings[i].join(",")}]`;
        const url = doc.metadata.url as string;
        if (!url || typeof url !== "string" || !url.trim()) {
          throw new StoreError("Document metadata must include a valid URL");
        }

        await this.pool.query("SELECT add_document($1, $2, $3, $4, $5, $6)", [
          library,
          version,
          url,
          doc.pageContent,
          doc.metadata,
          vectorStr,
        ]);
      }
    } catch (error) {
      throw new ConnectionError(
        "Failed to add documents to store",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Removes documents matching specified library and version
   */
  /**
   * Removes documents matching specified library and version
   * @returns Number of documents deleted
   */
  async deleteDocuments(library: string, version: string): Promise<number> {
    try {
      const result = await this.pool.query<{ delete_documents: number }>(
        "SELECT delete_documents($1, $2)",
        [library, version],
      );
      return result.rows[0].delete_documents;
    } catch (error) {
      throw new ConnectionError(
        "Failed to delete documents",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Retrieves a document by its ID.
   * @param id The ID of the document.
   * @returns The document, or null if not found.
   */
  async getById(id: string): Promise<Document | null> {
    try {
      const result = await this.pool.query("SELECT * FROM documents WHERE id = $1", [id]);
      if (result.rows.length === 0) {
        return null;
      }
      const row = result.rows[0];
      return {
        id: row.id,
        pageContent: row.content,
        metadata: row.metadata,
      };
    } catch (error) {
      throw new ConnectionError(
        `Failed to get document by ID ${id}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Finds documents matching a text query.
   * @param library The library name.
   * @param version The library version.
   * @param query The text query.
   * @param limit The maximum number of documents to return.
   * @returns An array of matching documents.
   */
  async findByContent(
    library: string,
    version: string,
    query: string,
    limit: number,
  ): Promise<Document[]> {
    try {
      // Generate query embedding for vector search.
      const embedding = await this.embeddings.embedQuery(query);
      const vectorStr = `[${embedding.join(",")}]`;
      const keywordWeight = 0.7;
      const embeddingWeight = 1 - keywordWeight;

      const result = await this.pool.query(
        `WITH 
-- Keyword search results with ranking
keyword_results AS (
  SELECT 
    id,
    ts_rank_cd(content_search, websearch_to_tsquery('english', $3)) AS keyword_score,
    ROW_NUMBER() OVER (
      ORDER BY ts_rank_cd(content_search, websearch_to_tsquery('english', $3)) DESC
    ) AS keyword_rank
  FROM documents
  WHERE library = $1 AND version = $2 AND content_search @@ websearch_to_tsquery('english', $3)
  LIMIT 50
),

-- Embedding search results with ranking
embedding_results AS (
  SELECT 
    id,
    1 - (embedding <=> $4::vector) AS embedding_score,
    ROW_NUMBER() OVER (
      ORDER BY 1 - (embedding <=> $4::vector) DESC
    ) AS embedding_rank
  FROM documents
  WHERE library = $1 AND version = $2
  LIMIT 50
),

-- Combine results using RRF formula
combined_results AS (
  SELECT 
    COALESCE(k.id, e.id) AS id,
    COALESCE(k.keyword_score, 0) AS keyword_score,
    COALESCE(e.embedding_score, 0) AS embedding_score,
    COALESCE(k.keyword_rank, 1000) AS keyword_rank,
    COALESCE(e.embedding_rank, 1000) AS embedding_rank,
    -- RRF formula: sum of 1/(rank + k) where k is a constant (commonly 60)
    -- With weighting factor for query type
    $6 * (1.0 / (COALESCE(k.keyword_rank, 1000) + 60)) +
    $7 * (1.0 / (COALESCE(e.embedding_rank, 1000) + 60)) AS rrf_score
  FROM keyword_results k
  FULL OUTER JOIN embedding_results e ON k.id = e.id
)

-- Get final ranked results
SELECT 
  d.*,
  cr.keyword_score,
  cr.embedding_score,
  cr.keyword_rank,
  cr.embedding_rank,
  cr.rrf_score
FROM combined_results cr
JOIN documents d ON cr.id = d.id
WHERE d.library = $1 AND d.version = $2
ORDER BY cr.rrf_score DESC
LIMIT $5`,
        [library, version, query, vectorStr, limit, keywordWeight, embeddingWeight],
      );

      return result.rows.map((row) => ({
        id: row.id,
        pageContent: row.content,
        metadata: {
          ...row.metadata,
          score: row.rrf_score,
        },
      }));
    } catch (error) {
      throw new ConnectionError(
        `Failed to find documents by content with query "${query}"`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Finds child chunks of a given document.
   *
   * Retrieves documents that are direct children of the input document in the content
   * hierarchy. A document is considered a child if it:
   * 1. Contains the parent's complete path (using @> operator)
   * 2. Has exactly one more path segment than the parent
   *
   * Results are ordered by their position in the document using the sort_order column.
   *
   * @param library The library name
   * @param version The library version
   * @param id The ID of the parent document
   * @param limit The maximum number of child chunks to return
   * @returns An array of child chunks in document order
   */
  async findChildChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<Document[]> {
    try {
      const result = await this.pool.query(
        `WITH parent_doc AS (
          SELECT 
            url, 
            metadata->'path' as path,
            jsonb_array_length(metadata->'path') as path_length
          FROM documents
          WHERE id = $3
        )
        SELECT d.* FROM documents d, parent_doc p
        WHERE d.library = $1 AND d.version = $2
        AND d.url = p.url
        AND d.metadata->'path' @> p.path  -- Child path contains parent path
        AND jsonb_array_length(d.metadata->'path') = p.path_length + 1  -- Exactly one level deeper
        ORDER BY d.sort_order, d.id  -- Use sort_order column directly
        LIMIT $4`,
        [library, version, id, limit],
      );

      return result.rows.map((row) => ({
        id: row.id,
        pageContent: row.content,
        metadata: row.metadata,
      }));
    } catch (error) {
      throw new ConnectionError(
        `Failed to find child chunks for ID ${id}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Finds preceding sibling chunks of a given document.
   *
   * Retrieves documents that have exactly the same path as the input document but come
   * before it based on sort order. These are true siblings at the same hierarchy level
   * and section.
   * @param library  The library name
   * @param version  The library version
   * @param id       The ID of the reference document
   * @param limit    The maximum number of preceding sibling chunks to return
   * @returns        An array of preceding sibling chunks, ordered from most recent to oldest
   */
  async findPrecedingSiblingChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<Document[]> {
    try {
      const result = await this.pool.query(
        `WITH ref_doc AS (
          SELECT url, metadata->'path' as path, sort_order 
          FROM documents 
          WHERE id = $3
        )
        SELECT d.* FROM documents d, ref_doc r
        WHERE d.library = $1 AND d.version = $2
        AND d.url = r.url
        AND d.metadata->'path' = r.path  -- Exact path match
        AND d.sort_order < r.sort_order
        ORDER BY d.sort_order DESC  -- Reverse order to get immediate predecessors
        LIMIT $4`,
        [library, version, id, limit],
      );

      return result.rows.reverse().map((row) => ({
        id: row.id,
        pageContent: row.content,
        metadata: row.metadata,
      }));
    } catch (error) {
      throw new ConnectionError(
        `Failed to find preceding sibling chunks for ID ${id}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Finds subsequent sibling chunks of a given document.
   *
   * Retrieves documents that have exactly the same path as the input document but come
   * after it based on sort order. These are true siblings at the same hierarchy level
   * and section.
   * @param library  The library name
   * @param version  The library version
   * @param id       The ID of the reference document
   * @param limit    The maximum number of subsequent sibling chunks to return
   * @returns        An array of subsequent sibling chunks, ordered from earliest to latest
   */
  async findSubsequentSiblingChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<Document[]> {
    try {
      const result = await this.pool.query(
        `WITH ref_doc AS (
          SELECT url, metadata->'path' as path, sort_order 
          FROM documents 
          WHERE id = $3
        )
        SELECT d.* FROM documents d, ref_doc r
        WHERE d.library = $1 AND d.version = $2
        AND d.url = r.url
        AND d.metadata->'path' = r.path  -- Exact path match
        AND d.sort_order > r.sort_order
        ORDER BY d.sort_order  -- Forward order for subsequent siblings
        LIMIT $4`,
        [library, version, id, limit],
      );
      return result.rows.map((row) => ({
        id: row.id,
        pageContent: row.content,
        metadata: row.metadata,
      }));
    } catch (error) {
      throw new ConnectionError(
        `Failed to find subsequent sibling chunks for ID ${id}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Finds the parent chunk of a given document.
   *
   * Retrieves the document whose path is the immediate parent of the input document's path.
   * @param library  The library name.
   * @param version  The library version.
   * @param id       The ID of the child document.
   * @returns        The parent chunk, or null if not found.
   */
  async findParentChunk(
    library: string,
    version: string,
    id: string,
  ): Promise<Document | null> {
    try {
      const result = await this.pool.query(
        `WITH ref_doc AS (
          SELECT url, metadata->'path' as path FROM documents WHERE id = $3
        )
        SELECT d.* FROM documents d, ref_doc r
        WHERE d.library = $1 AND d.version = $2
        AND d.url = r.url
        AND d.metadata->'path' = (r.path::jsonb - (jsonb_array_length(r.path) - 1))`,
        [library, version, id],
      );
      if (result.rows.length === 0) {
        return null;
      }
      const row = result.rows[0];
      return {
        id: row.id,
        pageContent: row.content,
        metadata: row.metadata,
      };
    } catch (error) {
      throw new ConnectionError(
        `Failed to find parent chunk for ID ${id}`,
        error instanceof Error ? error : undefined,
      );
    }
  }
}
