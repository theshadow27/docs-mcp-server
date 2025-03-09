import { describe, expect, it, vi, beforeEach } from "vitest";
import { GitHubScraperStrategy } from "./github-strategy";
import type { DefaultScraperStrategy } from "./default-strategy";
import type {
  ScraperConfig,
  ScrapingProgressCallback,
  DocContent,
} from "../../types";

describe("GitHubScraperStrategy", () => {
  // Track what URLs were checked
  let checkedUrls: Array<{ baseUrl: URL; targetUrl: URL }> = [];

  // Create mock DefaultScraperStrategy
  const mockScrape = vi.fn(
    (
      config: ScraperConfig,
      progressCallback?: ScrapingProgressCallback,
      shouldFollowLink?: (
        baseUrl: URL,
        targetUrl: URL,
        depth: number
      ) => boolean
    ): Promise<DocContent[]> => {
      // Test each URL pair we want to validate
      for (const { baseUrl, targetUrl } of checkedUrls) {
        shouldFollowLink?.(baseUrl, targetUrl, 0);
      }
      // Return empty result since we're just testing URL validation
      return Promise.resolve([]);
    }
  );

  const mockDefaultStrategy = {
    scrape: mockScrape,
  } as unknown as DefaultScraperStrategy;

  beforeEach(() => {
    // Reset for each test
    checkedUrls = [];
    mockScrape.mockClear();
  });

  const createStrategy = () => {
    const strategy = new GitHubScraperStrategy();
    // Override private field using Object.defineProperty
    Object.defineProperty(strategy, "defaultStrategy", {
      value: mockDefaultStrategy,
      writable: true,
    });
    return strategy;
  };

  const testScrapeWithUrls = async (
    urls: Array<{ baseUrl: string; targetUrl: string }>
  ): Promise<(baseUrl: URL, targetUrl: URL, depth: number) => boolean> => {
    checkedUrls = urls.map(({ baseUrl, targetUrl }) => ({
      baseUrl: new URL(baseUrl),
      targetUrl: new URL(targetUrl),
    }));

    const strategy = createStrategy();
    await strategy.scrape({
      url: checkedUrls[0].baseUrl.toString(),
      library: "test",
      version: "1.0.0",
      maxPages: 10,
      maxDepth: 3,
    });

    expect(mockScrape).toHaveBeenCalled();

    // Return the shouldFollowLink function from the last scrape call
    const shouldFollowLink = mockScrape.mock.calls[0][2];
    if (!shouldFollowLink) {
      throw new Error("shouldFollowLink was not provided to scrape");
    }
    return shouldFollowLink;
  };

  describe("link following behavior", () => {
    it("should follow root README in same repo", async () => {
      const shouldFollowLink = await testScrapeWithUrls([
        {
          baseUrl: "https://github.com/org/repo",
          targetUrl: "https://github.com/org/repo",
        },
      ]);

      expect(
        shouldFollowLink(checkedUrls[0].baseUrl, checkedUrls[0].targetUrl, 0)
      ).toBe(true);
    });

    it("should follow wiki pages in same repo", async () => {
      const shouldFollowLink = await testScrapeWithUrls([
        {
          baseUrl: "https://github.com/org/repo",
          targetUrl: "https://github.com/org/repo/wiki/Home",
        },
        {
          baseUrl: "https://github.com/org/repo/wiki/Home",
          targetUrl: "https://github.com/org/repo/wiki/API",
        },
      ]);

      for (const { baseUrl, targetUrl } of checkedUrls) {
        expect(shouldFollowLink(baseUrl, targetUrl, 0)).toBe(true);
      }
    });

    it("should follow markdown files in same repo", async () => {
      const shouldFollowLink = await testScrapeWithUrls([
        {
          baseUrl: "https://github.com/org/repo",
          targetUrl: "https://github.com/org/repo/blob/main/docs/guide.md",
        },
        {
          baseUrl: "https://github.com/org/repo/blob/main/docs/guide.md",
          targetUrl: "https://github.com/org/repo/blob/main/docs/api.md",
        },
      ]);

      for (const { baseUrl, targetUrl } of checkedUrls) {
        expect(shouldFollowLink(baseUrl, targetUrl, 0)).toBe(true);
      }
    });

    it("should follow links between different doc types", async () => {
      const shouldFollowLink = await testScrapeWithUrls([
        {
          baseUrl: "https://github.com/org/repo",
          targetUrl: "https://github.com/org/repo/wiki/Home",
        },
        {
          baseUrl: "https://github.com/org/repo/wiki/Home",
          targetUrl: "https://github.com/org/repo/blob/main/docs/guide.md",
        },
        {
          baseUrl: "https://github.com/org/repo/blob/main/docs/guide.md",
          targetUrl: "https://github.com/org/repo",
        },
      ]);

      for (const { baseUrl, targetUrl } of checkedUrls) {
        expect(shouldFollowLink(baseUrl, targetUrl, 0)).toBe(true);
      }
    });

    it("should not follow links to different repos", async () => {
      const shouldFollowLink = await testScrapeWithUrls([
        {
          baseUrl: "https://github.com/org1/repo1",
          targetUrl: "https://github.com/org2/repo2",
        },
        {
          baseUrl: "https://github.com/org1/repo1",
          targetUrl: "https://github.com/org2/repo2/wiki",
        },
        {
          baseUrl: "https://github.com/org1/repo1",
          targetUrl: "https://github.com/org2/repo2/blob/main/README.md",
        },
      ]);

      for (const { baseUrl, targetUrl } of checkedUrls) {
        expect(shouldFollowLink(baseUrl, targetUrl, 0)).toBe(false);
      }
    });

    it("should not follow non-documentation files", async () => {
      const shouldFollowLink = await testScrapeWithUrls([
        {
          baseUrl: "https://github.com/org/repo",
          targetUrl: "https://github.com/org/repo/blob/main/src/index.js",
        },
        {
          baseUrl: "https://github.com/org/repo",
          targetUrl: "https://github.com/org/repo/tree/main/src",
        },
        {
          baseUrl: "https://github.com/org/repo",
          targetUrl: "https://github.com/org/repo/raw/main/README.md",
        },
      ]);

      for (const { baseUrl, targetUrl } of checkedUrls) {
        expect(shouldFollowLink(baseUrl, targetUrl, 0)).toBe(false);
      }
    });
  });

  describe("initialization", () => {
    it("should throw error for non-GitHub URLs", async () => {
      const strategy = createStrategy();
      const config: ScraperConfig = {
        url: "https://example.com",
        library: "test",
        version: "1.0.0",
        maxPages: 10,
        maxDepth: 3,
      };

      await expect(strategy.scrape(config)).rejects.toThrow(
        "URL must be a GitHub URL"
      );
    });
  });
});
