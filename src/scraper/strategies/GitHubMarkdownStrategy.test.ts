import { describe, expect, it, vi } from "vitest";
import type { ProgressCallback } from "../../types";
import { ScrapeMode, type ScraperOptions, type ScraperProgress } from "../types";
import { GitHubMarkdownStrategy } from "./GitHubMarkdownStrategy";

// Mock dependencies
vi.mock("../fetcher/GitHubMarkdownFetcher", () => ({
  GitHubMarkdownFetcher: vi.fn().mockImplementation(() => ({
    canFetch: (url: string) => {
      try {
        const parsed = new URL(url);
        return parsed.hostname === "github.com" || parsed.hostname === "www.github.com";
      } catch {
        return false;
      }
    },
    fetch: vi.fn(),
  })),
}));
vi.mock("../pipelines/MarkdownPipeline");
vi.mock("../../utils/logger");

describe("GitHubMarkdownStrategy", () => {
  let strategy: GitHubMarkdownStrategy;
  let mockProgressCallback: ProgressCallback<ScraperProgress>;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new GitHubMarkdownStrategy();
    mockProgressCallback = vi.fn();
  });

  describe("canHandle", () => {
    it("should return true for GitHub URLs", () => {
      expect(strategy.canHandle("https://github.com/owner/repo")).toBe(true);
      expect(strategy.canHandle("https://www.github.com/owner/repo/tree/main")).toBe(
        true,
      );
    });

    it("should return false for non-GitHub URLs", () => {
      expect(strategy.canHandle("https://example.com")).toBe(false);
      expect(strategy.canHandle("https://gitlab.com/owner/repo")).toBe(false);
    });
  });

  describe("scrape", () => {
    it("should fetch and process markdown content from GitHub", async () => {
      const options: ScraperOptions = {
        url: "https://github.com/owner/repo",
        library: "test-lib",
        version: "1.0.0",
        scrapeMode: ScrapeMode.GitHubMarkdown,
      };

      // Mock the fetcher
      const mockFetcher = (strategy as unknown as { markdownFetcher: any })
        .markdownFetcher;
      mockFetcher.fetch = vi.fn().mockResolvedValue({
        content: "# Test Documentation\n\nThis is test content.",
        mimeType: "text/markdown",
        charset: "utf-8",
        source: "https://github.com/owner/repo",
      });

      // Mock the pipeline
      const mockPipeline = (strategy as unknown as { markdownPipeline: any })
        .markdownPipeline;
      mockPipeline.process = vi.fn().mockResolvedValue({
        textContent: "# Test Documentation\n\nThis is test content.",
        metadata: {
          title: "Test Documentation",
        },
        links: [],
        errors: [],
      });
      mockPipeline.close = vi.fn().mockResolvedValue(undefined);

      await strategy.scrape(options, mockProgressCallback);

      // Verify fetcher was called
      expect(mockFetcher.fetch).toHaveBeenCalledWith(
        "https://github.com/owner/repo",
        expect.objectContaining({
          headers: undefined,
          signal: undefined,
        }),
      );

      // Verify pipeline was called
      expect(mockPipeline.process).toHaveBeenCalled();

      // Verify progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();

      // Verify pipeline was closed
      expect(mockPipeline.close).toHaveBeenCalled();
    });

    it("should only process the root URL and ignore other URLs", async () => {
      const options: ScraperOptions = {
        url: "https://github.com/owner/repo",
        library: "test-lib",
        version: "1.0.0",
        scrapeMode: ScrapeMode.GitHubMarkdown,
      };

      // Mock processItem to track calls
      const processItemSpy = vi.spyOn(
        strategy as unknown as { processItem: any },
        "processItem",
      );

      // Mock the fetcher and pipeline
      const mockFetcher = (strategy as unknown as { markdownFetcher: any })
        .markdownFetcher;
      mockFetcher.fetch = vi.fn().mockResolvedValue({
        content: "# Test",
        mimeType: "text/markdown",
        charset: "utf-8",
        source: "https://github.com/owner/repo",
      });

      const mockPipeline = (strategy as unknown as { markdownPipeline: any })
        .markdownPipeline;
      mockPipeline.process = vi.fn().mockResolvedValue({
        textContent: "# Test",
        metadata: { title: "Test" },
        links: ["https://github.com/owner/repo/blob/main/docs.md"], // This link should be ignored
        errors: [],
      });
      mockPipeline.close = vi.fn();

      await strategy.scrape(options, mockProgressCallback);

      // Should only process the root URL
      expect(processItemSpy).toHaveBeenCalledTimes(1);
      expect(processItemSpy).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://github.com/owner/repo" }),
        expect.any(Object),
        undefined,
        undefined,
      );
    });

    it("should handle custom headers", async () => {
      const options: ScraperOptions = {
        url: "https://github.com/owner/private-repo",
        library: "private-lib",
        version: "1.0.0",
        scrapeMode: ScrapeMode.GitHubMarkdown,
        headers: {
          Authorization: "token ghp_xxxxx",
        },
      };

      const mockFetcher = (strategy as unknown as { markdownFetcher: any })
        .markdownFetcher;
      mockFetcher.fetch = vi.fn().mockResolvedValue({
        content: "# Private Repo",
        mimeType: "text/markdown",
        charset: "utf-8",
        source: "https://github.com/owner/private-repo",
      });

      const mockPipeline = (strategy as unknown as { markdownPipeline: any })
        .markdownPipeline;
      mockPipeline.process = vi.fn().mockResolvedValue({
        textContent: "# Private Repo",
        metadata: { title: "Private Repo" },
        links: [],
        errors: [],
      });
      mockPipeline.close = vi.fn();

      await strategy.scrape(options, mockProgressCallback);

      expect(mockFetcher.fetch).toHaveBeenCalledWith(
        "https://github.com/owner/private-repo",
        expect.objectContaining({
          headers: {
            Authorization: "token ghp_xxxxx",
          },
        }),
      );
    });

    it("should handle abort signal", async () => {
      const controller = new AbortController();
      const options: ScraperOptions = {
        url: "https://github.com/owner/repo",
        library: "test-lib",
        version: "1.0.0",
        scrapeMode: ScrapeMode.GitHubMarkdown,
        signal: controller.signal,
      };

      const mockFetcher = (strategy as unknown as { markdownFetcher: any })
        .markdownFetcher;
      mockFetcher.fetch = vi.fn().mockResolvedValue({
        content: "# Test",
        mimeType: "text/markdown",
        charset: "utf-8",
        source: "https://github.com/owner/repo",
      });

      const mockPipeline = (strategy as unknown as { markdownPipeline: any })
        .markdownPipeline;
      mockPipeline.process = vi.fn().mockResolvedValue({
        textContent: "# Test",
        metadata: { title: "Test" },
        links: [],
        errors: [],
      });
      mockPipeline.close = vi.fn();

      await strategy.scrape(options, mockProgressCallback, controller.signal);

      expect(mockFetcher.fetch).toHaveBeenCalledWith(
        "https://github.com/owner/repo",
        expect.objectContaining({
          signal: controller.signal,
        }),
      );
    });
  });
});
