import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileFetcher, HttpFetcher } from "../scraper/fetcher";
import type { HtmlProcessor } from "../scraper/processor";
import { ScraperError } from "../utils/errors";
import { logger } from "../utils/logger";
import { FetchUrlTool, type FetchUrlToolOptions } from "./FetchUrlTool";
import { ToolError } from "./errors";

// Mock dependencies
vi.mock("../utils/logger");
vi.mock("../scraper/fetcher/HttpFetcher");
vi.mock("../scraper/fetcher/FileFetcher");
vi.mock("../scraper/processor/HtmlProcessor");

describe("FetchUrlTool", () => {
  let mockHttpFetcher: Partial<HttpFetcher>;
  let mockFileFetcher: Partial<FileFetcher>;
  let mockHtmlProcessor: Partial<HtmlProcessor>;
  let fetchUrlTool: FetchUrlTool;

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();

    // Setup mock HttpFetcher
    mockHttpFetcher = {
      canFetch: vi.fn(),
      fetch: vi.fn(),
    };

    // Setup mock FileFetcher
    mockFileFetcher = {
      canFetch: vi.fn(),
      fetch: vi.fn(),
    };

    // Setup mock HtmlProcessor
    mockHtmlProcessor = {
      process: vi.fn(),
    };

    // Create instance of the tool with the mock dependencies
    fetchUrlTool = new FetchUrlTool(
      mockHttpFetcher as HttpFetcher,
      mockFileFetcher as FileFetcher,
      mockHtmlProcessor as HtmlProcessor,
    );
  });

  it("should fetch a URL and convert it to markdown", async () => {
    const url = "https://example.com/docs";
    const options: FetchUrlToolOptions = { url };

    // Mock fetchers to determine which one should handle this URL
    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(true);
    mockFileFetcher.canFetch = vi.fn().mockReturnValue(false);

    // Mock the fetcher response
    mockHttpFetcher.fetch = vi.fn().mockResolvedValue({
      content: "<h1>Hello World</h1>",
      mimeType: "text/html",
      source: url,
    });

    // Mock the processor response
    mockHtmlProcessor.process = vi.fn().mockResolvedValue({
      content: "# Hello World",
      title: "Example Page",
      source: url,
      links: [],
      metadata: {},
    });

    const result = await fetchUrlTool.execute(options);

    // Verify the call chain and result
    expect(mockHttpFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockFileFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith(url, {
      followRedirects: true,
      maxRetries: 3,
    });
    expect(mockFileFetcher.fetch).not.toHaveBeenCalled();
    expect(mockHtmlProcessor.process).toHaveBeenCalledWith({
      content: "<h1>Hello World</h1>",
      mimeType: "text/html",
      source: url,
    });
    expect(result).toBe("# Hello World");
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Fetching"));
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Converting to Markdown"),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Successfully converted"),
    );
  });

  it("should fetch a file URL and convert it to markdown", async () => {
    const url = "file:///path/to/document.html";
    const options: FetchUrlToolOptions = { url };

    // Mock fetchers to determine which one should handle this URL
    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(false);
    mockFileFetcher.canFetch = vi.fn().mockReturnValue(true);

    // Mock the fetcher response
    mockFileFetcher.fetch = vi.fn().mockResolvedValue({
      content: "<h1>Local File Content</h1>",
      mimeType: "text/html",
      source: url,
      encoding: "utf-8",
    });

    // Mock the processor response
    mockHtmlProcessor.process = vi.fn().mockResolvedValue({
      content: "# Local File Content",
      title: "Local Document",
      source: url,
      links: [],
      metadata: {},
    });

    const result = await fetchUrlTool.execute(options);

    // Verify the call chain and result
    expect(mockHttpFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockFileFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockFileFetcher.fetch).toHaveBeenCalledWith(url, {
      followRedirects: true,
      maxRetries: 3,
    });
    expect(mockHttpFetcher.fetch).not.toHaveBeenCalled();
    expect(mockHtmlProcessor.process).toHaveBeenCalledWith({
      content: "<h1>Local File Content</h1>",
      mimeType: "text/html",
      source: url,
      encoding: "utf-8",
    });
    expect(result).toBe("# Local File Content");
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Fetching"));
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Converting to Markdown"),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Successfully converted"),
    );
  });

  it("should throw ToolError if URL is invalid", async () => {
    const invalidUrl = "invalid://example.com";
    const options: FetchUrlToolOptions = { url: invalidUrl };

    // Mock the fetchers to reject the URL
    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(false);
    mockFileFetcher.canFetch = vi.fn().mockReturnValue(false);

    await expect(fetchUrlTool.execute(options)).rejects.toThrow(ToolError);
    expect(mockHttpFetcher.canFetch).toHaveBeenCalledWith(invalidUrl);
    expect(mockFileFetcher.canFetch).toHaveBeenCalledWith(invalidUrl);
    expect(mockHttpFetcher.fetch).not.toHaveBeenCalled();
    expect(mockFileFetcher.fetch).not.toHaveBeenCalled();
    expect(mockHtmlProcessor.process).not.toHaveBeenCalled();
  });

  it("should handle ScraperError during fetch", async () => {
    const url = "https://example.com/broken";
    const options: FetchUrlToolOptions = { url };

    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(true);
    mockHttpFetcher.fetch = vi.fn().mockRejectedValue(new ScraperError("Network error"));

    await expect(fetchUrlTool.execute(options)).rejects.toThrow(ToolError);
    expect(mockHttpFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockHttpFetcher.fetch).toHaveBeenCalled();
    expect(mockHtmlProcessor.process).not.toHaveBeenCalled();
  });

  it("should handle non-ScraperError during fetch", async () => {
    const url = "https://example.com/error";
    const options: FetchUrlToolOptions = { url };

    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(true);
    mockHttpFetcher.fetch = vi.fn().mockRejectedValue(new Error("Unexpected error"));

    await expect(fetchUrlTool.execute(options)).rejects.toThrow(ToolError);
    expect(mockHttpFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockHttpFetcher.fetch).toHaveBeenCalled();
    expect(mockHtmlProcessor.process).not.toHaveBeenCalled();
  });

  it("should handle ScraperError during processing", async () => {
    const url = "https://example.com/process-error";
    const options: FetchUrlToolOptions = { url };

    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(true);
    mockHttpFetcher.fetch = vi.fn().mockResolvedValue({
      content: "<h1>Problematic Content</h1>",
      mimeType: "text/html",
      source: url,
    });
    mockHtmlProcessor.process = vi
      .fn()
      .mockRejectedValue(new ScraperError("Processing failed"));

    await expect(fetchUrlTool.execute(options)).rejects.toThrow(ToolError);
    expect(mockHttpFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockHttpFetcher.fetch).toHaveBeenCalled();
    expect(mockHtmlProcessor.process).toHaveBeenCalled();
  });

  it("should handle ScraperError during file fetch", async () => {
    const url = "file:///path/to/missing/file.html";
    const options: FetchUrlToolOptions = { url };

    // Mock fetchers to determine which one should handle this URL
    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(false);
    mockFileFetcher.canFetch = vi.fn().mockReturnValue(true);

    // Mock file fetcher to throw an error
    mockFileFetcher.fetch = vi.fn().mockRejectedValue(new ScraperError("File not found"));

    await expect(fetchUrlTool.execute(options)).rejects.toThrow(ToolError);
    expect(mockHttpFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockFileFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockFileFetcher.fetch).toHaveBeenCalled();
    expect(mockHttpFetcher.fetch).not.toHaveBeenCalled();
    expect(mockHtmlProcessor.process).not.toHaveBeenCalled();
  });

  it("should handle non-ScraperError during file fetch", async () => {
    const url = "file:///path/to/inaccessible/file.html";
    const options: FetchUrlToolOptions = { url };

    // Mock fetchers to determine which one should handle this URL
    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(false);
    mockFileFetcher.canFetch = vi.fn().mockReturnValue(true);

    // Mock file fetcher to throw a different kind of error
    mockFileFetcher.fetch = vi.fn().mockRejectedValue(new Error("Permission denied"));

    await expect(fetchUrlTool.execute(options)).rejects.toThrow(ToolError);
    expect(mockHttpFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockFileFetcher.canFetch).toHaveBeenCalledWith(url);
    expect(mockFileFetcher.fetch).toHaveBeenCalled();
    expect(mockHttpFetcher.fetch).not.toHaveBeenCalled();
    expect(mockHtmlProcessor.process).not.toHaveBeenCalled();
  });

  it("should respect followRedirects=false for HTTP URLs", async () => {
    const url = "https://example.com/docs";
    const options: FetchUrlToolOptions = { url, followRedirects: false };

    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(true);
    mockFileFetcher.canFetch = vi.fn().mockReturnValue(false);
    mockHttpFetcher.fetch = vi.fn().mockResolvedValue({
      content: "<h1>No Redirects</h1>",
      mimeType: "text/html",
      source: url,
    });
    mockHtmlProcessor.process = vi.fn().mockResolvedValue({
      content: "# No Redirects",
      title: "Example Page",
      source: url,
      links: [],
      metadata: {},
    });

    await fetchUrlTool.execute(options);

    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith(url, {
      followRedirects: false,
      maxRetries: 3,
    });
  });

  it("should respect followRedirects=false for file URLs", async () => {
    const url = "file:///path/to/document.html";
    const options: FetchUrlToolOptions = { url, followRedirects: false };

    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(false);
    mockFileFetcher.canFetch = vi.fn().mockReturnValue(true);
    mockFileFetcher.fetch = vi.fn().mockResolvedValue({
      content: "<h1>Local File</h1>",
      mimeType: "text/html",
      source: url,
      encoding: "utf-8",
    });
    mockHtmlProcessor.process = vi.fn().mockResolvedValue({
      content: "# Local File",
      title: "Local Document",
      source: url,
      links: [],
      metadata: {},
    });

    await fetchUrlTool.execute(options);

    expect(mockFileFetcher.fetch).toHaveBeenCalledWith(url, {
      followRedirects: false,
      maxRetries: 3,
    });
  });

  it("should use followRedirects=true by default for HTTP URLs", async () => {
    const url = "https://example.com/docs";
    const options: FetchUrlToolOptions = { url };

    mockHttpFetcher.canFetch = vi.fn().mockReturnValue(true);
    mockFileFetcher.canFetch = vi.fn().mockReturnValue(false);
    mockHttpFetcher.fetch = vi.fn().mockResolvedValue({
      content: "<h1>With Redirects</h1>",
      mimeType: "text/html",
      source: url,
    });
    mockHtmlProcessor.process = vi.fn().mockResolvedValue({
      content: "# With Redirects",
      title: "Example Page",
      source: url,
      links: [],
      metadata: {},
    });

    await fetchUrlTool.execute(options);

    expect(mockHttpFetcher.fetch).toHaveBeenCalledWith(url, {
      followRedirects: true,
      maxRetries: 3,
    });
  });
});
