import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentProcessingContext } from "../types";
import { HtmlDomParserMiddleware } from "./HtmlDomParserMiddleware";
import { HtmlPlaywrightMiddleware } from "./HtmlPlaywrightMiddleware";
import { HtmlSmartProcessorMiddleware } from "./HtmlSmartProcessorMiddleware";

// Mock the underlying processors
vi.mock("./HtmlDomParserMiddleware");
vi.mock("./HtmlPlaywrightMiddleware");

// Get typed mocks
const MockedHtmlDomParserMiddleware = vi.mocked(HtmlDomParserMiddleware);
const MockedHtmlPlaywrightMiddleware = vi.mocked(HtmlPlaywrightMiddleware);

describe("HtmlSmartProcessorMiddleware", () => {
  const mockNext = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    // Clear mocks before each test to ensure isolation
    MockedHtmlDomParserMiddleware.mockClear();
    MockedHtmlPlaywrightMiddleware.mockClear();
    // Also clear any mocks on the process methods if they were added to prototypes (though we'll avoid that now)
    // It's safer to ensure the instances returned by the mock constructor have their method mocks cleared if necessary,
    // but vi.mock usually handles this. Let's rely on constructor mockClear for now.
    mockNext.mockClear();
  });

  // Helper to create a basic context
  const createContext = (
    scrapeMode?: "fetch" | "playwright" | "auto",
  ): ContentProcessingContext => ({
    content: "<html><body>Test</body></html>",
    contentType: "text/html",
    source: "http://example.com",
    metadata: {},
    links: [],
    errors: [],
    options: {
      url: "http://example.com",
      library: "test-lib",
      version: "1.0.0",
      scrapeMode, // Pass the mode here
    },
  });

  it("should use HtmlDomParserMiddleware when scrapeMode is 'fetch'", async () => {
    const context = createContext("fetch");
    const middleware = new HtmlSmartProcessorMiddleware();

    await middleware.process(context, mockNext);

    // Verify constructor calls happened during middleware instantiation
    expect(MockedHtmlDomParserMiddleware).toHaveBeenCalledTimes(1);
    expect(MockedHtmlPlaywrightMiddleware).toHaveBeenCalledTimes(1);

    // Get the instances created by the constructor
    const domInstance = MockedHtmlDomParserMiddleware.mock.instances[0];
    const playwrightInstance = MockedHtmlPlaywrightMiddleware.mock.instances[0];

    // Check that the correct instance's process method was called
    expect(domInstance.process).toHaveBeenCalledTimes(1);
    expect(domInstance.process).toHaveBeenCalledWith(context, mockNext);
    expect(playwrightInstance.process).not.toHaveBeenCalled();
  });

  it("should use HtmlPlaywrightMiddleware when scrapeMode is 'playwright'", async () => {
    const context = createContext("playwright");
    const middleware = new HtmlSmartProcessorMiddleware();

    await middleware.process(context, mockNext);

    // Verify constructor calls happened during middleware instantiation
    expect(MockedHtmlDomParserMiddleware).toHaveBeenCalledTimes(1);
    expect(MockedHtmlPlaywrightMiddleware).toHaveBeenCalledTimes(1);

    // Get the instances created by the constructor
    const domInstance = MockedHtmlDomParserMiddleware.mock.instances[0];
    const playwrightInstance = MockedHtmlPlaywrightMiddleware.mock.instances[0];

    // Check that the correct instance's process method was called
    expect(playwrightInstance.process).toHaveBeenCalledTimes(1);
    expect(playwrightInstance.process).toHaveBeenCalledWith(context, mockNext);
    expect(domInstance.process).not.toHaveBeenCalled();
  });

  it("should use HtmlPlaywrightMiddleware when scrapeMode is 'auto'", async () => {
    const context = createContext("auto");
    const middleware = new HtmlSmartProcessorMiddleware();

    await middleware.process(context, mockNext);

    // Verify constructor calls happened during middleware instantiation
    expect(MockedHtmlDomParserMiddleware).toHaveBeenCalledTimes(1);
    expect(MockedHtmlPlaywrightMiddleware).toHaveBeenCalledTimes(1);

    // Get the instances created by the constructor
    const domInstance = MockedHtmlDomParserMiddleware.mock.instances[0];
    const playwrightInstance = MockedHtmlPlaywrightMiddleware.mock.instances[0];

    // Check that the correct instance's process method was called
    expect(playwrightInstance.process).toHaveBeenCalledTimes(1);
    expect(playwrightInstance.process).toHaveBeenCalledWith(context, mockNext);
    expect(domInstance.process).not.toHaveBeenCalled();
  });

  it("should default to 'auto' (Playwright) when scrapeMode is undefined", async () => {
    const context = createContext(undefined); // Explicitly undefined
    const middleware = new HtmlSmartProcessorMiddleware();

    await middleware.process(context, mockNext);

    // Verify constructor calls happened during middleware instantiation
    expect(MockedHtmlDomParserMiddleware).toHaveBeenCalledTimes(1);
    expect(MockedHtmlPlaywrightMiddleware).toHaveBeenCalledTimes(1);

    // Get the instances created by the constructor
    const domInstance = MockedHtmlDomParserMiddleware.mock.instances[0];
    const playwrightInstance = MockedHtmlPlaywrightMiddleware.mock.instances[0];

    // Check that the correct instance's process method was called
    expect(playwrightInstance.process).toHaveBeenCalledTimes(1);
    expect(playwrightInstance.process).toHaveBeenCalledWith(context, mockNext);
    expect(domInstance.process).not.toHaveBeenCalled();
  });
});
