import { describe, it, expect } from "vitest";
import { HtmlProcessor } from "./HtmlProcessor";
import type { RawContent } from "../fetcher/types";
import { ScraperError } from "../../utils/errors";

describe("HtmlProcessor", () => {
  it("should process valid HTML content", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        "<html><head><title>Test Title</title></head><body><h1>Hello</h1><p>World</p></body></html>",
      mimeType: "text/html",
      source: "https://example.com",
    };

    const result = await processor.process(rawContent);
    expect(result.title).toBe("Test Title");
    expect(result.content).toContain("# Hello");
    expect(result.content).toContain("World");
    expect(result.source).toBe("https://example.com");
    expect(result.links).toEqual([]); // No links in this example
  });

  it("should extract links", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        '<html><head><title>Test</title></head><body><a href="https://example.com/page1">Page 1</a><a href="/page2">Page 2</a></body></html>',
      mimeType: "text/html",
      source: "https://example.com",
    };
    const result = await processor.process(rawContent);
    expect(result.links).toEqual([
      "https://example.com/page1",
      "https://example.com/page2",
    ]);
  });

  it("should handle relative links correctly", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        '<html><head><title>Test</title></head><body><a href="page1">Page 1</a></body></html>',
      mimeType: "text/html",
      source: "file:///path/to/index.html",
    };
    const result = await processor.process(rawContent);
    expect(result.links).toEqual(["file:///path/to/page1"]);
  });

  it("should remove script and style tags", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content:
        "<html><head><title>Test</title><style>body { color: red; }</style></head><body><script>alert('Hello');</script><h1>Hello</h1></body></html>",
      mimeType: "text/html",
      source: "https://example.com",
    };
    const result = await processor.process(rawContent);
    expect(result.content).not.toContain("body { color: red; }");
    expect(result.content).not.toContain("alert('Hello');");
    expect(result.content).toContain("# Hello");
  });

  it("should throw error for non-HTML content", async () => {
    const processor = new HtmlProcessor();
    const rawContent: RawContent = {
      content: "Hello, world!",
      mimeType: "text/plain",
      source: "https://example.com",
    };
    await expect(processor.process(rawContent)).rejects.toThrow(ScraperError);
  });

  it("should return empty links array if extractLinks is false", async () => {
    const processor = new HtmlProcessor({ extractLinks: false });
    const rawContent: RawContent = {
      content:
        '<html><head><title>Test</title></head><body><a href="https://example.com/page1">Page 1</a></body></html>',
      mimeType: "text/html",
      source: "https://example.com",
    };
    const result = await processor.process(rawContent);
    expect(result.links).toEqual([]);
  });
});
