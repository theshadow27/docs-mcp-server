import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScraperOptions } from "../types";
import { LocalFileStrategy } from "./LocalFileStrategy";
vi.mock("node:fs/promises", () => ({ default: vol.promises }));
vi.mock("../../utils/logger");
vi.mock("node:fs");

describe("LocalFileStrategy", () => {
  beforeEach(() => {
    vol.reset();
  });

  it("should handle file:// URLs", () => {
    const strategy = new LocalFileStrategy();
    expect(strategy.canHandle("file:///path/to/file.txt")).toBe(true);
    expect(strategy.canHandle("https://example.com")).toBe(false);
  });

  it("should process a single file", async () => {
    const strategy = new LocalFileStrategy();
    const options: ScraperOptions = {
      url: "file:///test.md",
      library: "test",
      version: "1.0",
      maxPages: 1,
      maxDepth: 0,
    };
    const progressCallback = vi.fn();

    vol.fromJSON(
      {
        "/test.md": "# Test\n\nThis is a test file.",
      },
      "/",
    );

    await strategy.scrape(options, progressCallback);

    expect(progressCallback).toHaveBeenCalledTimes(1);
    expect(progressCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        pagesScraped: 1,
        currentUrl: "file:///test.md",
        depth: 0,
        maxDepth: 0,
        maxPages: 1,
        document: {
          content: "# Test\n\nThis is a test file.",
          metadata: {
            url: "file:///test.md",
            title: "Test",
            library: "test",
            version: "1.0",
          },
        },
      }),
    );
  });

  it("should process a directory with files and a subdirectory", async () => {
    const strategy = new LocalFileStrategy();
    const options: ScraperOptions = {
      url: "file:///testdir",
      library: "test",
      version: "1.0",
      maxPages: 10,
      maxDepth: 2,
    };
    const progressCallback = vi.fn();

    vol.fromJSON(
      {
        "/testdir/file1.md": "# File 1",
        "/testdir/file2.html":
          "<html><head><title>File 2 Title</title></head><body><h1>File 2</h1></body></html>",
        "/testdir/subdir/file3.txt": "File 3",
      },
      "/",
    );

    await strategy.scrape(options, progressCallback);
    // Should process file1.md, file2.html, and file3.txt (in subdir, depth=2)
    expect(progressCallback).toHaveBeenCalledTimes(3);
  });

  it("should process different file types correctly", async () => {
    const strategy = new LocalFileStrategy();
    const options: ScraperOptions = {
      url: "file:///testdir",
      library: "test",
      version: "1.0",
      maxPages: 10,
      maxDepth: 1,
      maxConcurrency: 1,
    };
    const progressCallback = vi.fn();
    vol.fromJSON(
      {
        "/testdir/file1.md": "# File 1",
        "/testdir/file2.html":
          "<html><head><title>File 2 Title</title></head><body><h1>File 2</h1></body></html>",
        "/testdir/file3.txt": "File 3",
      },
      "/",
    );

    await strategy.scrape(options, progressCallback);
    // All 3 files are processed: file1.md, file2.html, and file3.txt (as markdown)
    expect(progressCallback).toHaveBeenCalledTimes(3);

    // Validate .md
    expect(progressCallback).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pagesScraped: 1,
        currentUrl: "file:///testdir/file1.md",
        depth: 1,
        maxDepth: 1,
        maxPages: 10,
        document: expect.objectContaining({
          content: "# File 1",
          metadata: expect.objectContaining({
            url: "file:///testdir/file1.md",
            title: "File 1",
            library: "test",
            version: "1.0",
          }),
        }),
      }),
    );
    // Validate .html
    expect(progressCallback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pagesScraped: 2,
        currentUrl: "file:///testdir/file2.html",
        depth: 1,
        maxDepth: 1,
        maxPages: 10,
        document: expect.objectContaining({
          content: expect.stringContaining("# File 2"),
          metadata: expect.objectContaining({
            url: "file:///testdir/file2.html",
            title: "File 2 Title",
            library: "test",
            version: "1.0",
          }),
        }),
      }),
    );
    // Validate .txt
    expect(progressCallback).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        pagesScraped: 3,
        currentUrl: "file:///testdir/file3.txt",
        depth: 1,
        maxDepth: 1,
        maxPages: 10,
        document: expect.objectContaining({
          content: "File 3",
          metadata: expect.objectContaining({
            url: "file:///testdir/file3.txt",
            title: "Untitled",
            library: "test",
            version: "1.0",
          }),
        }),
      }),
    );
  });

  it("should handle empty files", async () => {
    const strategy = new LocalFileStrategy();
    const options: ScraperOptions = {
      url: "file:///testdir",
      library: "test",
      version: "1.0",
      maxPages: 10,
      maxDepth: 1,
      maxConcurrency: 1,
    };
    const progressCallback = vi.fn();
    vol.fromJSON(
      {
        "/testdir/empty.md": "",
      },
      "/",
    );

    await strategy.scrape(options, progressCallback);

    expect(progressCallback).toHaveBeenCalledTimes(1);
    expect(progressCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        pagesScraped: 1,
        currentUrl: "file:///testdir/empty.md",
        document: expect.objectContaining({
          content: "",
          metadata: expect.objectContaining({
            title: "Untitled",
            url: "file:///testdir/empty.md",
            library: "test",
            version: "1.0",
          }),
        }),
      }),
    );
  });

  it("should skip binary/unsupported files and only process supported text files", async () => {
    const strategy = new LocalFileStrategy();
    const options: ScraperOptions = {
      url: "file:///testdir",
      library: "test",
      version: "1.0",
      maxPages: 10,
      maxDepth: 1,
      maxConcurrency: 1,
    };
    const progressCallback = vi.fn();
    // Simulate a binary file (with null bytes) and an image file
    vol.fromJSON(
      {
        "/testdir/file1.md": "# File 1", // supported
        "/testdir/file2.png": Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
        ]).toString("binary"), // PNG signature + null bytes
        "/testdir/file3.txt": "File 3", // supported
        "/testdir/file4.bin": Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00]).toString(
          "binary",
        ), // binary with null bytes
        "/testdir/file5.html": "<html><body>File 5</body></html>", // supported
      },
      "/",
    );

    await strategy.scrape(options, progressCallback);
    // Only .md, .txt, and .html should be processed
    expect(progressCallback).toHaveBeenCalledTimes(3);
    const calledUrls = progressCallback.mock.calls.map((call) => call[0].currentUrl);
    expect(calledUrls).toContain("file:///testdir/file1.md");
    expect(calledUrls).toContain("file:///testdir/file3.txt");
    expect(calledUrls).toContain("file:///testdir/file5.html");
    // Should NOT process binary/image files
    expect(calledUrls).not.toContain("file:///testdir/file2.png");
    expect(calledUrls).not.toContain("file:///testdir/file4.bin");
  });
});
