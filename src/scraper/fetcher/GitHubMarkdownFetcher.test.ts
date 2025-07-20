import { describe, expect, it, vi } from "vitest";
import { GitHubMarkdownFetcher } from "./GitHubMarkdownFetcher";

// Mock fetch globally
global.fetch = vi.fn();

describe("GitHubMarkdownFetcher", () => {
  const fetcher = new GitHubMarkdownFetcher();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("canFetch", () => {
    it("should return true for github.com URLs", () => {
      expect(fetcher.canFetch("https://github.com/owner/repo")).toBe(true);
      expect(fetcher.canFetch("https://www.github.com/owner/repo")).toBe(true);
    });

    it("should return false for non-GitHub URLs", () => {
      expect(fetcher.canFetch("https://gitlab.com/owner/repo")).toBe(false);
      expect(fetcher.canFetch("https://example.com")).toBe(false);
    });

    it("should return false for invalid URLs", () => {
      expect(fetcher.canFetch("not-a-url")).toBe(false);
      expect(fetcher.canFetch("")).toBe(false);
    });
  });

  describe("fetch", () => {
    it("should fetch a single markdown file when path is specified", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("# Test Content"),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await fetcher.fetch(
        "https://github.com/owner/repo/blob/main/README.md",
      );

      expect(result).toEqual({
        content: "# Test Content",
        mimeType: "text/markdown",
        charset: "utf-8",
        source: "https://raw.githubusercontent.com/owner/repo/main/README.md",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/owner/repo/main/README.md",
        expect.any(Object),
      );
    });

    it("should fetch all markdown files from repository", async () => {
      // Mock API response for tree
      const treeResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          tree: [
            { path: "README.md", type: "blob" },
            { path: "docs/guide.md", type: "blob" },
            { path: "src/index.js", type: "blob" }, // Not markdown
            { path: "docs", type: "tree" }, // Directory
          ],
        }),
      };

      // Mock responses for markdown files
      const readmeResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("# README"),
      };
      const guideResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("# Guide"),
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(treeResponse) // Tree API call
        .mockResolvedValueOnce(readmeResponse) // README.md
        .mockResolvedValueOnce(guideResponse); // guide.md

      const result = await fetcher.fetch("https://github.com/owner/repo");

      expect(result.mimeType).toBe("text/markdown");
      expect(result.charset).toBe("utf-8");
      expect(result.content).toContain("# owner/repo Documentation");
      expect(result.content).toContain("File: README.md");
      expect(result.content).toContain("# README");
      expect(result.content).toContain("File: docs/guide.md");
      expect(result.content).toContain("# Guide");
    });

    it("should handle GitHub API errors by trying master branch", async () => {
      // First call fails with 404
      const notFoundResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };

      // Second call succeeds with master branch
      const treeResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          tree: [{ path: "README.md", type: "blob" }],
        }),
      };

      const readmeResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("# README"),
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(notFoundResponse) // main branch fails
        .mockResolvedValueOnce(treeResponse) // master branch succeeds
        .mockResolvedValueOnce(readmeResponse); // README.md

      const result = await fetcher.fetch("https://github.com/owner/repo");

      expect(result.content).toContain("# README");
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should throw error for invalid GitHub URL", async () => {
      await expect(fetcher.fetch("https://github.com/invalid")).rejects.toThrow(
        "Invalid GitHub URL",
      );
    });

    it("should include authorization header if provided", async () => {
      const treeResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ tree: [] }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(treeResponse);

      await fetcher.fetch("https://github.com/owner/repo", {
        headers: { Authorization: "token ghp_xxxx" },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "token ghp_xxxx",
          }),
        }),
      );
    });

    it("should handle abort signal", async () => {
      const controller = new AbortController();
      const treeResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ tree: [] }),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(treeResponse);

      await fetcher.fetch("https://github.com/owner/repo", {
        signal: controller.signal,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        }),
      );
    });
  });
});
