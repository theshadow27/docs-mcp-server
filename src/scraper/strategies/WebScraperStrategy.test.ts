import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpFetcher } from "../fetcher";
import type { ScraperOptions } from "../types";
import { WebScraperStrategy } from "./WebScraperStrategy";
describe("WebScraperStrategy", () => {
  let options: ScraperOptions;

  beforeEach(() => {
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
});
