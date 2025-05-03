import { type Mock, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { VECTOR_DIMENSION } from "./types";

// --- Mocking Setup ---

// Mock the embedding factory
vi.mock("./embeddings/EmbeddingFactory");

// Mock embedding functions
const mockEmbedQuery = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
const mockEmbedDocuments = vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]);

import { createEmbeddingModel } from "./embeddings/EmbeddingFactory";
(createEmbeddingModel as Mock).mockReturnValue({
  embedQuery: vi.fn(),
  embedDocuments: vi.fn(),
});

// Mock better-sqlite3
const mockStatementAll = vi.fn().mockReturnValue([]);
// Ensure the mock statement object covers methods used by *all* statements prepared in DocumentStore
const mockStatement = {
  all: mockStatementAll,
  run: vi.fn().mockReturnValue({ changes: 0, lastInsertRowid: 1 }), // Mock run for insert/delete
  get: vi.fn().mockReturnValue(undefined), // Mock get for getById/checkExists etc.
};
const mockPrepare = vi.fn().mockReturnValue(mockStatement);
const mockDb = {
  prepare: mockPrepare,
  exec: vi.fn(),
  transaction: vi.fn(
    (fn) =>
      (...args: unknown[]) =>
        fn(...args),
  ),
  close: vi.fn(),
};
vi.mock("better-sqlite3", () => ({
  default: vi.fn(() => mockDb), // Mock the default export (constructor)
}));

// Mock sqlite-vec
vi.mock("sqlite-vec", () => ({
  load: vi.fn(),
}));

// Mock the migration runner to prevent DB calls during init in tests
vi.mock("./applyMigrations", () => ({
  applyMigrations: vi.fn(), // Mock the exported function
}));

// --- Test Suite ---

// Import DocumentStore AFTER mocks are defined
import { DocumentStore } from "./DocumentStore";

describe("DocumentStore", () => {
  let documentStore: DocumentStore;

  beforeEach(async () => {
    vi.clearAllMocks(); // Clear call history etc.

    // Reset the mock factory implementation for this test run
    (createEmbeddingModel as ReturnType<typeof vi.fn>).mockReturnValue({
      embedQuery: mockEmbedQuery,
      embedDocuments: mockEmbedDocuments,
    });
    mockPrepare.mockReturnValue(mockStatement); // <-- Re-configure prepare mock return value

    // Reset embedQuery to handle initialization vector
    mockEmbedQuery.mockResolvedValue(new Array(VECTOR_DIMENSION).fill(0.1));

    // Now create the store and initialize.
    // initialize() will call 'new OpenAIEmbeddings()', which uses our fresh mock implementation.
    documentStore = new DocumentStore(":memory:");
    await documentStore.initialize();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("findChunksByIds", () => {
    const library = "test-lib";
    const version = "1.0.0";

    it("should fetch and return documents for given IDs, sorted by sort_order", async () => {
      const ids = ["id1", "id2", "id3"];
      const mockRows = [
        {
          id: "id2",
          library,
          version,
          url: "url2",
          content: "content2",
          metadata: JSON.stringify({ url: "url2", score: 0.5 }),
          embedding: null,
          sort_order: 1,
          score: 0.5,
        },
        {
          id: "id1",
          library,
          version,
          url: "url1",
          content: "content1",
          metadata: JSON.stringify({ url: "url1", score: 0.9 }),
          embedding: null,
          sort_order: 0,
          score: 0.9,
        },
        {
          id: "id3",
          library,
          version,
          url: "url3",
          content: "content3",
          metadata: JSON.stringify({ url: "url3", score: 0.7 }),
          embedding: null,
          sort_order: 2,
          score: 0.7,
        },
      ];
      // Should be returned sorted by sort_order: id1, id2, id3
      mockStatementAll.mockReturnValueOnce([mockRows[1], mockRows[0], mockRows[2]]);
      const result = await documentStore.findChunksByIds(library, version, ids);
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("id IN"));
      expect(mockStatementAll).toHaveBeenCalledWith(
        library.toLowerCase(),
        version.toLowerCase(),
        ...ids,
      );
      expect(result.length).toBe(3);
      expect(result[0].id).toBe("id1");
      expect(result[1].id).toBe("id2");
      expect(result[2].id).toBe("id3");
      expect(result[0].pageContent).toBe("content1");
      expect(result[1].pageContent).toBe("content2");
      expect(result[2].pageContent).toBe("content3");
    });

    it("should return an empty array if no IDs are provided", async () => {
      const prepareCallsBefore = mockPrepare.mock.calls.length;
      const allCallsBefore = mockStatementAll.mock.calls.length;
      const result = await documentStore.findChunksByIds(library, version, []);
      expect(result).toEqual([]);
      expect(mockPrepare.mock.calls.length).toBe(prepareCallsBefore);
      expect(mockStatementAll.mock.calls.length).toBe(allCallsBefore);
    });

    it("should return an empty array if no documents are found", async () => {
      mockStatementAll.mockReturnValueOnce([]);
      const result = await documentStore.findChunksByIds(library, version, ["idX"]);
      expect(result).toEqual([]);
      expect(mockPrepare).toHaveBeenCalled();
      expect(mockStatementAll).toHaveBeenCalled();
    });
  });

  describe("findByContent", () => {
    const library = "test-lib";
    const version = "1.0.0";
    const limit = 10;

    it("should call embedQuery and prepare/all with escaped FTS query for double quotes", async () => {
      const query = 'find "quotes"';
      const expectedFtsQuery = '"find ""quotes"""'; // Escaped and wrapped

      await documentStore.findByContent(library, version, query, limit);

      // 1. Check if embedQuery was called with correct args
      // Note: embedQuery is called twice - once during init and once for search
      const embedCalls = mockEmbedQuery.mock.calls;
      expect(embedCalls[embedCalls.length - 1][0]).toBe(query); // Last call should be our search

      // 2. Check if db.prepare was called correctly during findByContent
      // It's called multiple times during initialize, so check the specific call
      const prepareCall = mockPrepare.mock.calls.find((call) =>
        call[0].includes("WITH vec_scores AS"),
      );
      expect(prepareCall).toBeDefined();

      // 3. Check the arguments passed to the statement's 'all' method
      expect(mockStatementAll).toHaveBeenCalledTimes(1); // Only the findByContent call should use 'all'
      const lastCallArgs = mockStatementAll.mock.lastCall;
      expect(lastCallArgs).toEqual([
        library.toLowerCase(),
        version.toLowerCase(),
        expect.any(String), // Embedding JSON
        limit,
        library.toLowerCase(),
        version.toLowerCase(),
        expectedFtsQuery, // Check the escaped query string
        limit,
      ]);
    });

    it("should correctly escape FTS operators", async () => {
      const query = "search AND this OR that";
      const expectedFtsQuery = '"search AND this OR that"';
      await documentStore.findByContent(library, version, query, limit);
      expect(mockStatementAll).toHaveBeenCalledTimes(1);
      const lastCallArgs = mockStatementAll.mock.lastCall;
      expect(lastCallArgs?.[6]).toBe(expectedFtsQuery); // Check only the FTS query argument
    });

    it("should correctly escape parentheses", async () => {
      const query = "function(arg)";
      const expectedFtsQuery = '"function(arg)"';
      await documentStore.findByContent(library, version, query, limit);
      expect(mockStatementAll).toHaveBeenCalledTimes(1);
      const lastCallArgs = mockStatementAll.mock.lastCall;
      expect(lastCallArgs?.[6]).toBe(expectedFtsQuery);
    });

    it("should correctly escape asterisks", async () => {
      const query = "wildcard*";
      const expectedFtsQuery = '"wildcard*"';
      await documentStore.findByContent(library, version, query, limit);
      expect(mockStatementAll).toHaveBeenCalledTimes(1);
      const lastCallArgs = mockStatementAll.mock.lastCall;
      expect(lastCallArgs?.[6]).toBe(expectedFtsQuery);
    });

    it("should correctly escape already quoted strings", async () => {
      const query = '"already quoted"';
      const expectedFtsQuery = '"""already quoted"""';
      await documentStore.findByContent(library, version, query, limit);
      expect(mockStatementAll).toHaveBeenCalledTimes(1);
      const lastCallArgs = mockStatementAll.mock.lastCall;
      expect(lastCallArgs?.[6]).toBe(expectedFtsQuery);
    });

    it("should correctly handle empty string", async () => {
      const query = "";
      const expectedFtsQuery = '""';
      await documentStore.findByContent(library, version, query, limit);
      expect(mockStatementAll).toHaveBeenCalledTimes(1);
      const lastCallArgs = mockStatementAll.mock.lastCall;
      expect(lastCallArgs?.[6]).toBe(expectedFtsQuery);
    });
  });

  describe("Embedding Model Dimensions", () => {
    it("should accept a model that produces ${VECTOR_DIMENSION}-dimensional vectors", async () => {
      // Mock a ${VECTOR_DIMENSION}-dimensional vector
      mockEmbedQuery.mockResolvedValueOnce(new Array(VECTOR_DIMENSION).fill(0.1));
      documentStore = new DocumentStore(":memory:");
      await expect(documentStore.initialize()).resolves.not.toThrow();
    });

    it("should accept and pad vectors from models with smaller dimensions", async () => {
      // Mock 768-dimensional vectors
      mockEmbedQuery.mockResolvedValueOnce(new Array(768).fill(0.1));
      mockEmbedDocuments.mockResolvedValueOnce([new Array(768).fill(0.1)]);

      documentStore = new DocumentStore(":memory:");
      await documentStore.initialize();

      // Should pad to ${VECTOR_DIMENSION} when inserting
      const doc = {
        pageContent: "test content",
        metadata: { title: "test", url: "http://test.com", path: ["test"] },
      };

      // This should succeed (vectors are padded internally)
      await expect(
        documentStore.addDocuments("test-lib", "1.0.0", [doc]),
      ).resolves.not.toThrow();
    });

    it("should reject models that produce vectors larger than ${VECTOR_DIMENSION} dimensions", async () => {
      // Mock a 3072-dimensional vector (like text-embedding-3-large)
      mockEmbedQuery.mockResolvedValueOnce(new Array(3072).fill(0.1));
      documentStore = new DocumentStore(":memory:");
      await expect(documentStore.initialize()).rejects.toThrow(
        new RegExp(`exceeds.*${VECTOR_DIMENSION}`),
      );
    });

    it("should pad both document and query vectors consistently", async () => {
      // Mock 768-dimensional vectors for both init and subsequent operations
      const smallVector = new Array(768).fill(0.1);
      mockEmbedQuery
        .mockResolvedValueOnce(smallVector) // for initialization
        .mockResolvedValueOnce(smallVector); // for search query
      mockEmbedDocuments.mockResolvedValueOnce([smallVector]); // for document embeddings

      documentStore = new DocumentStore(":memory:");
      await documentStore.initialize();

      const doc = {
        pageContent: "test content",
        metadata: { title: "test", url: "http://test.com", path: ["test"] },
      };

      // Add a document (this pads the document vector)
      await documentStore.addDocuments("test-lib", "1.0.0", [doc]);

      // Search should work (query vector gets padded too)
      await expect(
        documentStore.findByContent("test-lib", "1.0.0", "test query", 5),
      ).resolves.not.toThrow();

      // Verify both vectors were padded (via the JSON stringification)
      const insertCall = mockStatement.run.mock.calls.find(
        (call) => call[0]?.toString().startsWith("1"), // Looking for rowid=1
      );
      const searchCall = mockStatementAll.mock.lastCall;

      // Both vectors should be stringified arrays of length ${VECTOR_DIMENSION}
      const insertVector = JSON.parse(insertCall?.[3] || "[]");
      const searchVector = JSON.parse(searchCall?.[2] || "[]");
      expect(insertVector.length).toBe(VECTOR_DIMENSION);
      expect(searchVector.length).toBe(VECTOR_DIMENSION);
    });
  });

  describe("queryLibraryVersions", () => {
    it("should return a map of libraries to their detailed versions", async () => {
      const mockData = [
        {
          library: "react",
          version: "18.2.0",
          documentCount: 150,
          uniqueUrlCount: 50,
          indexedAt: "2024-01-10T10:00:00.000Z",
        },
        {
          library: "react",
          version: "17.0.1",
          documentCount: 120,
          uniqueUrlCount: 45,
          indexedAt: "2023-05-15T12:30:00.000Z",
        },
        {
          library: "vue",
          version: "3.3.0",
          documentCount: 200,
          uniqueUrlCount: 70,
          indexedAt: "2024-02-20T08:00:00.000Z",
        },
        {
          library: "react",
          version: "", // Internal empty version, should be filtered out
          documentCount: 5,
          uniqueUrlCount: 1,
          indexedAt: "2023-01-01T00:00:00.000Z",
        },
        {
          library: "old-lib",
          version: "1.0.0",
          documentCount: 10,
          uniqueUrlCount: 5,
          indexedAt: null, // Test null indexedAt
        },
        {
          library: "unversioned-only", // Test lib with only unversioned
          version: "",
          documentCount: 1,
          uniqueUrlCount: 1,
          indexedAt: "2024-04-01T00:00:00.000Z",
        },
        {
          library: "mixed-versions", // Test lib with semver and unversioned
          version: "1.0.0",
          documentCount: 5,
          uniqueUrlCount: 2,
          indexedAt: "2024-04-02T00:00:00.000Z",
        },
        {
          library: "mixed-versions", // Test lib with semver and unversioned
          version: "",
          documentCount: 2,
          uniqueUrlCount: 1,
          indexedAt: "2024-04-03T00:00:00.000Z",
        },
      ];
      mockStatementAll.mockReturnValue(mockData); // Configure mock return for this test

      const result = await documentStore.queryLibraryVersions();

      // Check the prepared statement was called
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("GROUP BY library, version"),
      );
      expect(mockStatementAll).toHaveBeenCalledTimes(1);

      // Check the structure and content
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(5); // react, vue, old-lib, unversioned-only, mixed-versions

      // Check React versions (should include "" sorted first)
      const reactVersions = result.get("react");
      expect(reactVersions).toBeDefined();
      expect(reactVersions?.length).toBe(3); // Expect 3 versions now
      expect(reactVersions?.[0]).toEqual({
        // Unversioned first
        version: "",
        documentCount: 5,
        uniqueUrlCount: 1,
        indexedAt: new Date("2023-01-01T00:00:00.000Z").toISOString(),
      });
      expect(reactVersions?.[1]).toEqual({
        // Then 17.0.1
        version: "17.0.1",
        documentCount: 120,
        uniqueUrlCount: 45,
        indexedAt: new Date("2023-05-15T12:30:00.000Z").toISOString(),
      });
      expect(reactVersions?.[2]).toEqual({
        // Then 18.2.0
        version: "18.2.0",
        documentCount: 150,
        uniqueUrlCount: 50,
        indexedAt: new Date("2024-01-10T10:00:00.000Z").toISOString(),
      });

      // Check Vue version
      const vueVersions = result.get("vue");
      expect(vueVersions).toBeDefined();
      expect(vueVersions?.length).toBe(1);
      expect(vueVersions?.[0]).toEqual({
        version: "3.3.0",
        documentCount: 200,
        uniqueUrlCount: 70,
        indexedAt: new Date("2024-02-20T08:00:00.000Z").toISOString(),
      });

      // Check Old Lib version (with null indexedAt)
      const oldLibVersions = result.get("old-lib");
      expect(oldLibVersions).toBeDefined();
      expect(oldLibVersions?.length).toBe(1);
      expect(oldLibVersions?.[0]).toEqual({
        version: "1.0.0",
        documentCount: 10,
        uniqueUrlCount: 5,
        indexedAt: null,
      });

      // Check Unversioned Only lib
      const unversionedOnly = result.get("unversioned-only");
      expect(unversionedOnly).toBeDefined();
      expect(unversionedOnly?.length).toBe(1);
      expect(unversionedOnly?.[0]).toEqual({
        version: "", // Expect empty string version
        documentCount: 1,
        uniqueUrlCount: 1,
        indexedAt: new Date("2024-04-01T00:00:00.000Z").toISOString(),
      });

      // Check Mixed Versions lib (should include "" and be sorted)
      const mixedVersions = result.get("mixed-versions");
      expect(mixedVersions).toBeDefined();
      expect(mixedVersions?.length).toBe(2);
      // Empty string version should come first due to semver compare treating it lowest
      expect(mixedVersions?.[0]).toEqual({
        version: "",
        documentCount: 2,
        uniqueUrlCount: 1,
        indexedAt: new Date("2024-04-03T00:00:00.000Z").toISOString(),
      });
      expect(mixedVersions?.[1]).toEqual({
        version: "1.0.0",
        documentCount: 5,
        uniqueUrlCount: 2,
        indexedAt: new Date("2024-04-02T00:00:00.000Z").toISOString(),
      });
    });

    it("should return an empty map if no libraries are found", async () => {
      mockStatementAll.mockReturnValue([]); // No data
      const result = await documentStore.queryLibraryVersions();
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });
});
