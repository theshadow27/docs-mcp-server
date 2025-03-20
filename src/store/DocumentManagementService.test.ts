import { Document } from "@langchain/core/documents";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VersionNotFoundError } from "../tools/errors";
import { DocumentManagementService } from "./DocumentManagementService";
import { DocumentRetrieverService } from "./DocumentRetrieverService";
import { StoreError } from "./errors";

// Mock document store and retriever
const mockStore = {
  initialize: vi.fn(),
  shutdown: vi.fn(),
  queryUniqueVersions: vi.fn(),
  checkDocumentExists: vi.fn(),
  queryLibraryVersions: vi.fn(),
  addDocuments: vi.fn(),
  deleteDocuments: vi.fn(),
};

const mockRetriever = {
  search: vi.fn(),
};

vi.mock("./DocumentStore", () => ({
  DocumentStore: vi.fn().mockImplementation(() => mockStore),
}));

vi.mock("./DocumentRetrieverService", () => ({
  DocumentRetrieverService: vi.fn().mockImplementation(() => mockRetriever),
}));

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DocumentManagementService", () => {
  let docService: DocumentManagementService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POSTGRES_CONNECTION = "postgres://user:pass@localhost:5432/testdb";
    docService = new DocumentManagementService();
  });

  afterEach(async () => {
    await docService.shutdown();
  });

  it("should initialize correctly", async () => {
    await docService.initialize();
    expect(mockStore.initialize).toHaveBeenCalled();
  });

  it("should handle empty store existence check", async () => {
    mockStore.checkDocumentExists.mockImplementation((lib, ver) =>
      Promise.resolve(false),
    );
    const exists = await docService.exists("test-lib", "1.0.0");
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
        docService.addDocument(library, version, documentNoUrl),
      ).rejects.toThrow(StoreError);

      await expect(
        docService.addDocument(library, version, documentNoUrl),
      ).rejects.toHaveProperty("message", "Document metadata must include a valid URL");

      // Should succeed with valid URL
      mockRetriever.search.mockResolvedValue(["Mocked search result"]);

      await docService.addDocument(library, version, validDocument);

      const results = await docService.searchStore(library, version, "testing");
      expect(mockStore.addDocuments).toHaveBeenCalledWith(
        library,
        version,
        expect.arrayContaining([
          expect.objectContaining({ pageContent: validDocument.pageContent }),
        ]),
      );
      expect(results).toEqual(["Mocked search result"]); // Expect mocked result
    });

    it("should preserve semantic metadata when processing markdown documents", async () => {
      const library = "test-lib";
      const version = "1.0.0";
      const document = new Document({
        pageContent: "# Chapter 1\nTest content\n## Section 1.1\nMore testing content",
        metadata: {
          url: "http://example.com/docs",
          title: "Root Doc",
        },
      });

      // Mock the search result to match what would actually be stored after processing
      mockRetriever.search.mockResolvedValue(["Mocked search result"]);

      await docService.addDocument(library, version, document);

      // Verify the documents were stored with semantic metadata
      expect(mockStore.addDocuments).toHaveBeenCalledWith(
        library,
        version,
        expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              level: 1,
              path: expect.arrayContaining(["Chapter 1", "Section 1.1"]),
            }),
          }),
        ]),
      );

      // Verify search results preserve metadata
      const results = await docService.searchStore(library, version, "testing");
      expect(results).toEqual(["Mocked search result"]);
    });
  });

  it("should remove all documents for a specific library and version", async () => {
    const library = "test-lib";
    const version = "1.0.0";

    await docService.removeAllDocuments(library, version);
    expect(mockStore.deleteDocuments).toHaveBeenCalledWith(library, version);
  });

  describe("listVersions", () => {
    it("should return an empty array if the library has no documents", async () => {
      mockStore.queryUniqueVersions.mockResolvedValue([]);
      const versions = await docService.listVersions("nonexistent-lib");
      expect(versions).toEqual([]);
    });

    it("should return an array of indexed versions", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue(["1.0.0", "1.1.0", "1.2.0"]);

      const versions = await docService.listVersions(library);
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
      mockStore.queryUniqueVersions.mockResolvedValue(["1.0.0", "1.1.0", "2.0.0"]);

      const bestVersion = await docService.findBestVersion(library, "1.5.0");
      expect(bestVersion).toBe("1.1.0");
      expect(mockStore.queryUniqueVersions).toHaveBeenCalledWith(library);
    });

    it("should fall back to lower version if requested version is higher", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue(["1.0.0", "1.1.0", "1.1.1"]);

      expect(await docService.findBestVersion(library, "1.5.0")).toBe("1.1.1");
      expect(await docService.findBestVersion(library, "2.0.0")).toBe("1.1.1");
      expect(mockStore.queryUniqueVersions).toHaveBeenCalledWith(library);
    });

    it("should throw VersionNotFoundError for invalid version strings", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue(["1.0.0", "1.1.0"]);
      const validVersions = [
        { version: "1.0.0", indexed: true },
        { version: "1.1.0", indexed: true },
      ];

      await expect(docService.findBestVersion(library, "invalid")).rejects.toThrow(
        VersionNotFoundError,
      );
      await expect(docService.findBestVersion(library, "1.x.2")).rejects.toThrow(
        VersionNotFoundError,
      );
      await expect(docService.findBestVersion(library, "1.2.3-alpha")).rejects.toThrow(
        VersionNotFoundError,
      );

      const error = await docService.findBestVersion(library, "invalid").catch((e) => e);
      expect(error).toBeInstanceOf(VersionNotFoundError);
      expect(error.library).toBe(library);
      expect(error.requestedVersion).toBe("invalid");
      expect(error.availableVersions).toEqual(validVersions);

      expect(mockStore.queryUniqueVersions).toHaveBeenCalledWith(library);
    });

    it("should throw VersionNotFoundError when no versions exist", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue([]);

      const promise = docService.findBestVersion(library, "1.0.0");
      await expect(promise).rejects.toThrow(VersionNotFoundError);

      const error = await promise.catch((e) => e);
      expect(error.availableVersions).toEqual([]);
    });

    it("should handle 'latest' the same as no version specified", async () => {
      const library = "test-lib";
      mockStore.queryUniqueVersions.mockResolvedValue(["1.0.0", "2.0.0", "3.0.0"]);

      const latestVersion = await docService.findBestVersion(library, "latest");
      const defaultVersion = await docService.findBestVersion(library);

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

      const result = await docService.listLibraries();
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
      const result = await docService.listLibraries();
      expect(result).toEqual([]);
    });
  });
});
