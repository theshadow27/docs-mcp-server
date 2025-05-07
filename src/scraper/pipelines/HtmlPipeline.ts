import { TextDecoder } from "node:util";
import { MimeTypeUtils } from "../../utils/mimeTypeUtils";
import type { RawContent } from "../fetcher/types";
import type { ContentFetcher } from "../fetcher/types";
import { HtmlCheerioParserMiddleware } from "../middleware/components/HtmlCheerioParserMiddleware";
import { HtmlLinkExtractorMiddleware } from "../middleware/components/HtmlLinkExtractorMiddleware";
import { HtmlMetadataExtractorMiddleware } from "../middleware/components/HtmlMetadataExtractorMiddleware";
import { HtmlPlaywrightMiddleware } from "../middleware/components/HtmlPlaywrightMiddleware";
import { HtmlToMarkdownMiddleware } from "../middleware/components/HtmlToMarkdownMiddleware";
import type {
  ContentProcessingContext,
  ContentProcessorMiddleware,
} from "../middleware/types";
import type { ScraperOptions } from "../types";
import type { ContentPipeline, ProcessedContent } from "./types";

/**
 * Pipeline for processing HTML content using middleware.
 */
export class HtmlPipeline implements ContentPipeline {
  private readonly playwrightMiddleware: HtmlPlaywrightMiddleware;
  private readonly standardMiddleware: ContentProcessorMiddleware[];

  constructor() {
    this.playwrightMiddleware = new HtmlPlaywrightMiddleware();
    this.standardMiddleware = [
      new HtmlCheerioParserMiddleware(),
      new HtmlMetadataExtractorMiddleware(),
      new HtmlLinkExtractorMiddleware(),
      new HtmlToMarkdownMiddleware(),
    ];
  }

  canProcess(rawContent: RawContent): boolean {
    return MimeTypeUtils.isHtml(rawContent.mimeType);
  }

  async process(
    rawContent: RawContent,
    options: ScraperOptions,
    fetcher?: ContentFetcher,
  ): Promise<ProcessedContent> {
    let contentString: string;

    if (Buffer.isBuffer(rawContent.content)) {
      const decoder = new TextDecoder(rawContent.charset || "utf-8");
      contentString = decoder.decode(rawContent.content);
    } else {
      contentString = rawContent.content;
    }

    const context: ContentProcessingContext = {
      content: contentString,
      contentType: rawContent.mimeType,
      source: rawContent.source,
      metadata: {},
      links: [],
      errors: [],
      options,
      fetcher,
    };

    // Build middleware stack dynamically based on scrapeMode
    let middleware: ContentProcessorMiddleware[] = [...this.standardMiddleware];
    if (options.scrapeMode === "playwright" || options.scrapeMode === "auto") {
      middleware = [this.playwrightMiddleware, ...middleware];
    }

    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      const mw = middleware[i];
      if (!mw) return;
      await mw.process(context, dispatch.bind(null, i + 1));
    };

    try {
      await dispatch(0);
    } catch (error) {
      context.errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    return {
      textContent: typeof context.content === "string" ? context.content : "",
      metadata: context.metadata,
      links: context.links,
      errors: context.errors,
    };
  }

  async close(): Promise<void> {
    await this.playwrightMiddleware.closeBrowser();
  }
}
