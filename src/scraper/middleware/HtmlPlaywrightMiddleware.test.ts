import { type MockedObject, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { ScraperOptions } from "../types";
import { HtmlPlaywrightMiddleware } from "./HtmlPlaywrightMiddleware";
import type { MiddlewareContext } from "./types"; // Adjusted path

// Suppress logger output during tests
vi.mock("../../../utils/logger");

// Mock playwright and jsdom using factory functions
vi.mock("playwright", async (importOriginal) =>
  importOriginal<typeof import("playwright")>(),
);

// Mock playwright and jsdom using factory functions
vi.mock("jsdom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jsdom")>();
  return { ...actual };
});

import { type Browser, type Page, chromium } from "playwright";

// Helper to create a minimal valid ScraperOptions object
const createMockScraperOptions = (
  url = "http://example.com",
  excludeSelectors?: string[],
): ScraperOptions => ({
  url,
  library: "test-lib",
  version: "1.0.0",
  maxDepth: 0,
  maxPages: 1,
  maxConcurrency: 1,
  scope: "subpages",
  followRedirects: true,
  excludeSelectors: excludeSelectors || [],
  ignoreErrors: false,
});

// Helper to create a basic context for pipeline tests
const createPipelineTestContext = (
  content: string,
  source = "http://example.com",
  options?: Partial<ScraperOptions>,
): MiddlewareContext => {
  const fullOptions = { ...createMockScraperOptions(source), ...options };
  const context: MiddlewareContext = {
    content,
    source,
    metadata: {},
    links: [],
    errors: [],
    options: fullOptions,
  };
  return context;
};

// --- Tests for HtmlPlaywrightMiddleware ---
// Note: These tests require Playwright and a browser (Chromium) to be installed.
describe("HtmlPlaywrightMiddleware", () => {
  // Use a shared instance for tests to avoid launching browser repeatedly
  const playwrightMiddleware = new HtmlPlaywrightMiddleware();

  afterEach(() => {
    // Reset the browser instance after each test
    // This ensures a clean state for each test
    // @ts-ignore
    playwrightMiddleware.browser?.close();
    // @ts-ignore
    playwrightMiddleware.browser = null;
  });

  // Ensure browser is closed after all tests in this suite
  afterAll(async () => {
    await playwrightMiddleware.closeBrowser();
  });

  it("should render simple HTML and update context.content and context.dom", async () => {
    const initialHtml =
      "<html><head><title>Initial</title></head><body><p>Hello</p><script>document.querySelector('p').textContent = 'Hello Playwright!';</script></body></html>";
    const context = createPipelineTestContext(
      initialHtml,
      // Using a unique domain helps isolate Playwright's network interception
      "https://f8b6e5ad-46ca-5934-bf4d-0409f8375e9a.com/test",
    ); // Set a source URL for the context

    // Create a pipeline with only the Playwright middleware for this test
    // We need to pass the context through the middleware directly, not a pipeline
    const next = vi.fn(); // Mock the next function
    await playwrightMiddleware.process(context, next);

    expect(context.errors).toHaveLength(0);
    // Check if content was updated by Playwright rendering the script's effect
    expect(context.content).toContain("<p>Hello Playwright!</p>");
    // Remove checks for context.dom as this middleware no longer parses
    expect(context.dom).toBeUndefined();
    // Ensure next was called if processing was successful
    expect(next).toHaveBeenCalled();
  });

  it("should handle invalid HTML without throwing unhandled errors and call next", async () => {
    const invalidHtml = "<html><body><p>Mismatched tag</div></html>";
    const context = createPipelineTestContext(
      invalidHtml,
      // Using a unique domain helps isolate Playwright's network interception
      "https://f8b6e5ad-46ca-5934-bf4d-0409f8375e9a.com/test-invalid",
    );
    const next = vi.fn(); // Mock the next function
    await playwrightMiddleware.process(context, next);

    // Playwright/Browser might tolerate some errors, JSDOM might too.
    // We expect the middleware to complete, potentially with errors in the context.
    // We primarily check that *our* middleware code doesn't crash and calls next.
    expect(context.errors.length).toBeGreaterThanOrEqual(0); // Allow for Playwright rendering errors
    // Remove check for context.dom as this middleware no longer parses
    expect(context.dom).toBeUndefined();
    // Ensure next was called even if there were rendering errors
    expect(next).toHaveBeenCalled();
  });

  it("should add error to context if Playwright page.goto fails and call next", async () => {
    const html = "<html><body>Good</body></html>";
    const context = createPipelineTestContext(
      html,
      "https://f8b6e5ad-46ca-5934-bf4d-0409f8375e9a.com/goto-fail",
    );
    const next = vi.fn();

    // Spy on page.goto and make it throw
    const pageSpy = {
      route: vi.fn().mockResolvedValue(undefined),
      unroute: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockRejectedValue(new Error("Simulated navigation failure")),
      content: vi.fn(), // Doesn't matter as goto fails
      close: vi.fn().mockResolvedValue(undefined),
    } as MockedObject<Page>;
    const browserSpy = {
      newPage: vi.fn().mockResolvedValue(pageSpy),
      isConnected: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    } as MockedObject<Browser>;

    // Intercept launch to control the page object
    const launchSpy = vi.spyOn(chromium, "launch").mockResolvedValue(browserSpy);

    await playwrightMiddleware.process(context, next);

    expect(context.errors.length).toBeGreaterThan(0);
    expect(context.errors[0].message).toContain("Simulated navigation failure");
    expect(context.dom).toBeUndefined(); // DOM should not be set
    expect(next).toHaveBeenCalled(); // Next should still be called

    launchSpy.mockRestore(); // Restore the launch spy
  });
});
