import { describe, expect, it } from "vitest";
import { ScraperError } from "../../utils/errors";
import type { RawContent } from "../fetcher/types";
import { MarkdownProcessor } from "./MarkdownProcessor";

describe("MarkdownProcessor", () => {
  it("should process valid Markdown content", async () => {
    const processor = new MarkdownProcessor();
    const rawContent: RawContent = {
      content: "# Hello\n\nWorld",
      mimeType: "text/markdown",
      source: "https://example.com/test.md",
    };

    const result = await processor.process(rawContent);
    expect(result.title).toBe("Hello");
    expect(result.content).toBe("# Hello\n\nWorld");
    expect(result.source).toBe("https://example.com/test.md");
    expect(result.links).toEqual([]);
  });

  it("should process plain text as Markdown", async () => {
    const processor = new MarkdownProcessor();
    const rawContent: RawContent = {
      content: "Hello, world!",
      mimeType: "text/plain",
      source: "https://example.com/test.txt",
    };
    const result = await processor.process(rawContent);
    expect(result.title).toBe("Untitled"); // Default title for plain text
    expect(result.content).toBe("Hello, world!");
  });

  it("should extract title from the first H1", async () => {
    const processor = new MarkdownProcessor();
    const rawContent: RawContent = {
      content: "# My Title\n\nSome other content",
      mimeType: "text/markdown",
      source: "file:///path/to/file.md",
    };
    const result = await processor.process(rawContent);
    expect(result.title).toBe("My Title");
  });

  it("should return 'Untitled' if no H1 found", async () => {
    const processor = new MarkdownProcessor();
    const rawContent: RawContent = {
      content: "Some content without a title",
      mimeType: "text/markdown",
      source: "file:///path/to/file.md",
    };
    const result = await processor.process(rawContent);
    expect(result.title).toBe("Untitled");
  });

  it("should throw error for non-Markdown/plain text content", async () => {
    const processor = new MarkdownProcessor();
    const rawContent: RawContent = {
      content: "<html><body><h1>Hello</h1></body></html>",
      mimeType: "text/html",
      source: "https://example.com/test.html",
    };
    await expect(processor.process(rawContent)).rejects.toThrow(ScraperError);
  });

  it("should throw error for empty Markdown content", async () => {
    const processor = new MarkdownProcessor();
    const rawContent: RawContent = {
      content: "",
      mimeType: "text/markdown",
      source: "https://example.com/test.md",
    };
    await expect(processor.process(rawContent)).rejects.toThrow(ScraperError);
  });
});
