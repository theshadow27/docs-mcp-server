// Copyright (c) 2025
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawContent } from "../fetcher/types";
import { ScrapeMode, type ScraperOptions } from "../types";
import { MarkdownPipeline } from "./MarkdownPipeline";

import { MarkdownLinkExtractorMiddleware } from "../middleware/MarkdownLinkExtractorMiddleware";
import { MarkdownMetadataExtractorMiddleware } from "../middleware/MarkdownMetadataExtractorMiddleware";

describe("MarkdownPipeline", () => {
  beforeEach(() => {
    // Set up spies without mock implementations to use real middleware
    vi.spyOn(MarkdownMetadataExtractorMiddleware.prototype, "process");
    vi.spyOn(MarkdownLinkExtractorMiddleware.prototype, "process");
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
      content: Buffer.from("# Header\n\nThis is a test.", "utf-8"),
      mimeType: "text/markdown",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Header\n\nThis is a test.");
  });

  it("process decodes Buffer content with ISO-8859-1 charset", async () => {
    // Create a spy to capture the content before it's processed
    let capturedContent = "";
    const originalProcess = MarkdownMetadataExtractorMiddleware.prototype.process;
    vi.spyOn(
      MarkdownMetadataExtractorMiddleware.prototype,
      "process",
    ).mockImplementationOnce(async function (
      this: MarkdownMetadataExtractorMiddleware,
      ctx,
      next,
    ) {
      capturedContent = ctx.content;
      // Call the original implementation after capturing
      return originalProcess.call(this, ctx, next);
    });

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
  });

  it("process defaults to UTF-8 when charset is not specified", async () => {
    const pipeline = new MarkdownPipeline();
    const raw: RawContent = {
      content: Buffer.from("# Default UTF-8\n\nContent", "utf-8"),
      mimeType: "text/markdown",
      // No charset specified
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe("# Default UTF-8\n\nContent");
  });

  it("process uses string content directly", async () => {
    const pipeline = new MarkdownPipeline();
    const raw: RawContent = {
      content: "# Title\n\nContent with [link](https://example.com)",
      mimeType: "text/markdown",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);
    expect(result.textContent).toBe(
      "# Title\n\nContent with [link](https://example.com)",
    );
    // Note: Link extraction is not implemented yet
  });

  it("process calls middleware in order and aggregates results", async () => {
    const pipeline = new MarkdownPipeline();
    const markdown = `---
title: Test Document
author: Test Author
---

# Heading

This is a paragraph with a [link](https://test.example.com).
`;
    const raw: RawContent = {
      content: markdown,
      mimeType: "text/markdown",
      charset: "utf-8",
      source: "http://test",
    };
    const result = await pipeline.process(raw, {} as ScraperOptions);

    // Verify all middleware was called
    expect(MarkdownMetadataExtractorMiddleware.prototype.process).toHaveBeenCalledTimes(
      1,
    );
    expect(MarkdownLinkExtractorMiddleware.prototype.process).toHaveBeenCalledTimes(1);

    // Verify the result contains the original content
    // Note: Frontmatter extraction and link extraction are not implemented yet
    expect(result.textContent).toBe(markdown);
  });

  it("process collects errors from middleware", async () => {
    // Override with error-generating implementation just for this test
    vi.spyOn(
      MarkdownMetadataExtractorMiddleware.prototype,
      "process",
    ).mockImplementationOnce(async (ctx, next) => {
      ctx.errors.push(new Error("fail"));
      await next();
    });

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

  it("should correctly process markdown through the full middleware stack (E2E with spies)", async () => {
    // Reset call counts for all spies
    vi.clearAllMocks();

    const pipeline = new MarkdownPipeline();

    // Sample markdown with elements for each middleware to process
    const markdown = `---
title: End-to-End Test
description: Testing the full markdown pipeline
---

# Main Heading

This is a paragraph with multiple [links](https://example.com/1) and another [link](https://example.com/2).

## Subheading

More content here.
`;

    const raw: RawContent = {
      content: markdown,
      mimeType: "text/markdown",
      charset: "utf-8",
      source: "http://test.example.com",
    };

    const result = await pipeline.process(raw, {
      url: "http://example.com",
      library: "example",
      version: "",
      scrapeMode: ScrapeMode.Fetch,
    });

    // Verify all middleware was called
    expect(MarkdownMetadataExtractorMiddleware.prototype.process).toHaveBeenCalledTimes(
      1,
    );
    expect(MarkdownLinkExtractorMiddleware.prototype.process).toHaveBeenCalledTimes(1);

    // Verify the result contains the original content
    // Note: Frontmatter extraction and link extraction are not implemented yet
    expect(result.textContent).toBe(markdown);

    // Verify no errors occurred
    expect(result.errors).toHaveLength(0);
  });
});
