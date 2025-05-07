// Copyright (c) 2025
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import type { RawContent } from "../fetcher/types";
import type { ScraperOptions } from "../types";
import { MarkdownPipeline } from "./MarkdownPipeline";

// Mock middleware
vi.mock("../middleware/MarkdownMetadataExtractorMiddleware");
vi.mock("../middleware/MarkdownLinkExtractorMiddleware");

import { MarkdownLinkExtractorMiddleware } from "../middleware/MarkdownLinkExtractorMiddleware";
import { MarkdownMetadataExtractorMiddleware } from "../middleware/MarkdownMetadataExtractorMiddleware";

describe("MarkdownPipeline", () => {
  let mockMetadataProcess: Mock;
  let mockLinkProcess: Mock;

  beforeEach(() => {
    mockMetadataProcess = vi.fn(async (ctx, next) => {
      ctx.metadata.title = "Test Title";
      await next();
    });
    (MarkdownMetadataExtractorMiddleware.prototype.process as Mock) = mockMetadataProcess;

    mockLinkProcess = vi.fn(async (ctx, next) => {
      ctx.links.push("https://link.test/");
      await next();
    });
    (MarkdownLinkExtractorMiddleware.prototype.process as Mock) = mockLinkProcess;
  });

  it("canProcess returns true for text/markdown", () => {
    const pipeline = new MarkdownPipeline();
    expect(pipeline.canProcess({ mimeType: "text/markdown" } as RawContent)).toBe(true);
    expect(pipeline.canProcess({ mimeType: "text/x-markdown" } as RawContent)).toBe(true);
  });

  // MarkdownPipeline now processes all text/* types as markdown, including text/html.
  it("canProcess returns false for non-text types", () => {
    const pipeline = new MarkdownPipeline();
    expect(pipeline.canProcess({ mimeType: "application/json" } as RawContent)).toBe(
      false,
    );
    // @ts-expect-error
    expect(pipeline.canProcess({ mimeType: undefined } as RawContent)).toBe(false);
  });

  it("process decodes Buffer content with UTF-8 charset", async () => {
    const pipeline = new MarkdownPipeline();
    const raw: RawContent = {
      content: Buffer.from("# Header", "utf-8"),
      mimeType: "text/markdown",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Header");
  });

  it("process decodes Buffer content with ISO-8859-1 charset", async () => {
    // Save the original implementation
    const originalMetadataProcess = mockMetadataProcess;

    // Replace with a version that captures the content before calling next
    let capturedContent = "";
    mockMetadataProcess = vi.fn(async (ctx, next) => {
      capturedContent = ctx.content;
      ctx.metadata.title = "Test Title";
      await next();
    });
    (MarkdownMetadataExtractorMiddleware.prototype.process as Mock) = mockMetadataProcess;

    const pipeline = new MarkdownPipeline();
    // Create a buffer with ISO-8859-1 encoding (Latin-1)
    // This contains characters that would be encoded differently in UTF-8
    const markdownWithSpecialChars = "# Café";
    const raw: RawContent = {
      content: Buffer.from(markdownWithSpecialChars, "latin1"),
      mimeType: "text/markdown",
      charset: "iso-8859-1", // Explicitly set charset to ISO-8859-1
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Café");

    // Verify the content was properly decoded
    expect(capturedContent).toBe("# Café");

    // Restore the original implementation for other tests
    mockMetadataProcess = originalMetadataProcess;
    (MarkdownMetadataExtractorMiddleware.prototype.process as Mock) = mockMetadataProcess;
  });

  it("process defaults to UTF-8 when charset is not specified", async () => {
    const pipeline = new MarkdownPipeline();
    const raw: RawContent = {
      content: Buffer.from("# Default UTF-8", "utf-8"),
      mimeType: "text/markdown",
      // No charset specified
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Default UTF-8");
  });

  it("process uses string content directly", async () => {
    const pipeline = new MarkdownPipeline();
    const raw: RawContent = {
      content: "# Title",
      mimeType: "text/markdown",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Title");
  });

  it("process calls middleware in order and aggregates results", async () => {
    const pipeline = new MarkdownPipeline();
    const raw: RawContent = {
      content: "# Title",
      mimeType: "text/markdown",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(mockMetadataProcess).toHaveBeenCalledTimes(1);
    expect(mockLinkProcess).toHaveBeenCalledTimes(1);
    expect(result.metadata.title).toBe("Test Title");
    expect(result.links).toContain("https://link.test/");
  });

  it("process collects errors from middleware", async () => {
    mockMetadataProcess = vi.fn(async (ctx, next) => {
      ctx.errors.push(new Error("fail"));
      await next();
    });
    (MarkdownMetadataExtractorMiddleware.prototype.process as Mock) = mockMetadataProcess;

    const pipeline = new MarkdownPipeline();
    const raw: RawContent = {
      content: "# Title",
      mimeType: "text/markdown",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.errors.some((e) => e.message === "fail")).toBe(true);
  });
});
