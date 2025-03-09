import { DocumentationScraperDispatcher } from "./index";
import type { ScraperConfig } from "../types";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { InvalidUrlError, ScraperError } from "../utils/errors";

vi.mock("scrape-it", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((url) => {
    if (url === "https://invalid-url") {
      return Promise.reject(new Error("Invalid URL"));
    }
    return Promise.resolve({
      data: {
        title: "Example Domain",
        content: "<h1>Example Domain</h1>",
        links: [],
      },
      status: 200,
      statusText: "OK",
      $: {}, // Cheerio instance not needed for tests
      body: "<html><body><h1>Example Domain</h1></body></html>",
    });
  }),
}));

describe("DocumentationScraperDispatcher", () => {
  let scraper: DocumentationScraperDispatcher;

  beforeEach(() => {
    scraper = new DocumentationScraperDispatcher();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should use NpmScraperStrategy for npmjs.com", async () => {
    const config: ScraperConfig = {
      url: "https://www.npmjs.com/package/express",
      library: "express",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 0,
    };

    const results = await scraper.scrape(config);
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.url).toBe(
      "https://www.npmjs.com/package/express"
    );
  });

  it("should use NpmScraperStrategy for npmjs.org", async () => {
    const config: ScraperConfig = {
      url: "https://npmjs.org/package/react",
      library: "react",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 0,
    };

    const results = await scraper.scrape(config);
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.url).toBe("https://npmjs.org/package/react");
  });

  it("should use PyPiScraperStrategy for pypi.org", async () => {
    const config: ScraperConfig = {
      url: "https://pypi.org/project/requests",
      library: "requests",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 0,
    };

    const results = await scraper.scrape(config);
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.url).toBe("https://pypi.org/project/requests");
  });

  it("should use DefaultScraperStrategy for other domains", async () => {
    const config: ScraperConfig = {
      url: "https://example.com/docs",
      library: "test",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 0,
    };

    const results = await scraper.scrape(config);
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.url).toBe("https://example.com/docs");
  });

  it("should throw InvalidUrlError for invalid URLs", async () => {
    const config: ScraperConfig = {
      url: "not-a-url",
      library: "test",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 0,
    };

    await expect(scraper.scrape(config)).rejects.toThrow(InvalidUrlError);
    await expect(scraper.scrape(config)).rejects.toThrowError(
      "Invalid URL: not-a-url"
    );
  });

  it("should immediately fail with non-retryable ScraperError for scraping failures", async () => {
    const config: ScraperConfig = {
      url: "https://invalid-url",
      library: "test",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 0,
    };

    let error: ScraperError | null = null;
    try {
      await scraper.scrape(config);
    } catch (e) {
      error = e as ScraperError;
    }

    expect(error).toBeInstanceOf(ScraperError);
    expect(error?.message).toBe(
      "Failed to scrape https://invalid-url: Invalid URL"
    );
    expect(error?.isRetryable).toBe(false);
    expect(error?.cause).toBeDefined();
  });

  it("should pass progress callback to strategy", async () => {
    const progressCallback = vi.fn();
    const config: ScraperConfig = {
      url: "https://example.com/docs",
      library: "test",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 0,
    };

    await scraper.scrape(config, progressCallback);
    expect(progressCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        pagesScraped: 1,
        maxPages: 1,
        currentUrl: "https://example.com/docs",
        depth: 0,
        maxDepth: 0,
      })
    );
  });
});
