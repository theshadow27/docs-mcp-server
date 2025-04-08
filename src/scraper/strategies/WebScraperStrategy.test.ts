import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpFetcher } from "../fetcher";
import { HtmlProcessor, type ProcessedContent } from "../processor";
import type { ScraperOptions } from "../types";
import { WebScraperStrategy } from "./WebScraperStrategy";

// Mock dependencies
vi.mock("../../utils/logger");
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

    // Call scrape without signal
    await strategy.scrape(options, progressCallback);

    // Expect fetch to be called with url and options object containing undefined signal
    expect(HttpFetcher.prototype.fetch).toHaveBeenCalledWith("https://example.com", {
      signal: undefined,
    });
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

  it("should only follow subpage links when scope is 'subpages' (default)", async () => {
    const strategy = new WebScraperStrategy();
    const options: ScraperOptions = {
      url: "https://example.com/docs/", // Base path with trailing slash
      library: "test",
      version: "1.0",
      maxPages: 5, // Allow multiple pages
      maxDepth: 2, // Allow following links
      scope: "subpages", // Default scope
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
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/", {
      signal: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/page1", {
      signal: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/page3/", {
      signal: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/relative", {
      signal: undefined,
    });
    // Check calls that should NOT have happened (no need to check signal here)
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "https://example.com/other/page2",
      expect.anything(),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "https://anothersite.com/",
      expect.anything(),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "https://example.com/other/relative",
      expect.anything(),
    );
    expect(processSpy).toHaveBeenCalledTimes(4); // Processor called for each fetched page
  });

  it("should follow links outside base path when scope is 'hostname'", async () => {
    const strategy = new WebScraperStrategy();
    const options: ScraperOptions = {
      url: "https://example.com/docs/",
      library: "test",
      version: "1.0",
      maxPages: 5,
      maxDepth: 2,
      scope: "hostname", // Use hostname scope instead of subpagesOnly
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
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/", {
      signal: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/page1", {
      signal: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/other/page2", {
      signal: undefined,
    }); // Included now
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/relative", {
      signal: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/other/relative", {
      signal: undefined,
    }); // Included now
    // Check calls that should NOT have happened
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "https://anothersite.com/",
      expect.anything(),
    );
    expect(processSpy).toHaveBeenCalledTimes(5); // Processor called for each fetched page
  });

  it("should follow only same hostname links when scope is 'hostname'", async () => {
    const strategy = new WebScraperStrategy();
    const options: ScraperOptions = {
      url: "https://example.com/docs/",
      library: "test",
      version: "1.0",
      maxPages: 5,
      maxDepth: 2,
      scope: "hostname", // Use hostname scope
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
              "https://example.com/docs/page1", // Same path
              "https://example.com/other/page2", // Different path, same hostname
              "https://subdomain.example.com/page", // Subdomain (should be excluded)
              "https://anothersite.com/", // Different domain
              "/docs/relative", // Relative within same path
              "/other/relative", // Relative to different path
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

    // Should fetch: same hostname URLs regardless of path
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/", {
      signal: undefined,
      followRedirects: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/page1", {
      signal: undefined,
      followRedirects: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/other/page2", {
      signal: undefined,
      followRedirects: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/relative", {
      signal: undefined,
      followRedirects: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/other/relative", {
      signal: undefined,
      followRedirects: undefined,
    });

    // Check calls that should NOT have happened
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "https://subdomain.example.com/page",
      expect.anything(),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "https://anothersite.com/",
      expect.anything(),
    );
    expect(processSpy).toHaveBeenCalledTimes(5);
  });

  it("should follow all same domain links (including subdomains) when scope is 'domain'", async () => {
    const strategy = new WebScraperStrategy();
    const options: ScraperOptions = {
      url: "https://docs.example.com/v1/",
      library: "test",
      version: "1.0",
      maxPages: 5,
      maxDepth: 2,
      scope: "domain", // Use domain scope
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
        if (rawContent.source === "https://docs.example.com/v1/") {
          return {
            content: "Processed content",
            title: "Docs Index",
            source: rawContent.source,
            links: [
              "https://docs.example.com/v1/intro", // Same subdomain, same path
              "https://docs.example.com/v2/guide", // Same subdomain, different path
              "https://api.example.com/reference", // Different subdomain, same domain
              "https://example.com/main", // Apex domain
              "https://different.org/page", // Different domain
              "/v1/relative", // Relative within same path
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

    // Should fetch: all URLs on same domain, including subdomains
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    expect(fetchSpy).toHaveBeenCalledWith("https://docs.example.com/v1/", {
      signal: undefined,
      followRedirects: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://docs.example.com/v1/intro", {
      signal: undefined,
      followRedirects: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://docs.example.com/v2/guide", {
      signal: undefined,
      followRedirects: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://api.example.com/reference", {
      signal: undefined,
      followRedirects: undefined,
    });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/main", {
      signal: undefined,
      followRedirects: undefined,
    });

    // Check calls that should NOT have happened
    expect(fetchSpy).not.toHaveBeenCalledWith(
      "https://different.org/page",
      expect.anything(),
    );

    expect(processSpy).toHaveBeenCalledTimes(5);
  });

  it("should respect the followRedirects option", async () => {
    const strategy = new WebScraperStrategy();
    const options: ScraperOptions = {
      url: "https://example.com/docs/",
      library: "test",
      version: "1.0",
      maxPages: 2,
      maxDepth: 1,
      followRedirects: false, // Explicitly disable following redirects
    };
    const progressCallback = vi.fn();

    const fetchSpy = vi
      .spyOn(HttpFetcher.prototype, "fetch")
      .mockImplementation(async (url, options) => ({
        content: `Content for ${url}`,
        mimeType: "text/html",
        source: url,
      }));

    // Mock HtmlProcessor for a single page with no links
    vi.spyOn(HtmlProcessor.prototype, "process").mockResolvedValue({
      content: "Processed content",
      title: "Page",
      source: "https://example.com/docs/",
      links: [],
      metadata: {},
    });

    await strategy.scrape(options, progressCallback);

    // Verify the followRedirects option was passed to the fetcher
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/docs/", {
      signal: undefined,
      followRedirects: false,
    });
  });
});
