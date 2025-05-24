import { promises as fs } from "node:fs";
import * as path from "node:path";
import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScraperError } from "../../utils/errors";
import { FileFetcher } from "./FileFetcher";

vi.mock("node:fs/promises", () => ({ default: vol.promises }));
vi.mock("../../utils/logger");

describe("FileFetcher", () => {
  beforeEach(() => {
    vol.reset();
  });

  it("should fetch file content successfully", async () => {
    const fetcher = new FileFetcher();
    const mockContent = "Hello, world!";

    // Create a virtual file system
    vol.fromJSON({
      "/path/to/file.txt": mockContent,
    });

    const result = await fetcher.fetch("file:///path/to/file.txt");
    expect(result.content.toString()).toBe(mockContent);
    expect(result.mimeType).toBe("text/plain");
    expect(result.source).toBe("file:///path/to/file.txt");
    expect(result.encoding).toBe("utf-8");
  });

  it("should handle different file types", async () => {
    const fetcher = new FileFetcher();
    const mockContent = "<h1>Hello</h1>";

    // Create a virtual file system
    vol.fromJSON({
      "/path/to/file.html": mockContent,
    });

    const result = await fetcher.fetch("file:///path/to/file.html");
    expect(result.mimeType).toBe("text/html");
  });

  it("should throw error if file does not exist", async () => {
    const fetcher = new FileFetcher();

    await expect(fetcher.fetch("file:///path/to/file.txt")).rejects.toThrow(ScraperError);
  });

  it("should only handle file protocol", async () => {
    const fetcher = new FileFetcher();
    expect(fetcher.canFetch("https://example.com")).toBe(false);
    expect(fetcher.canFetch("file:///path/to/file.txt")).toBe(true);
  });

  it("returns application/octet-stream for files with null bytes (binary)", async () => {
    const fetcher = new FileFetcher();
    // Use memfs for the binary file
    const buf = Buffer.from([0x41, 0x00, 0x42, 0x43]); // 'A\0BC'
    vol.fromJSON({
      "/binary.bin": buf,
    });
    const result = await fetcher.fetch("file:///binary.bin");
    expect(result.mimeType).toBe("application/octet-stream");
  });

  it("does not process unsupported/binary files (e.g., images)", async () => {
    const fetcher = new FileFetcher();
    // Simulate a directory with a supported text file and an unsupported image file
    const mockText = "Hello, supported!";
    const mockImage = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
    vol.fromJSON({
      "/docs/readme.md": mockText,
      "/docs/image.png": mockImage,
    });
    // Only fetch the markdown file, not the image
    const result = await fetcher.fetch("file:///docs/readme.md");
    expect(result.mimeType).toBe("text/markdown");
    // Try to fetch the image: should be detected as binary
    const imageResult = await fetcher.fetch("file:///docs/image.png");
    expect(imageResult.mimeType).toBe("application/octet-stream");
  });
});
