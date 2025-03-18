import { Document } from "@langchain/core/documents";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VersionNotFoundError } from "../tools/errors";
import { VectorStoreService } from "./VectorStoreService";
import { StoreError } from "./errors";

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

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("VectorStoreService", () => {
  let storeService: VectorStoreService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocuments = [];
    process.env.POSTGRES_CONNECTION =
      "postgres://user:pass@localhost:5432/testdb";
    storeService = new VectorStoreService();
  });

  afterEach(async () => {
    await storeService.shutdown();
  });

  it("should initialize correctly", async () => {
    await storeService.initialize();
    expect(mockStore.initialize).toHaveBeenCalled();
  });

  it("should handle empty store existence check", async () => {
    mockStore.checkDocumentExists.mockImplementation((lib, ver) =>
      Promise.resolve(false)
    );
    const exists = await storeService.exists("test-lib", "1.0.0");
    expect(exists).toBe(false);
  });

  describe("document processing", () => {
    it("should add and search documents with basic metadata", async () => {
      const library = "test-lib";
      const version = "1.0.0";
      const validDocument = new Document({
        pageContent: "Test document content about testing",
        metadata: {
          url: "http://example.com",
          title: "Test Doc",
        },
      });

      const documentNoUrl = new Document({
        pageContent: "Test document without URL",
        metadata: {
          title: "Test Doc",
        },
      });

      // Should fail when URL is missing
      await expect(
        storeService.addDocument(library, version, documentNoUrl)
      ).rejects.toThrow(StoreError);

      await expect(
        storeService.addDocument(library, version, documentNoUrl)
      ).rejects.toHaveProperty(
        "message",
        "Document metadata must include a valid URL"
      );

      // Should succeed with valid URL
      mockStore.search.mockResolvedValue([
        {
          pageContent: "Test document content about testing",
          metadata: {
            url: "http://example.com",
            title: "Test Doc",
            library,
            version,
            score: 0.8,
          },
        },
      ]);

      await storeService.addDocument(library, version, validDocument);

      const results = await storeService.searchStore(
        library,
        version,
        "testing"
      );
      expect(mockStore.addDocuments).toHaveBeenCalledWith(
        library,
        version,
        expect.arrayContaining([
          expect.objectContaining({ pageContent: validDocument.pageContent }),
        ])
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

    it("should preserve semantic metadata when processing markdown documents", async () => {
      const library = "test-lib";
      const version = "1.0.0";
      const document = new Document({
        pageContent:
          "# Chapter 1\nTest content\n## Section 1.1\nMore testing content",
        metadata: {
          url: "http://example.com/docs",
          title: "Root Doc",
        },
      });

      // Mock the search result to match what would actually be stored after processing
      mockStore.search.mockResolvedValue([
        {
          pageContent: "More testing content",
          metadata: {
            url: "http://example.com/docs",
            title: "Root Doc", // Should match the original document metadata
            library,
            version,
            level: 2,
            path: ["Chapter 1", "Section 1.1"],
            score: 0.8,
          },
        },
      ]);

      await storeService.addDocument(library, version, document);

      // Verify the documents were stored with semantic metadata
      expect(mockStore.addDocuments).toHaveBeenCalledWith(
        library,
        version,
        expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              level: 2,
              path: expect.arrayContaining(["Chapter 1", "Section 1.1"]),
            }),
          }),
        ])
      );

      // Verify search results preserve metadata
      const results = await storeService.searchStore(
        library,
        version,
        "testing"
      );
      expect(results[0].metadata).toEqual({
        url: "http://example.com/docs",
        title: "Root Doc",
        library: "test-lib",
        version: "1.0.0",
        level: 2,
        path: ["Chapter 1", "Section 1.1"],
      });
    });
  });

  it("should remove all documents for a specific library and version", async () => {
    const library = "test-lib";
    const version = "1.0.0";

    await storeService.removeAllDocuments(library, version);
    expect(mockStore.deleteDocuments).toHaveBeenCalledWith(library, version);
  });

  describe("listVersions", () => {
    it("should return an empty array if the library has no documents", async () => {
      mockStore.queryUniqueVersions.mockResolvedValue([]);
      const versions = await storeService.listVersions("nonexistent-lib");
      expect(versions).toEqual([]);
    });

    it("should return an array of indexed versions", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue([
        "1.0.0",
        "1.1.0",
        "1.2.0",
      ]);

      const versions = await storeService.listVersions(library);
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

      const bestVersion = await storeService.findBestVersion(library, "1.5.0");
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

      expect(await storeService.findBestVersion(library, "1.5.0")).toBe(
        "1.1.1"
      );
      expect(await storeService.findBestVersion(library, "2.0.0")).toBe(
        "1.1.1"
      );
      expect(mockStore.queryUniqueVersions).toHaveBeenCalledWith(library);
    });

    it("should throw VersionNotFoundError for invalid version strings", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue(["1.0.0", "1.1.0"]);
      const validVersions = [
        { version: "1.0.0", indexed: true },
        { version: "1.1.0", indexed: true },
      ];

      await expect(
        storeService.findBestVersion(library, "invalid")
      ).rejects.toThrow(VersionNotFoundError);
      await expect(
        storeService.findBestVersion(library, "1.x.2")
      ).rejects.toThrow(VersionNotFoundError);
      await expect(
        storeService.findBestVersion(library, "1.2.3-alpha")
      ).rejects.toThrow(VersionNotFoundError);

      const error = await storeService
        .findBestVersion(library, "invalid")
        .catch((e) => e);
      expect(error).toBeInstanceOf(VersionNotFoundError);
      expect(error.library).toBe(library);
      expect(error.requestedVersion).toBe("invalid");
      expect(error.availableVersions).toEqual(validVersions);

      expect(mockStore.queryUniqueVersions).toHaveBeenCalledWith(library);
    });

    it("should throw VersionNotFoundError when no versions exist", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue([]);

      const promise = storeService.findBestVersion(library, "1.0.0");
      await expect(promise).rejects.toThrow(VersionNotFoundError);

      const error = await promise.catch((e) => e);
      expect(error.availableVersions).toEqual([]);
    });

    it("should handle 'latest' the same as no version specified", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue([
        "1.0.0",
        "2.0.0",
        "3.0.0",
      ]);

      const latestVersion = await storeService.findBestVersion(
        library,
        "latest"
      );
      const defaultVersion = await storeService.findBestVersion(library);

      expect(latestVersion).toBe("3.0.0");
      expect(defaultVersion).toBe("3.0.0");
      expect(mockStore.queryUniqueVersions).toHaveBeenCalledTimes(2);
    });
  });

  describe("listLibraries", () => {
    it("should list libraries and their versions", async () => {
      const mockLibraryMap = new Map([
        ["lib1", new Set(["1.0.0", "1.1.0"])],
        ["lib2", new Set(["2.0.0"])],
      ]);
      mockStore.queryLibraryVersions.mockResolvedValue(mockLibraryMap);

      const result = await storeService.listLibraries();
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
      const result = await storeService.listLibraries();
      expect(result).toEqual([]);
    });
  });
});
