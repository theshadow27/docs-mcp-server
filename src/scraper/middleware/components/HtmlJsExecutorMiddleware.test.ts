import type { DOMWindow } from "jsdom";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { executeJsInSandbox } from "../../utils/sandbox";
import type { SandboxExecutionResult } from "../../utils/sandbox";
import type { ContentProcessingContext } from "../types";
import { HtmlJsExecutorMiddleware } from "./HtmlJsExecutorMiddleware";

// Mock the logger
vi.mock("../../../utils/logger");

// Mock the sandbox utility
vi.mock("../../utils/sandbox");

describe("HtmlJsExecutorMiddleware", () => {
  let mockContext: ContentProcessingContext;
  let mockNext: Mock;
  let mockSandboxResult: SandboxExecutionResult;

  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      source: "http://example.com",
      content: "", // Will be set in tests
      contentType: "text/html",
      metadata: {},
      links: [],
      errors: [],
      options: {
        // Add required ScraperOptions properties
        url: "http://example.com", // Can reuse context.source
        library: "test-lib",
        version: "1.0.0",
        // Add other optional ScraperOptions properties if needed for specific tests
      },
      // dom property might be added by the middleware
    };
    mockNext = vi.fn().mockResolvedValue(undefined);

    // Default mock result for the sandbox
    mockSandboxResult = {
      finalHtml: "<p>Default Final HTML</p>",
      window: { document: { title: "Mock Window" } } as unknown as DOMWindow,
      errors: [],
    };
    (executeJsInSandbox as Mock).mockResolvedValue(mockSandboxResult);
  });

  it("should call executeJsInSandbox for HTML content", async () => {
    mockContext.content = "<p>Initial</p><script></script>";
    const middleware = new HtmlJsExecutorMiddleware();

    await middleware.process(mockContext, mockNext);

    expect(executeJsInSandbox).toHaveBeenCalledOnce();
    expect(executeJsInSandbox).toHaveBeenCalledWith({
      html: "<p>Initial</p><script></script>",
      url: "http://example.com",
    });
  });

  it("should update context.content with finalHtml from sandbox result", async () => {
    mockContext.content = "<p>Initial</p>";
    mockSandboxResult.finalHtml = "<p>Modified HTML</p>";
    (executeJsInSandbox as Mock).mockResolvedValue(mockSandboxResult);
    const middleware = new HtmlJsExecutorMiddleware();

    await middleware.process(mockContext, mockNext);

    expect(mockContext.content).toBe("<p>Modified HTML</p>");
  });

  it("should update context.dom with window from sandbox result", async () => {
    mockContext.content = "<p>Initial</p>";
    const mockWindow = {
      document: { body: {} },
      close: vi.fn(),
    } as unknown as DOMWindow;
    mockSandboxResult.window = mockWindow;
    (executeJsInSandbox as Mock).mockResolvedValue(mockSandboxResult);
    const middleware = new HtmlJsExecutorMiddleware();

    await middleware.process(mockContext, mockNext);

    expect(mockContext.dom).toBe(mockWindow);
  });

  it("should add sandbox errors to context.errors", async () => {
    mockContext.content = "<p>Initial</p>";
    const error1 = new Error("Script error 1");
    const error2 = new Error("Script error 2");
    mockSandboxResult.errors = [error1, error2];
    (executeJsInSandbox as Mock).mockResolvedValue(mockSandboxResult);
    const middleware = new HtmlJsExecutorMiddleware();

    await middleware.process(mockContext, mockNext);

    expect(mockContext.errors).toHaveLength(2);
    expect(mockContext.errors).toContain(error1);
    expect(mockContext.errors).toContain(error2);
  });

  it("should call next after successful processing", async () => {
    mockContext.content = "<p>Initial</p>";
    const middleware = new HtmlJsExecutorMiddleware();

    await middleware.process(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
  });

  it("should skip processing for non-HTML content", async () => {
    mockContext.content = '{"data": "value"}';
    mockContext.contentType = "application/json";
    const middleware = new HtmlJsExecutorMiddleware();

    await middleware.process(mockContext, mockNext);

    expect(executeJsInSandbox).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledOnce();
    expect(mockContext.content).toBe('{"data": "value"}'); // Content unchanged
  });

  it("should handle Buffer content", async () => {
    const initialHtml = "<p>Buffer Content</p>";
    mockContext.content = Buffer.from(initialHtml);
    mockContext.contentType = "text/html; charset=utf-8";
    const middleware = new HtmlJsExecutorMiddleware();

    await middleware.process(mockContext, mockNext);

    expect(executeJsInSandbox).toHaveBeenCalledOnce();
    expect(executeJsInSandbox).toHaveBeenCalledWith({
      html: initialHtml,
      url: "http://example.com",
    });
    expect(mockNext).toHaveBeenCalledOnce();
  });

  it("should handle critical errors during sandbox execution call", async () => {
    mockContext.content = "<p>Initial</p>";
    const criticalError = new Error("Sandbox function failed");
    (executeJsInSandbox as Mock).mockRejectedValue(criticalError);
    const middleware = new HtmlJsExecutorMiddleware();

    await middleware.process(mockContext, mockNext);

    expect(mockContext.errors).toHaveLength(1);
    // Corrected expectation to match the actual wrapped error message format
    expect(mockContext.errors[0].message).toBe(
      "HtmlJsExecutorMiddleware failed for http://example.com: Sandbox function failed",
    );
    expect(mockNext).not.toHaveBeenCalled(); // Should not proceed if middleware itself fails
  });
});
