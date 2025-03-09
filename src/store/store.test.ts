import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Document } from "@langchain/core/documents";

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
      async addDocuments() {
        return;
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
import { VectorStoreManager } from "./index.js";

const testDir = path.join(os.tmpdir(), "test-docs-mcp");

describe("VectorStoreManager", () => {
  let store: VectorStoreManager;

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    store = new VectorStoreManager(testDir);
  });

  it("should create a store and add a document", async () => {
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

    await store.addDocument(library, version, document);
    const storePath = path.join(testDir, library, version, "store.json");
    expect(fsSync.existsSync(storePath)).toBe(true);
  });

  it("should search for documents", async () => {
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

    await store.addDocument(library, version, document);
    const results = await store.search(library, version, "testing");
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

  it("should find the best version", async () => {
    const library = "test-lib";
    await fs.mkdir(path.join(testDir, library), { recursive: true });
    await fs.mkdir(path.join(testDir, library, "1.0.0"), { recursive: true });
    await fs.mkdir(path.join(testDir, library, "1.1.0"), { recursive: true });
    await fs.mkdir(path.join(testDir, library, "2.0.0"), { recursive: true });

    // Create empty store.json files in each version directory
    await fs.writeFile(
      path.join(testDir, library, "1.0.0", "store.json"),
      "{}"
    );
    await fs.writeFile(
      path.join(testDir, library, "1.1.0", "store.json"),
      "{}"
    );
    await fs.writeFile(
      path.join(testDir, library, "2.0.0", "store.json"),
      "{}"
    );

    const bestVersion = await store.findBestVersion(library, "1.5.0");
    expect(bestVersion).toBe("1.1.0");
  });
});
