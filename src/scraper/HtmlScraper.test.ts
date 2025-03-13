import { HtmlScraper } from "./HtmlScraper";
import { ScraperError } from "../utils/errors";
import scrapeIt, { type ScrapeResult } from "scrape-it";
import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockedFunction,
} from "vitest";

vi.mock("scrape-it", () => ({
  default: vi.fn(),
}));

describe("HtmlScraper", () => {
  let htmlScraper: HtmlScraper;
  let mockedScrapeIt: MockedFunction<typeof scrapeIt>;

  beforeEach(() => {
    htmlScraper = new HtmlScraper();
    mockedScrapeIt = scrapeIt as MockedFunction<typeof scrapeIt>;
  });

  it("should scrape a page successfully", async () => {
    const mockData = {
      title: "Example Title",
      content: "<p>Example Content</p>",
      links: [{ url: "/link1" }, { url: "/link2" }],
    };

    const mockScrapeResult: ScrapeResult<{
      title: string;
      content: string;
      links: { url: string }[];
    }> = {
      data: mockData,
      status: 200,
      statusText: "OK",
      $: () => {},
      body: "",
    };

    mockedScrapeIt.mockResolvedValue(mockScrapeResult);

    const url = "https://example.com";
    const result = await htmlScraper.scrapePage(url);

    expect(result).toBeDefined();
    expect(result.title).toBe(mockData.title);
    expect(result.content).toBe("Example Content");
    expect(result.links).toEqual([
      "https://example.com/link1",
      "https://example.com/link2",
    ]);
  });

  it("should throw an error for an invalid URL", async () => {
    mockedScrapeIt.mockRejectedValue(new Error("Invalid URL"));
    const url = "invalid-url";
    await expect(htmlScraper.scrapePage(url)).rejects.toThrow();
  });

  it("should retry scraping a page and succeed", async () => {
    const mockData = {
      title: "Example Title",
      content: "<p>Example Content</p>",
      links: [{ url: "/link1" }, { url: "/link2" }],
    };

    const mockScrapeResult: ScrapeResult<{
      title: string;
      content: string;
      links: { url: string }[];
    }> = {
      data: mockData,
      status: 200,
      statusText: "OK",
      $: () => {},
      body: "",
    };

    mockedScrapeIt.mockResolvedValue(mockScrapeResult);

    const url = "https://example.com";
    const result = await htmlScraper.scrapePageWithRetry(url);

    expect(result).toBeDefined();
    expect(result.title).toBe(mockData.title);
    expect(result.content).toBe("Example Content");
    expect(result.links).toEqual([
      "https://example.com/link1",
      "https://example.com/link2",
    ]);
  });

  it("should retry scraping a page and eventually throw an error", async () => {
    mockedScrapeIt.mockRejectedValue(
      new ScraperError("Failed to scrape", true)
    );
    const url = "https://example.com/404"; // Assuming this URL returns a 4xx error
    await expect(htmlScraper.scrapePageWithRetry(url)).rejects.toThrowError(
      ScraperError
    );
  });

  it("should retry scraping a page with custom retry options and succeed", async () => {
    const mockData = {
      title: "Example Title",
      content: "<p>Example Content</p>",
      links: [{ url: "/link1" }, { url: "/link2" }],
    };

    const mockScrapeResult: ScrapeResult<{
      title: string;
      content: string;
      links: { url: string }[];
    }> = {
      data: mockData,
      status: 200,
      statusText: "OK",
      $: () => {},
      body: "",
    };

    mockedScrapeIt.mockResolvedValue(mockScrapeResult);

    const url = "https://example.com";
    const retryOptions = { maxRetries: 3, baseDelay: 500 };
    const result = await htmlScraper.scrapePageWithRetry(url, retryOptions);

    expect(result).toBeDefined();
    expect(result.title).toBe(mockData.title);
    expect(result.content).toBe("Example Content");
    expect(result.links).toEqual([
      "https://example.com/link1",
      "https://example.com/link2",
    ]);
  });

  it("should retry scraping a page with custom retry options and eventually throw an error", async () => {
    mockedScrapeIt.mockRejectedValue(
      new ScraperError("Failed to scrape", true)
    );
    const url = "https://example.com/404"; // Assuming this URL returns a 4xx error
    const retryOptions = { maxRetries: 2, baseDelay: 200 };
    await expect(
      htmlScraper.scrapePageWithRetry(url, retryOptions)
    ).rejects.toThrowError(ScraperError);
  });

  it("should throw an error if maxRetries is not a positive integer", async () => {
    const url = "https://example.com";
    const retryOptions = { maxRetries: 0, baseDelay: 500 };
    await expect(
      htmlScraper.scrapePageWithRetry(url, retryOptions)
    ).rejects.toThrowError("maxRetries must be a positive integer");
  });

  it("should throw an error if baseDelay is not a positive number", async () => {
    const url = "https://example.com";
    const retryOptions = { maxRetries: 3, baseDelay: 0 };
    await expect(
      htmlScraper.scrapePageWithRetry(url, retryOptions)
    ).rejects.toThrowError("baseDelay must be a positive number");
  });

  it("should scrape a page successfully with custom selectors", async () => {
    const mockData = {
      title: "Example Title",
      content: "<p>Example Content</p>",
      links: [{ url: "/link1" }, { url: "/link2" }],
    };

    const mockScrapeResult: ScrapeResult<{
      title: string;
      content: string;
      links: { url: string }[];
    }> = {
      data: {
        title: "Example Title",
        content: "<p>Example Content</p>",
        links: [{ url: "/link1" }, { url: "/link2" }],
      },
      status: 200,
      statusText: "OK",
      $: () => {},
      body: "",
    };

    mockedScrapeIt.mockResolvedValue(mockScrapeResult);

    const url = "https://example.com";
    const options = {
      contentSelector: "p",
      linksSelector: "a",
    };
    const htmlScraperWithSelectors = new HtmlScraper(options);
    const result = await htmlScraperWithSelectors.scrapePage(url);

    expect(result).toBeDefined();
    expect(result.title).toBe(mockData.title);
    expect(result.content).toBe("Example Content");
    expect(result.links).toEqual([
      "https://example.com/link1",
      "https://example.com/link2",
    ]);
  });

  it("should remove elements matching defaultSelectorsToRemove", async () => {
    const mockData = {
      title: "Test",
      content: `
        <nav>Navigation content</nav>
        <div class="ads">Advertisement</div>
        <main>
          <p>Main content</p>
        </main>`,
      links: [],
    };

    const mockScrapeResult: ScrapeResult<{
      title: string;
      content: string;
      links: { url: string }[];
    }> = {
      data: mockData,
      status: 200,
      statusText: "OK",
      $: () => {},
      body: "",
    };

    mockedScrapeIt.mockResolvedValue(mockScrapeResult);

    const url = "https://example.com";
    const result = await htmlScraper.scrapePage(url);

    expect(result.content).toBe("Main content");
  });

  it("should preserve content of unknown tags", async () => {
    const mockData = {
      title: "Test",
      content: `
        <div>
          <custom-element>Custom content</custom-element>
        </div>
        <div>
          <another-custom attr="value">More content</another-custom>
        </div>`,
      links: [],
    };

    const mockScrapeResult: ScrapeResult<{
      title: string;
      content: string;
      links: { url: string }[];
    }> = {
      data: mockData,
      status: 200,
      statusText: "OK",
      $: () => {},
      body: "",
    };

    mockedScrapeIt.mockResolvedValue(mockScrapeResult);

    const url = "https://example.com";
    const result = await htmlScraper.scrapePage(url);

    expect(result.content).toBe("Custom content\n\nMore content");
  });

  it("should handle nested elements correctly", async () => {
    const mockData = {
      title: "Test",
      content: `
        <nav>
          <p>Nav text</p>
          <div class="important">Important info</div>
        </nav>
        <main>
          <p>Main content</p>
        </main>`,
      links: [],
    };

    const mockScrapeResult: ScrapeResult<{
      title: string;
      content: string;
      links: { url: string }[];
    }> = {
      data: mockData,
      status: 200,
      statusText: "OK",
      $: () => {},
      body: "",
    };

    mockedScrapeIt.mockResolvedValue(mockScrapeResult);

    const url = "https://example.com";
    const result = await htmlScraper.scrapePage(url);

    expect(result.content).toBe("Main content");
  });
});
