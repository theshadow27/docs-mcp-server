import { describe, expect, it, vi } from "vitest";
import type { ProgressCallback } from "../../types";
import { ScrapeMode, type ScraperOptions, type ScraperProgress } from "../types";
import { GitHubScraperStrategy } from "./GitHubScraperStrategy";

// Mock dependencies
vi.mock("./WebScraperStrategy");
vi.mock("./GitHubMarkdownStrategy");

describe("GitHubScraperStrategy", () => {
  let strategy: GitHubScraperStrategy;
  let mockProgressCallback: ProgressCallback<ScraperProgress>;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new GitHubScraperStrategy();
    mockProgressCallback = vi.fn();
  });

  describe("canHandle", () => {
    it("should return true for GitHub URLs", () => {
      expect(strategy.canHandle("https://github.com/owner/repo")).toBe(true);
      expect(strategy.canHandle("https://www.github.com/owner/repo")).toBe(true);
      expect(strategy.canHandle("https://github.com/owner/repo/tree/main")).toBe(true);
    });

    it("should return false for non-GitHub URLs", () => {
      expect(strategy.canHandle("https://gitlab.com/owner/repo")).toBe(false);
      expect(strategy.canHandle("https://example.com")).toBe(false);
    });
  });

  describe("scrape", () => {
    it("should use markdown strategy when scrapeMode is github-markdown", async () => {
      const options: ScraperOptions = {
        url: "https://github.com/owner/repo",
        library: "test-lib",
        version: "1.0.0",
        scrapeMode: ScrapeMode.GitHubMarkdown,
      };

      const mockMarkdownStrategy = (strategy as unknown as { markdownStrategy: any })
        .markdownStrategy;
      mockMarkdownStrategy.scrape = vi.fn().mockResolvedValue(undefined);

      const mockDefaultStrategy = (strategy as unknown as { defaultStrategy: any })
        .defaultStrategy;
      mockDefaultStrategy.scrape = vi.fn().mockResolvedValue(undefined);

      await strategy.scrape(options, mockProgressCallback);

      expect(mockMarkdownStrategy.scrape).toHaveBeenCalledWith(
        options,
        mockProgressCallback,
        undefined,
      );
      expect(mockDefaultStrategy.scrape).not.toHaveBeenCalled();
    });

    it("should use default strategy for other scrape modes", async () => {
      const testCases = [
        ScrapeMode.Fetch,
        ScrapeMode.Playwright,
        ScrapeMode.Auto,
        undefined,
      ];

      for (const scrapeMode of testCases) {
        vi.clearAllMocks();

        const options: ScraperOptions = {
          url: "https://github.com/owner/repo",
          library: "test-lib",
          version: "1.0.0",
          scrapeMode,
        };

        const mockMarkdownStrategy = (strategy as unknown as { markdownStrategy: any })
          .markdownStrategy;
        mockMarkdownStrategy.scrape = vi.fn().mockResolvedValue(undefined);

        const mockDefaultStrategy = (strategy as unknown as { defaultStrategy: any })
          .defaultStrategy;
        mockDefaultStrategy.scrape = vi.fn().mockResolvedValue(undefined);

        await strategy.scrape(options, mockProgressCallback);

        expect(mockDefaultStrategy.scrape).toHaveBeenCalledWith(
          options,
          mockProgressCallback,
          undefined,
        );
        expect(mockMarkdownStrategy.scrape).not.toHaveBeenCalled();
      }
    });

    it("should throw error for non-GitHub URLs", async () => {
      const options: ScraperOptions = {
        url: "https://example.com",
        library: "test-lib",
        version: "1.0.0",
      };

      await expect(strategy.scrape(options, mockProgressCallback)).rejects.toThrow(
        "URL must be a GitHub URL",
      );
    });

    it("should pass abort signal to the appropriate strategy", async () => {
      const controller = new AbortController();
      const options: ScraperOptions = {
        url: "https://github.com/owner/repo",
        library: "test-lib",
        version: "1.0.0",
        scrapeMode: ScrapeMode.GitHubMarkdown,
        signal: controller.signal,
      };

      const mockMarkdownStrategy = (strategy as unknown as { markdownStrategy: any })
        .markdownStrategy;
      mockMarkdownStrategy.scrape = vi.fn().mockResolvedValue(undefined);

      await strategy.scrape(options, mockProgressCallback, controller.signal);

      expect(mockMarkdownStrategy.scrape).toHaveBeenCalledWith(
        options,
        mockProgressCallback,
        controller.signal,
      );
    });
  });

  describe("getRepoPath", () => {
    it("should extract repository path correctly", () => {
      const strategy = new GitHubScraperStrategy();
      const getRepoPath = (
        strategy as unknown as { getRepoPath: (url: URL) => string }
      ).getRepoPath.bind(strategy);

      expect(getRepoPath(new URL("https://github.com/owner/repo"))).toBe("/owner/repo");
      expect(getRepoPath(new URL("https://github.com/owner/repo/tree/main"))).toBe(
        "/owner/repo",
      );
      expect(
        getRepoPath(new URL("https://github.com/owner/repo/blob/main/README.md")),
      ).toBe("/owner/repo");
      expect(getRepoPath(new URL("https://github.com/owner"))).toBe("");
    });
  });
});
