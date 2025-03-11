import { describe, it, expect, vi, Mock, Mocked } from "vitest";
import {
  DefaultScraperStrategy,
  type DefaultScraperStrategyOptions,
} from "./DefaultScraperStrategy";
import { HtmlScraper } from "../HtmlScraper";
import type { ScrapeOptions, PageResult } from "../../types";

class MockHtmlScraper extends HtmlScraper {
  scrapePageWithRetry = vi.fn<(url: string) => Promise<PageResult>>();
  scrapePage = vi.fn<(url: string) => Promise<PageResult>>();

  constructor(mockResult: PageResult | Map<string, PageResult>) {
    super();
    if (mockResult instanceof Map) {
      this.scrapePageWithRetry.mockImplementation((url: string) => {
        const result = mockResult.get(url);
        if (result) {
          return Promise.resolve(result);
        }
        return Promise.resolve({
          content: "Default content",
          title: "Default title",
          url: url,
          links: [],
        });
      });
    } else {
      this.scrapePageWithRetry.mockResolvedValue(mockResult);
    }
    this.scrapePage.mockImplementation((url) => this.scrapePageWithRetry(url));
  }
}

describe("DefaultScraperStrategy", () => {
  it("canHandle should always return true", () => {
    expect(DefaultScraperStrategy.canHandle("https://example.com")).toBe(true);
    expect(DefaultScraperStrategy.canHandle("any_string")).toBe(true);
  });

  it("create should create an instance with default options", () => {
    const strategy = DefaultScraperStrategy.create();
    expect(strategy).toBeInstanceOf(DefaultScraperStrategy);
  });

  it("constructor should accept custom options", () => {
    const options: DefaultScraperStrategyOptions = {
      urlNormalizerOptions: { ignoreCase: false },
    };
    const strategy = new DefaultScraperStrategy(options);
    // @ts-expect-error Accessing private property for testing
    expect(strategy.urlNormalizerOptions.ignoreCase).toBe(false);
  });

  describe("URL Normalization", () => {
    it("should normalize URLs with different cases to the same value", async () => {
      const mockPageResult: PageResult = {
        content: "Test content",
        title: "Test Page",
        url: "https://example.com",
        links: [],
      };
      const mockHtmlScraper = new MockHtmlScraper(mockPageResult);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
      });
      const options: ScrapeOptions = {
        url: "https://example.com/TEST",
        library: "test",
        version: "1.0",
        maxPages: 1,
        maxDepth: 1,
      };
      await strategy.scrape(options);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com/TEST"
      );
    });

    it("should normalize URLs with and without trailing slashes to the same value", async () => {
      const mockPageResult: PageResult = {
        content: "Test content",
        title: "Test Page",
        url: "https://example.com/",
        links: [],
      };
      const mockHtmlScraper = new MockHtmlScraper(mockPageResult);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
      });
      const options: ScrapeOptions = {
        url: "https://example.com",
        library: "test",
        version: "1.0",
        maxPages: 1,
        maxDepth: 1,
      };
      await strategy.scrape(options);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com"
      );
    });

    it("should normalize URLs with hash fragments", async () => {
      const mockPageResult: PageResult = {
        content: "Test content",
        title: "Test Page",
        url: "https://example.com#fragment",
        links: [],
      };
      const mockHtmlScraper = new MockHtmlScraper(mockPageResult);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
      });
      const options: ScrapeOptions = {
        url: "https://example.com#fragment",
        library: "test",
        version: "1.0",
        maxPages: 1,
        maxDepth: 1,
      };
      await strategy.scrape(options);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com#fragment"
      );
    });

    it("should normalize URLs with query parameters", async () => {
      const mockPageResult: PageResult = {
        content: "Test content",
        title: "Test Page",
        url: "https://example.com?query=1",
        links: [],
      };
      const mockHtmlScraper = new MockHtmlScraper(mockPageResult);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
        urlNormalizerOptions: { removeQuery: true },
      });
      const options: ScrapeOptions = {
        url: "https://example.com?query=1",
        library: "test",
        version: "1.0",
        maxPages: 1,
        maxDepth: 1,
      };
      await strategy.scrape(options);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com?query=1"
      );
    });
  });

  describe("Page Scraping", () => {
    it("should scrape a single page with no links", async () => {
      const mockPageResult: PageResult = {
        content: "Test content",
        title: "Test Page",
        url: "https://example.com",
        links: [],
      };
      const mockHtmlScraper = new MockHtmlScraper(mockPageResult);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
      });
      const options: ScrapeOptions = {
        url: "https://example.com",
        library: "test",
        version: "1.0",
        maxPages: 1,
        maxDepth: 1,
      };
      await strategy.scrape(options);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledTimes(1);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com"
      );
    });

    it("should respect the maxPages limit", async () => {
      const mockResponses = new Map<string, PageResult>([
        [
          "https://example.com",
          {
            content: "Root content",
            title: "Root",
            url: "https://example.com",
            links: [
              "https://example.com/page1",
              "https://example.com/page2",
              "https://example.com/page3",
            ],
          },
        ],
        [
          "https://example.com/page1",
          {
            content: "Page 1 content",
            title: "Page 1",
            url: "https://example.com/page1",
            links: [],
          },
        ],
        [
          "https://example.com/page2",
          {
            content: "Page 2 content",
            title: "Page 2",
            url: "https://example.com/page2",
            links: [],
          },
        ],
        [
          "https://example.com/page3",
          {
            content: "Page 3 content",
            title: "Page 3",
            url: "https://example.com/page3",
            links: [],
          },
        ],
      ]);

      const mockHtmlScraper = new MockHtmlScraper(mockResponses);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
      });
      const options: ScrapeOptions = {
        url: "https://example.com",
        library: "test",
        version: "1.0",
        maxPages: 2,
        maxDepth: 2, // Allow deep traversal
      };
      await strategy.scrape(options);
      // Should only scrape 2 pages (root + one subpage) even though there are 3 links
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledTimes(2);
    });

    it("should respect the maxDepth limit", async () => {
      const mockResponses = new Map<string, PageResult>([
        [
          "https://example.com",
          {
            content: "Root content",
            title: "Root",
            url: "https://example.com",
            links: ["https://example.com/page1"],
          },
        ],
        [
          "https://example.com/page1",
          {
            content: "Level 1 content",
            title: "Level 1",
            url: "https://example.com/page1",
            links: ["https://example.com/page1/page2"],
          },
        ],
        [
          "https://example.com/page1/page2",
          {
            content: "Level 2 content",
            title: "Level 2",
            url: "https://example.com/page1/page2",
            links: ["https://example.com/page1/page2/page3"],
          },
        ],
      ]);

      const mockHtmlScraper = new MockHtmlScraper(mockResponses);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
      });
      const options: ScrapeOptions = {
        url: "https://example.com",
        library: "test",
        version: "1.0",
        maxPages: 10, // High enough to not be a limiting factor
        maxDepth: 1, // Only allow one level deep
      };
      await strategy.scrape(options);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledTimes(2);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenNthCalledWith(
        1,
        "https://example.com"
      );
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenNthCalledWith(
        2,
        "https://example.com/page1"
      );
    });

    it("should respect the subpagesOnly option", async () => {
      const mockResponses = new Map<string, PageResult>([
        [
          "https://example.com/docs",
          {
            content: "Root content",
            title: "Root",
            url: "https://example.com/docs",
            links: [
              "https://example.com/docs/api", // subpage - should be followed
              "https://example.com/blog", // not a subpage - should be skipped
              "https://example.com/docs/guide", // subpage - should be followed
            ],
          },
        ],
        [
          "https://example.com/docs/api",
          {
            content: "API content",
            title: "API",
            url: "https://example.com/docs/api",
            links: [],
          },
        ],
        [
          "https://example.com/docs/guide",
          {
            content: "Guide content",
            title: "Guide",
            url: "https://example.com/docs/guide",
            links: [],
          },
        ],
      ]);

      const mockHtmlScraper = new MockHtmlScraper(mockResponses);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
      });
      const options: ScrapeOptions = {
        url: "https://example.com/docs",
        library: "test",
        version: "1.0",
        maxPages: 10,
        maxDepth: 1,
        subpagesOnly: true,
      };
      await strategy.scrape(options);

      // Should only scrape root + subpages (blog link should be skipped)
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledTimes(3);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com/docs"
      );
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com/docs/api"
      );
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com/docs/guide"
      );
    });

    it("should call shouldFollowLink function for each link", async () => {
      const mockResponses = new Map<string, PageResult>([
        [
          "https://example.com",
          {
            content: "Root content",
            title: "Root",
            url: "https://example.com",
            links: ["https://example.com/page1", "https://example.com/page2"],
          },
        ],
        [
          "https://example.com/page1",
          {
            content: "Page 1 content",
            title: "Page 1",
            url: "https://example.com/page1",
            links: [],
          },
        ],
      ]);

      const mockHtmlScraper = new MockHtmlScraper(mockResponses);
      const shouldFollowLink = vi
        .fn()
        .mockReturnValueOnce(true) // Allow first link
        .mockReturnValue(false); // Block subsequent links

      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink,
      });
      const options: ScrapeOptions = {
        url: "https://example.com",
        library: "test",
        version: "1.0",
        maxPages: 3,
        maxDepth: 1,
      };
      await strategy.scrape(options);
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledTimes(2); // Root + first link
      expect(shouldFollowLink).toHaveBeenCalledTimes(2);
      expect(shouldFollowLink).toHaveBeenNthCalledWith(
        1,
        new URL("https://example.com"),
        new URL("https://example.com/page1")
      );
      expect(shouldFollowLink).toHaveBeenNthCalledWith(
        2,
        new URL("https://example.com"),
        new URL("https://example.com/page2")
      );
    });

    it("should add links to visited set immediately when queuing them", async () => {
      const mockResponses = new Map<string, PageResult>([
        [
          "https://example.com",
          {
            content: "Root content",
            title: "Root",
            url: "https://example.com",
            links: [
              "https://example.com/page1",
              "https://example.com/page2",
              "https://example.com/page1", // Duplicate link to verify handling
            ],
          },
        ],
        [
          "https://example.com/page1",
          {
            content: "Page 1 content",
            title: "Page 1",
            url: "https://example.com/page1",
            links: [],
          },
        ],
      ]);

      const mockHtmlScraper = new MockHtmlScraper(mockResponses);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
      });

      const options: ScrapeOptions = {
        url: "https://example.com",
        library: "test",
        version: "1.0",
        maxPages: 5,
        maxDepth: 2,
      };

      // Spy on the visited set to verify URLs are added when enqueued
      const visitedAddSpy = vi.spyOn(
        // @ts-expect-error Accessing private property for testing
        strategy.visited,
        "add"
      );

      await strategy.scrape(options);

      // Root URL should be added immediately when queued
      // Using .toHaveBeenNthCalledWith to check each call individually
      expect(visitedAddSpy.mock.calls[0][0]).toBe("https://example.com/");

      // Child URLs should be added when discovered, not when visited
      expect(visitedAddSpy.mock.calls).toContainEqual([
        "https://example.com/page1",
      ]);
      expect(visitedAddSpy.mock.calls).toContainEqual([
        "https://example.com/page2",
      ]);

      // Verify we scraped the correct pages
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com"
      );
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com/page1"
      );
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledWith(
        "https://example.com/page2"
      );

      // Each URL should be scraped only once despite duplicates
      expect(mockHtmlScraper.scrapePageWithRetry).toHaveBeenCalledTimes(3);
    });
  });

  describe("Progress Callback", () => {
    it("should call the progress callback for each page scraped", async () => {
      const mockResponses = new Map<string, PageResult>([
        [
          "https://example.com",
          {
            content: "Root content",
            title: "Root",
            url: "https://example.com/", // Root URL keeps trailing slash
            links: ["https://example.com/page1"],
          },
        ],
        [
          "https://example.com/page1",
          {
            content: "Page 1 content",
            title: "Page 1",
            url: "https://example.com/page1", // Non-root URL has no trailing slash
            links: [],
          },
        ],
      ]);

      const mockHtmlScraper = new MockHtmlScraper(mockResponses);
      const strategy = new DefaultScraperStrategy({
        htmlScraper: mockHtmlScraper,
        shouldFollowLink: () => true,
      });
      const options: ScrapeOptions = {
        url: "https://example.com",
        library: "test",
        version: "1.0",
        maxPages: 2,
        maxDepth: 1,
      };
      const progressCallback = vi.fn();
      await strategy.scrape(options, progressCallback);
      expect(progressCallback).toHaveBeenCalledTimes(2);

      // First callback for root page
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        pagesScraped: 1,
        maxPages: 2,
        currentUrl: "https://example.com/", // Root URL keeps trailing slash
        depth: 0,
        maxDepth: 1,
        document: {
          content: "Root content",
          metadata: {
            url: "https://example.com/",
            title: "Root",
            library: "test",
            version: "1.0",
          },
        },
      });

      // Second callback for subpage
      expect(progressCallback).toHaveBeenNthCalledWith(2, {
        pagesScraped: 2,
        maxPages: 2,
        currentUrl: "https://example.com/page1",
        depth: 1,
        maxDepth: 1,
        document: {
          content: "Page 1 content",
          metadata: {
            url: "https://example.com/page1",
            title: "Page 1",
            library: "test",
            version: "1.0",
          },
        },
      });
    });
  });
});
