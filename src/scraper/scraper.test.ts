import { DocumentationScraper } from "./index";
import type { ScraperConfig } from "../types";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import scrapeIt from "scrape-it";

vi.mock("scrape-it", () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue({
    data: {
      title: "Example Domain",
      content: "<h1>Example Domain</h1>",
      links: [],
    },
    status: 200,
    statusText: "OK",
    $: {}, // Cheerio instance not needed for tests
    body: "<html><body><h1>Example Domain</h1></body></html>",
  }),
}));

let scraper: DocumentationScraper;

describe("DocumentationScraper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scraper = new DocumentationScraper();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should scrape a simple page", async () => {
    const config: ScraperConfig = {
      url: "https://example.com",
      library: "test",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 0,
    };

    const results = await scraper.scrape(config);
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe("Example Domain");
    expect(results[0].content).toBe("# Example Domain");
  });

  describe("Content selection", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should scrape content from article tag", async () => {
      vi.mocked(scrapeIt).mockResolvedValueOnce({
        data: {
          title: "Test Page",
          content:
            "<article><h1>Main Content</h1><p>Article content here</p></article>",
          links: [],
        },
        status: 200,
        statusText: "OK",
        $: {}, // Cheerio instance not needed for tests
        body: "<html><body><article><h1>Main Content</h1><p>Article content here</p></article></body></html>",
      });

      const config: ScraperConfig = {
        url: "https://example.com",
        library: "test",
        version: "1.0.0",
        maxPages: 1,
        maxDepth: 0,
      };

      const results = await scraper.scrape(config);
      expect(results[0].content).toContain("Main Content");
      expect(results[0].content).toContain("Article content here");
    });

    it("should fallback to body when no specific content container exists", async () => {
      vi.mocked(scrapeIt).mockResolvedValueOnce({
        data: {
          title: "Test Page",
          content: "<body><div>Simple body content</div></body>",
          links: [],
        },
        status: 200,
        statusText: "OK",
        $: {}, // Cheerio instance not needed for tests
        body: "<html><body><div>Simple body content</div></body></html>",
      });

      const config: ScraperConfig = {
        url: "https://example.com",
        library: "test",
        version: "1.0.0",
        maxPages: 1,
        maxDepth: 0,
      };

      const results = await scraper.scrape(config);
      expect(results[0].content).toContain("Simple body content");
    });

    it("should scrape nested content structures", async () => {
      vi.mocked(scrapeIt).mockResolvedValueOnce({
        data: {
          title: "Test Page",
          content: `
            <main>
              <article>
                <div class="content">
                  <h1>Nested Title</h1>
                  <p>Deeply nested content</p>
                </div>
              </article>
            </main>
          `,
          links: [],
        },
        status: 200,
        statusText: "OK",
        $: {}, // Cheerio instance not needed for tests
        body: "<html><body><main><article><div class='content'><h1>Nested Title</h1><p>Deeply nested content</p></div></article></main></body></html>",
      });

      const config: ScraperConfig = {
        url: "https://example.com",
        library: "test",
        version: "1.0.0",
        maxPages: 1,
        maxDepth: 0,
      };

      const results = await scraper.scrape(config);
      expect(results[0].content).toContain("Nested Title");
      expect(results[0].content).toContain("Deeply nested content");
    });
  });

  it("should handle errors gracefully", async () => {
    const config: ScraperConfig = {
      url: "https://invalid-url",
      library: "test",
      version: "1.0.0",
      maxPages: 1,
      maxDepth: 0,
    };

    vi.mocked(scrapeIt).mockRejectedValue(new Error("Scrape failed"));
    vi.spyOn(scraper, "scrapeWithRetry").mockRejectedValue(
      new Error("Scrape failed")
    );

    await expect(scraper.scrape(config)).rejects.toThrowError("Scrape failed");
  });
});

describe("Subpage handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should only scrape subpages by default", async () => {
    const mockScrapeIt = vi.mocked(scrapeIt).mockResolvedValue({
      data: {
        title: "Test Page",
        content: "<h1>Test</h1>",
        links: [
          { url: "https://docs.example.com/guide/page1" },
          { url: "https://docs.example.com/api/other" },
          { url: "https://docs.example.com/guide/subdir/page2" },
        ],
      },
      status: 200,
      statusText: "OK",
      $: {},
      body: "<html><body><h1>Test</h1></body></html>",
    });

    const config: ScraperConfig = {
      url: "https://docs.example.com/guide/",
      library: "test",
      version: "1.0.0",
      maxPages: 10,
      maxDepth: 2,
    };

    await scraper.scrape(config);

    expect(mockScrapeIt).toHaveBeenCalledWith(
      "https://docs.example.com/guide/",
      expect.anything()
    );
    expect(mockScrapeIt).toHaveBeenCalledWith(
      "https://docs.example.com/guide/page1",
      expect.anything()
    );
    expect(mockScrapeIt).toHaveBeenCalledWith(
      "https://docs.example.com/guide/subdir/page2",
      expect.anything()
    );
    expect(mockScrapeIt).not.toHaveBeenCalledWith(
      "https://docs.example.com/api/other",
      expect.anything()
    );
  });

  it("should scrape all linked pages when subpagesOnly is false", async () => {
    const mockScrapeIt = vi.mocked(scrapeIt).mockResolvedValue({
      data: {
        title: "Test Page",
        content: "<h1>Test</h1>",
        links: [
          { url: "https://docs.example.com/guide/page1" },
          { url: "https://docs.example.com/api/other" },
          { url: "https://docs.example.com/guide/subdir/page2" },
        ],
      },
      status: 200,
      statusText: "OK",
      $: {},
      body: "<html><body><h1>Test</h1></body></html>",
    });

    const config: ScraperConfig = {
      url: "https://docs.example.com/guide/",
      library: "test",
      version: "1.0.0",
      maxPages: 10,
      maxDepth: 2,
      subpagesOnly: false, // Explicitly disable
    };

    await scraper.scrape(config);

    expect(mockScrapeIt).toHaveBeenCalledWith(
      "https://docs.example.com/guide/",
      expect.anything()
    );
    expect(mockScrapeIt).toHaveBeenCalledWith(
      "https://docs.example.com/guide/page1",
      expect.anything()
    );
    expect(mockScrapeIt).toHaveBeenCalledWith(
      "https://docs.example.com/api/other",
      expect.anything()
    );
    expect(mockScrapeIt).toHaveBeenCalledWith(
      "https://docs.example.com/guide/subdir/page2",
      expect.anything()
    );
  });
});
