import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpFetcher } from "../fetcher";
import { HtmlProcessor, type ProcessedContent } from "../processor";
import type { ScraperOptions } from "../types";
import { WebScraperStrategy } from "./WebScraperStrategy";

// Mock the processor module
vi.mock("../processor");

describe("WebScraperStrategy", () => {
  let options: ScraperOptions;
  let defaultProcessResult: ProcessedContent;

  beforeEach(() => {
    // Provide a default valid result for the processor mock
    defaultProcessResult = {
      content: "Default mock content",
      title: "Default Title",
      source: "mock-source",
      links: [],
      metadata: {},
    };
    vi.spyOn(HtmlProcessor.prototype, "process").mockResolvedValue(defaultProcessResult);

    options = {
      url: "https://example.com",
      library: "test",
      version: "1.0",
      maxPages: 1,
      maxDepth: 1,
    };
  });

  it("canHandle should only accept http/https URLs", () => {
    const strategy = new WebScraperStrategy();
    expect(strategy.canHandle("https://example.com")).toBe(true);
    expect(strategy.canHandle("http://example.com")).toBe(true);
    expect(strategy.canHandle("file:///path/to/file.txt")).toBe(false);
    expect(strategy.canHandle("invalid://example.com")).toBe(false);
    expect(strategy.canHandle("any_string")).toBe(false);
  });

  it("should use HttpFetcher to fetch content", async () => {
    const strategy = new WebScraperStrategy();
    const progressCallback = vi.fn();

    // Mock HttpFetcher.fetch method
    vi.spyOn(HttpFetcher.prototype, "fetch").mockResolvedValue({
      content: "Mock content",
      mimeType: "text/html",
      source: "https://example.com",
    });

    await strategy.scrape(options, progressCallback);

    expect(HttpFetcher.prototype.fetch).toHaveBeenCalledWith("https://example.com");
  });

  it("should respect the maxConcurrency option", async () => {
    const strategy = new WebScraperStrategy();
    const options: ScraperOptions = {
      url: "https://example.com",
      library: "test",
      version: "1.0",
      maxPages: 10,
      maxDepth: 1,
      maxConcurrency: 2,
    };

    // Mock HttpFetcher.fetch with different delays
    vi.spyOn(HttpFetcher.prototype, "fetch").mockImplementation(async (url) => {
      const delay = url.includes("page1") ? 300 : url.includes("page2") ? 200 : 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return {
        content: `Mock content for ${url}`,
        mimeType: "text/html",
        source: url,
        links: [],
      };
    });

    const progressCallback = vi.fn();
    await strategy.scrape(options, progressCallback);

    expect(HttpFetcher.prototype.fetch).toHaveBeenCalledTimes(1);
  });

  // Restore mocks after each test
  afterEach(() => {
    // Restore mocks *before* the next test runs its beforeEach
    vi.restoreAllMocks();
  });

  it("should only follow subpage links when subpagesOnly is true (default)", async () => {
    const strategy = new WebScraperStrategy();
    const options: ScraperOptions = {
      url: "https://example.com/docs/", // Base path with trailing slash
      library: "test",
      version: "1.0",
      maxPages: 5, // Allow multiple pages
      maxDepth: 2, // Allow following links
      subpagesOnly: true, // Explicitly true (also default)
    };
    const progressCallback = vi.fn();

    const fetchSpy = vi
      .spyOn(HttpFetcher.prototype, "fetch")
      .mockImplementation(async (url) => ({
        // Simple fetch mock, processor will provide links
        content: `Content for ${url}`,
        mimeType: "text/html",
        source: url,
      }));

    // Mock HtmlProcessor to return specific links for the root URL
    const processSpy = vi
      .spyOn(HtmlProcessor.prototype, "process")
      .mockImplementation(async (rawContent) => {
        if (rawContent.source === "https://example.com/docs/") {
          return {
            content: "Processed content",
            title: "Docs Index",
            source: rawContent.source,
            links: [
              "https://example.com/docs/page1", // Subpage
              "https://example.com/other/page2", // Outside /docs/
              "https://example.com/docs/page3/", // Subpage with slash
              "https://anothersite.com/", // Cross-origin link
              "/docs/relative", // Relative subpage
              "/other/relative", // Relative outside
            ],
            metadata: {},
          };
        }
        // Return no links for subsequent pages
        return {
          content: "Processed subpage",
          title: "Subpage",
          source: rawContent.source,
          links: [],
          metadata: {},
        };
      });

    await strategy.scrape(options, progressCallback);

    // Should fetch: root + page1 + page3 + relative
    // Should fetch: root + page1 + page3 + relative (4 total)
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/page1");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/page3/");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/relative");
    expect(fetchSpy).not.toHaveBeenCalledWith("https://example.com/other/page2");
    expect(fetchSpy).not.toHaveBeenCalledWith("https://anothersite.com/");
    expect(fetchSpy).not.toHaveBeenCalledWith("https://example.com/other/relative");
    expect(processSpy).toHaveBeenCalledTimes(4); // Processor called for each fetched page
  });

  it("should follow links outside base path when subpagesOnly is false", async () => {
    const strategy = new WebScraperStrategy();
    const options: ScraperOptions = {
      url: "https://example.com/docs/",
      library: "test",
      version: "1.0",
      maxPages: 5,
      maxDepth: 2,
      subpagesOnly: false, // Explicitly false
    };
    const progressCallback = vi.fn();

    const fetchSpy = vi
      .spyOn(HttpFetcher.prototype, "fetch")
      .mockImplementation(async (url) => ({
        // Simple fetch mock
        content: `Content for ${url}`,
        mimeType: "text/html",
        source: url,
      }));

    // Mock HtmlProcessor to return specific links for the root URL
    const processSpy = vi
      .spyOn(HtmlProcessor.prototype, "process")
      .mockImplementation(async (rawContent) => {
        if (rawContent.source === "https://example.com/docs/") {
          return {
            content: "Processed content",
            title: "Docs Index",
            source: rawContent.source,
            links: [
              "https://example.com/docs/page1", // Subpage
              "https://example.com/other/page2", // Outside /docs/
              "https://anothersite.com/", // Cross-origin link
              "/docs/relative", // Relative subpage
              "/other/relative", // Relative outside
            ],
            metadata: {},
          };
        }
        // Return no links for subsequent pages
        return {
          content: "Processed subpage",
          title: "Subpage",
          source: rawContent.source,
          links: [],
          metadata: {},
        };
      });

    await strategy.scrape(options, progressCallback);

    // Should fetch: root + page1 + page2 + relative_sub + relative_other (5 total)
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/page1");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/other/page2"); // Included now
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/relative");
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/other/relative"); // Included now
    expect(fetchSpy).not.toHaveBeenCalledWith("https://anothersite.com/"); // Link removed from mock
    expect(processSpy).toHaveBeenCalledTimes(5); // Processor called for each fetched page
  });
});
