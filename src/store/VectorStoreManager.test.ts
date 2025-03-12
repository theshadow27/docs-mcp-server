import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Document } from "@langchain/core/documents";
import type { VersionInfo } from "../types";
import { VectorStoreManager } from "./VectorStoreManager";
import { DocumentStore } from "./DocumentStore";

// Mock document store
let mockDocuments: Document[] = [];
const mockStore = {
  initialize: vi.fn(),
  shutdown: vi.fn(),
  queryUniqueVersions: vi.fn(),
  checkDocumentExists: vi.fn(),
  queryLibraryVersions: vi.fn(),
  addDocuments: vi.fn(),
  deleteDocuments: vi.fn(),
  search: vi.fn(),
};

vi.mock("./DocumentStore", () => ({
  DocumentStore: vi.fn().mockImplementation(() => mockStore),
}));

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

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("VectorStoreManager", () => {
  let storeManager: VectorStoreManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocuments = [];
    process.env.POSTGRES_CONNECTION =
      "postgres://user:pass@localhost:5432/testdb";
    storeManager = new VectorStoreManager();
  });

  afterEach(async () => {
    await storeManager.shutdown();
  });

  it("should initialize correctly", async () => {
    await storeManager.initialize();
    expect(mockStore.initialize).toHaveBeenCalled();
  });

  it("should handle empty store existence check", async () => {
    mockStore.checkDocumentExists.mockResolvedValue(false);
    const exists = await storeManager.exists("test-lib", "1.0.0");
    expect(exists).toBe(false);
  });

  it("should add and search documents", async () => {
    const library = "test-lib";
    const version = "1.0.0";
    const document = new Document({
      pageContent: "Test document content about testing",
      metadata: {
        url: "http://example.com",
        title: "Test Doc",
      },
    });

    mockStore.search.mockResolvedValue([
      {
        pageContent: "Test document content about testing",
        metadata: {
          url: "http://example.com",
          title: "Test Doc",
          library,
          version,
        },
      },
    ]);

    await storeManager.addDocument(library, version, document);

    const results = await storeManager.searchStore(library, version, "testing");
    expect(mockStore.addDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ pageContent: document.pageContent }),
      ]),
      { library, version }
    );
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

  it("should remove all documents for a specific library and version", async () => {
    const library = "test-lib";
    const version = "1.0.0";

    await storeManager.removeAllDocuments(library, version);
    expect(mockStore.deleteDocuments).toHaveBeenCalledWith({
      library,
      version,
    });
  });

  describe("listVersions", () => {
    it("should return an empty array if the library has no documents", async () => {
      mockStore.queryUniqueVersions.mockResolvedValue([]);
      const versions = await storeManager.listVersions("nonexistent-lib");
      expect(versions).toEqual([]);
    });

    it("should return an array of indexed versions", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue([
        "1.0.0",
        "1.1.0",
        "1.2.0",
      ]);

      const versions = await storeManager.listVersions(library);
      expect(versions).toEqual([
        { version: "1.0.0", indexed: true },
        { version: "1.1.0", indexed: true },
        { version: "1.2.0", indexed: true },
      ]);
      expect(mockStore.queryUniqueVersions).toHaveBeenCalledWith(library);
    });
  });

  describe("findBestVersion", () => {
    it("should find the best version using listVersions", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue([
        "1.0.0",
        "1.1.0",
        "2.0.0",
      ]);

      const bestVersion = await storeManager.findBestVersion(library, "1.5.0");
      expect(bestVersion).toBe("1.1.0");
      expect(mockStore.queryUniqueVersions).toHaveBeenCalledWith(library);
    });

    it("should fall back to lower version if requested version is higher", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue([
        "1.0.0",
        "1.1.0",
        "1.1.1",
      ]);

      expect(await storeManager.findBestVersion(library, "1.5.0")).toBe(
        "1.1.1"
      );
      expect(await storeManager.findBestVersion(library, "2.0.0")).toBe(
        "1.1.1"
      );
      expect(mockStore.queryUniqueVersions).toHaveBeenCalledWith(library);
    });

    it("should handle invalid version strings", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue(["1.0.0", "1.1.0"]);

      expect(await storeManager.findBestVersion(library, "invalid")).toBeNull();
      expect(await storeManager.findBestVersion(library, "1.x.2")).toBeNull();
      expect(
        await storeManager.findBestVersion(library, "1.2.3-alpha")
      ).toBeNull();
      expect(mockStore.queryUniqueVersions).toHaveBeenCalledWith(library);
    });
  });

  describe("listLibraries", () => {
    it("should list libraries and their versions", async () => {
      const mockLibraryMap = new Map([
        ["lib1", new Set(["1.0.0", "1.1.0"])],
        ["lib2", new Set(["2.0.0"])],
      ]);
      mockStore.queryLibraryVersions.mockResolvedValue(mockLibraryMap);

      const result = await storeManager.listLibraries();
      expect(result).toEqual([
        {
          library: "lib1",
          versions: [
            { version: "1.0.0", indexed: true },
            { version: "1.1.0", indexed: true },
          ],
        },
        {
          library: "lib2",
          versions: [{ version: "2.0.0", indexed: true }],
        },
      ]);
    });

    it("should return an empty array if there are no libraries", async () => {
      mockStore.queryLibraryVersions.mockResolvedValue(new Map());
      const result = await storeManager.listLibraries();
      expect(result).toEqual([]);
    });
  });
});
