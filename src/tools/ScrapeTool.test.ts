import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { DocumentManagementService } from "../store/DocumentManagementService";
import { DocumentProcessingPipeline } from "../pipeline/DocumentProcessingPipeline";
import { ScrapeTool, type ScrapeToolOptions } from "./ScrapeTool";
import { logger } from "../utils/logger";
import type { ProgressResponse } from "../types";
import type { ScraperProgress } from "../scraper/types";

// Mock dependencies
vi.mock("../store/DocumentManagementService");
vi.mock("../pipeline/DocumentProcessingPipeline");
vi.mock("../utils/logger");
// Mock semver if needed for specific coercion tests, but often not necessary
// vi.mock('semver');

describe("ScrapeTool", () => {
  let mockDocService: Partial<DocumentManagementService>;
  let mockPipelineInstance: Partial<DocumentProcessingPipeline>;
  let scrapeTool: ScrapeTool;
  let mockOnProgress: Mock<(response: ProgressResponse) => void>;

  // Mock implementation for pipeline callbacks
  let pipelineCallbacks: {
    onProgress?: (progress: ScraperProgress) => Promise<void>;
    onError?: (error: Error, doc?: any) => Promise<void>;
  } = {};

  beforeEach(() => {
    vi.resetAllMocks();

    mockDocService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      removeAllDocuments: vi.fn().mockResolvedValue(undefined),
    };

    // Mock the pipeline instance methods and callback setter
    mockPipelineInstance = {
      process: vi.fn().mockResolvedValue(undefined), // Default success
      setCallbacks: vi.fn((callbacks) => {
        pipelineCallbacks = callbacks; // Capture callbacks for simulation
      }),
    };

    // Mock the constructor of DocumentProcessingPipeline to return our mock instance
    (DocumentProcessingPipeline as Mock).mockImplementation(() => mockPipelineInstance);

    scrapeTool = new ScrapeTool(mockDocService as DocumentManagementService);
    mockOnProgress = vi.fn();
    pipelineCallbacks = {}; // Reset captured callbacks
  });

  // Helper function for basic options
  const getBaseOptions = (
    version?: string | null,
    onProgress?: Mock,
  ): ScrapeToolOptions => ({
    library: "test-lib",
    version: version,
    url: "http://example.com/docs",
    onProgress: onProgress,
  });

  // --- Version Handling Tests ---

  it.each([
    { input: "1.2.3", expectedInternal: "1.2.3" },
    { input: "1.2.3-beta.1", expectedInternal: "1.2.3-beta.1" },
    { input: "1", expectedInternal: "1.0.0" }, // Coerced
    { input: "1.2", expectedInternal: "1.2.0" }, // Coerced
    { input: null, expectedInternal: "" }, // Null -> Unversioned
    { input: undefined, expectedInternal: "" }, // Undefined -> Unversioned
  ])(
    "should handle valid version input '$input' correctly",
    async ({ input, expectedInternal }) => {
      const options = getBaseOptions(input);
      await scrapeTool.execute(options);

      expect(mockDocService.initialize).toHaveBeenCalledOnce();
      expect(mockDocService.removeAllDocuments).toHaveBeenCalledWith(
        "test-lib",
        expectedInternal.toLowerCase(), // Ensure it's lowercased
      );
      expect(DocumentProcessingPipeline).toHaveBeenCalledWith(
        expect.anything(), // mockDocService
        "test-lib",
        expectedInternal.toLowerCase(),
      );
      expect(mockPipelineInstance.process).toHaveBeenCalledOnce();
    },
  );

  it.each(["latest", "1.x", "invalid-version"])(
    "should throw error for invalid version format '%s'",
    async (invalidVersion) => {
      const options = getBaseOptions(invalidVersion);

       await expect(scrapeTool.execute(options)).rejects.toThrow(
         /Invalid version format for scraping/,
       );
       // Initialize IS called before the version check throws
+      expect(mockDocService.initialize).toHaveBeenCalledOnce();
       expect(mockDocService.removeAllDocuments).not.toHaveBeenCalled();
       expect(mockPipelineInstance.process).not.toHaveBeenCalled();
     },
  );

  // --- Pipeline Execution Tests ---

  it("should execute the pipeline process with correct options", async () => {
    const options: ScrapeToolOptions = {
      ...getBaseOptions("1.0.0"),
      options: {
        maxPages: 50,
        maxDepth: 2,
        ignoreErrors: false,
      },
    };
    await scrapeTool.execute(options);

    expect(mockPipelineInstance.process).toHaveBeenCalledWith({
      url: "http://example.com/docs",
      library: "test-lib",
      version: "1.0.0", // Normalized and lowercased
      subpagesOnly: true, // Default
      maxPages: 50, // Overridden
      maxDepth: 2, // Overridden
      maxConcurrency: 3, // Default
      ignoreErrors: false, // Overridden
    });
  });

  it("should return the number of pages scraped on successful completion", async () => {
    const options = getBaseOptions("1.0.0");
    // Simulate progress callback updating pagesScraped
    (mockPipelineInstance.process as Mock).mockImplementation(async () => {
      if (pipelineCallbacks.onProgress) {
        await pipelineCallbacks.onProgress({ pagesScraped: 10, maxPages: 100, currentUrl: "url1", depth: 1, maxDepth: 3 });
        await pipelineCallbacks.onProgress({ pagesScraped: 25, maxPages: 100, currentUrl: "url2", depth: 2, maxDepth: 3 });
      }
    });

    const result = await scrapeTool.execute(options);

    expect(result).toEqual({ pagesScraped: 25 });
  });

  it("should propagate errors from the pipeline process", async () => {
    const options = getBaseOptions("1.0.0");
    const pipelineError = new Error("Pipeline failed");
    (mockPipelineInstance.process as Mock).mockRejectedValue(pipelineError);

    await expect(scrapeTool.execute(options)).rejects.toThrow("Pipeline failed");
  });

  // --- Callback Tests ---

  it("should call onProgress callback when pipeline reports progress", async () => {
    const options = getBaseOptions("1.0.0", mockOnProgress);
    (mockPipelineInstance.process as Mock).mockImplementation(async () => {
      // Simulate pipeline calling its progress callback
      if (pipelineCallbacks.onProgress) {
        await pipelineCallbacks.onProgress({ pagesScraped: 5, maxPages: 10, currentUrl: "http://page.com", depth: 1, maxDepth: 2 });
      }
    });

    await scrapeTool.execute(options);

    expect(mockOnProgress).toHaveBeenCalledOnce();
    expect(mockOnProgress).toHaveBeenCalledWith({
      content: [{ type: "text", text: expect.stringContaining("Indexed page 5/10") }],
    });
  });

  it("should call onProgress callback when pipeline reports an error", async () => {
     const options = getBaseOptions("1.0.0", mockOnProgress);
    const docError = new Error("Failed to parse");
    (mockPipelineInstance.process as Mock).mockImplementation(async () => {
      // Simulate pipeline calling its error callback
      if (pipelineCallbacks.onError) {
        await pipelineCallbacks.onError(docError, { metadata: { title: "Bad Doc" } });
      }
    });

    await scrapeTool.execute(options);

    expect(mockOnProgress).toHaveBeenCalledOnce();
     expect(mockOnProgress).toHaveBeenCalledWith({
      content: [{ type: "text", text: expect.stringContaining("Error processing Bad Doc: Failed to parse") }],
    });
  });

   it("should not fail if onProgress is not provided", async () => {
    const options = getBaseOptions("1.0.0"); // No onProgress callback
     (mockPipelineInstance.process as Mock).mockImplementation(async () => {
      if (pipelineCallbacks.onProgress) {
        await pipelineCallbacks.onProgress({ pagesScraped: 1, maxPages: 10, currentUrl: "url", depth: 0, maxDepth: 1 });
      }
       if (pipelineCallbacks.onError) {
        await pipelineCallbacks.onError(new Error("Test Error"));
      }
    });

    // Expect no error to be thrown during execution when callbacks fire internally
    await expect(scrapeTool.execute(options)).resolves.toBeDefined();
  });

});
