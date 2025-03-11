import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"; // Import afterEach
import { Document } from "@langchain/core/documents";
import type { VersionInfo } from "../types"; // Import VersionInfo

// Define the type for memory vectors to match the implementation
type MemoryVector = {
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
};

// Mock modules before importing anything that might use them
vi.mock("langchain/vectorstores/memory", () => {
  return {
    MemoryVectorStore: class MockMemoryVectorStore {
      memoryVectors: MemoryVector[] = [];
      async addDocuments(docs: Document[]) {
        this.memoryVectors.push(
          ...docs.map((doc) => ({
            content: doc.pageContent,
            embedding: [],
            metadata: doc.metadata,
          }))
        );
      }
      asRetriever() {
        return {
          invoke: async () => [
            {
              pageContent: "Test document content about testing",
              metadata: {
                url: "http://example.com",
                title: "Test Doc",
                library: "test-lib",
                version: "1.0.0",
              },
            },
          ],
        };
      }
    },
  };
});

vi.mock("@langchain/community/retrievers/bm25", () => {
  return {
    BM25Retriever: {
      fromDocuments: () => ({
        invoke: async () => [
          {
            pageContent: "Test document content about testing",
            metadata: {
              url: "http://example.com",
              title: "Test Doc",
              library: "test-lib",
              version: "1.0.0",
              bm25Score: 0.8,
            },
          },
        ],
      }),
    },
  };
});

vi.mock("@langchain/openai", () => {
  return {
    OpenAIEmbeddings: class MockOpenAIEmbeddings {
      async embedDocuments() {
        return [];
      }
      async embedQuery() {
        return [];
      }
    },
  };
});

// Now we can safely import the module that uses these dependencies
import { VectorStoreManager } from "./VectorStoreManager.js";

const testDir = path.join(os.tmpdir(), "test-docs-mcp");

describe("VectorStoreManager", () => {
  let store: VectorStoreManager;

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    store = new VectorStoreManager(testDir);
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore mocks after each test
  });

  it("should create a store", async () => {
    const library = "test-lib";
    const version = "1.0.0";

    const vectorStore = await store.createStore(library, version);
    expect(vectorStore).toBeDefined();
    expect(vectorStore.memoryVectors).toEqual([]);

    const storePath = path.join(testDir, library, version, "store.json");
    expect(fsSync.existsSync(storePath)).toBe(true);
  });

  it("should load a non-existent store", async () => {
    const library = "test-lib";
    const version = "1.0.0";

    const vectorStore = await store.loadStore(library, version);
    expect(vectorStore).toBeNull();
  });

  it("should create, add document, and load store", async () => {
    const library = "test-lib";
    const version = "1.0.0";
    const document = new Document({
      pageContent: "Test document content",
      metadata: {
        url: "http://example.com",
        title: "Test Doc",
        library,
        version,
      },
    });

    // Create store and add document
    const createdStore = await store.createStore(library, version);
    await store.addDocument(createdStore, document);

    // Load the store back
    const loadedStore = await store.loadStore(library, version);
    expect(loadedStore).not.toBeNull();
    if (loadedStore) {
      expect(loadedStore.memoryVectors[0].content).toBe(
        "Test document content"
      );
    }
  });

  it("should search store for documents", async () => {
    const library = "test-lib";
    const version = "1.0.0";
    const document = new Document({
      pageContent: "Test document content about testing",
      metadata: {
        url: "http://example.com",
        title: "Test Doc",
        library,
        version,
      },
    });

    const vectorStore = await store.createStore(library, version);
    await store.addDocument(vectorStore, document);
    const results = await store.searchStore(vectorStore, "testing");
    expect(results).toEqual([
      {
        content: "Test document content about testing",
        score: 0.8,
        metadata: {
          url: "http://example.com",
          title: "Test Doc",
          library: "test-lib",
          version: "1.0.0",
        },
      },
    ]);
  });

  it("should remove all documents from store", async () => {
    const library = "test-lib";
    const version = "1.0.0";
    const document = new Document({
      pageContent: "Test document content",
      metadata: {
        url: "http://example.com",
        title: "Test Doc",
        library,
        version,
      },
    });

    // Create store and add document
    const vectorStore = await store.createStore(library, version);
    await store.addDocument(vectorStore, document);
    expect(vectorStore.memoryVectors.length).toBeGreaterThan(0);

    // Remove all documents
    await store.removeAllDocuments(vectorStore);
    expect(vectorStore.memoryVectors.length).toBe(0);

    // Load store and verify it's empty
    const loadedStore = await store.loadStore(library, version);
    expect(loadedStore?.memoryVectors.length).toBe(0);
  });

  describe("listVersions", () => {
    it("should return an empty array if the library directory does not exist", async () => {
      const versions = await store.listVersions("nonexistent-lib");
      expect(versions).toEqual([]);
    });

    it("should return an empty array if there are no valid versions", async () => {
      const library = "empty-lib";
      await fs.mkdir(path.join(testDir, library), { recursive: true });
      const versions = await store.listVersions(library);
      expect(versions).toEqual([]);
    });

    it("should return an array of VersionInfo objects, correctly indicating indexed status", async () => {
      const library = "test-lib";
      const versionDirs = ["1.0.0", "1.1.0", "1.2.0", "invalid-version"];
      const expectedVersions: VersionInfo[] = [
        { version: "1.0.0", indexed: true },
        { version: "1.1.0", indexed: false },
        { version: "1.2.0", indexed: true },
      ];

      // Create directories and store.json files
      for (const v of versionDirs) {
        await fs.mkdir(path.join(testDir, library, v), { recursive: true });
      }
      await fs.writeFile(
        path.join(testDir, library, "1.0.0", "store.json"),
        "{}"
      );
      await fs.writeFile(
        path.join(testDir, library, "1.2.0", "store.json"),
        "{}"
      );

      const versions = await store.listVersions(library);
      expect(versions).toEqual(expectedVersions);
    });
  });

  it("should handle removing documents from empty store", async () => {
    const library = "test-lib";
    const version = "1.0.0";
    const vectorStore = await store.createStore(library, version);

    // Removing from empty store should be no-op
    await expect(store.removeAllDocuments(vectorStore)).resolves.not.toThrow();
  });

  it("should delete store", async () => {
    const library = "test-lib";
    const version = "1.0.0";

    // Create store
    await store.createStore(library, version);
    const storePath = path.join(testDir, library, version, "store.json");
    expect(fsSync.existsSync(storePath)).toBe(true);

    // Delete store
    await store.deleteStore(library, version);
    expect(fsSync.existsSync(storePath)).toBe(false);
  });

  it("should not throw when deleting non-existent store", async () => {
    const library = "test-lib";
    const version = "1.0.0";

    // Delete non-existent store
    await expect(store.deleteStore(library, version)).resolves.not.toThrow();
  });

  describe("findBestVersion", () => {
    it("should find the best version using listVersions", async () => {
      const library = "test-lib";
      const mockVersions: VersionInfo[] = [
        { version: "1.0.0", indexed: true },
        { version: "1.1.0", indexed: true },
        { version: "2.0.0", indexed: true },
      ];
      vi.spyOn(store, "listVersions").mockResolvedValue(mockVersions);

      const bestVersion = await store.findBestVersion(library, "1.5.0");
      expect(bestVersion).toBe("1.1.0");
      expect(store.listVersions).toHaveBeenCalledWith(library);
    });

    it("should fall back to lower version if requested version is higher", async () => {
      const library = "test-lib";
      const mockVersions: VersionInfo[] = [
        { version: "1.0.0", indexed: true },
        { version: "1.1.0", indexed: true },
        { version: "1.1.1", indexed: true },
      ];
      vi.spyOn(store, "listVersions").mockResolvedValue(mockVersions);

      expect(await store.findBestVersion(library, "1.5.0")).toBe("1.1.1");
      expect(await store.findBestVersion(library, "2.0.0")).toBe("1.1.1");
      expect(store.listVersions).toHaveBeenCalledWith(library);
    });

    it("should handle partial version numbers with and without x", async () => {
      const library = "test-lib";
      const mockVersions: VersionInfo[] = [
        { version: "1.0.0", indexed: true },
        { version: "1.1.0", indexed: true },
        { version: "1.1.1", indexed: true },
        { version: "2.0.0", indexed: true },
        { version: "2.1.0", indexed: true },
      ];
      vi.spyOn(store, "listVersions").mockResolvedValue(mockVersions);

      expect(await store.findBestVersion(library, "1.0.0")).toBe("1.0.0"); // Exact
      expect(await store.findBestVersion(library, "1.0.x")).toBe("1.0.0"); // x-range
      expect(await store.findBestVersion(library, "1.1.x")).toBe("1.1.1"); // x-range
      expect(await store.findBestVersion(library, "1.x")).toBe("1.1.1"); // x-range
      expect(await store.findBestVersion(library, "1.x.x")).toBe("1.1.1"); // x-range
      expect(await store.findBestVersion(library, "1.1")).toBe("1.1.1"); // Partial
      expect(await store.findBestVersion(library, "2")).toBe("2.1.0"); // Partial
      expect(await store.findBestVersion(library, "3.0.0")).toBe("2.1.0"); // Fallback
      expect(store.listVersions).toHaveBeenCalledWith(library);
    });

    it("should handle invalid version strings", async () => {
      const library = "test-lib";
      const mockVersions: VersionInfo[] = [
        { version: "1.0.0", indexed: true },
        { version: "1.1.0", indexed: true },
      ];
      vi.spyOn(store, "listVersions").mockResolvedValue(mockVersions);

      expect(await store.findBestVersion(library, "invalid")).toBeNull();
      expect(await store.findBestVersion(library, "1.x.2")).toBeNull();
      expect(await store.findBestVersion(library, "1.2.3-alpha")).toBeNull();
      expect(store.listVersions).toHaveBeenCalledWith(library);
    });
  });

  describe("listLibraries", () => {
    it("should list libraries and their versions, using listVersions", async () => {
      const lib1Versions: VersionInfo[] = [
        { version: "1.0.0", indexed: true },
        { version: "1.1.0", indexed: false },
      ];
      const lib2Versions: VersionInfo[] = [{ version: "2.0.0", indexed: true }];

      // Mock listVersions for each library
      vi.spyOn(store, "listVersions").mockImplementation(
        async (library: string) => {
          if (library === "lib1") {
            return lib1Versions;
          }
          if (library === "lib2") {
            return lib2Versions;
          }
          return [];
        }
      );

      // Create library directories
      await fs.mkdir(path.join(testDir, "lib1"), { recursive: true });
      await fs.mkdir(path.join(testDir, "lib2"), { recursive: true });

      const expected = [
        { library: "lib1", versions: lib1Versions },
        { library: "lib2", versions: lib2Versions },
      ];
      const result = await store.listLibraries();

      // Compare result and expected, ignoring order
      expect(result).toEqual(expect.arrayContaining(expected));
      expect(expected).toEqual(expect.arrayContaining(result));
    });

    it("should return an empty array if there are no libraries", async () => {
      // Mock listVersions (shouldn't be called)
      vi.spyOn(store, "listVersions").mockResolvedValue([]);

      const result = await store.listLibraries();
      expect(result).toEqual([]);
      expect(store.listVersions).not.toHaveBeenCalled();
    });
  });
});
