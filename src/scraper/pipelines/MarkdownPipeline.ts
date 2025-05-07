import { MimeTypeUtils } from "../../utils/mimeTypeUtils";
import type { RawContent } from "../fetcher/types";
import type { ContentFetcher } from "../fetcher/types";
import { MarkdownLinkExtractorMiddleware } from "../middleware/MarkdownLinkExtractorMiddleware";
import { MarkdownMetadataExtractorMiddleware } from "../middleware/MarkdownMetadataExtractorMiddleware";
import type { ContentProcessorMiddleware, MiddlewareContext } from "../middleware/types";
import type { ScraperOptions } from "../types";
import { convertToString } from "../utils/buffer";
import type { ContentPipeline, ProcessedContent } from "./types";

/**
 * Pipeline for processing Markdown content using middleware.
 */
export class MarkdownPipeline implements ContentPipeline {
  private readonly middleware: ContentProcessorMiddleware[];

  constructor() {
    this.middleware = [
      new MarkdownMetadataExtractorMiddleware(),
      new MarkdownLinkExtractorMiddleware(),
    ];
  }

  canProcess(rawContent: RawContent): boolean {
    if (!rawContent.mimeType) return false;
    return (
      MimeTypeUtils.isMarkdown(rawContent.mimeType) ||
      MimeTypeUtils.isText(rawContent.mimeType)
    );
  }

  async process(
    rawContent: RawContent,
    options: ScraperOptions,
    fetcher?: ContentFetcher,
  ): Promise<ProcessedContent> {
    const contentString = convertToString(rawContent.content, rawContent.charset);

    const context: MiddlewareContext = {
      content: contentString,
      source: rawContent.source,
      metadata: {},
      links: [],
      errors: [],
      options,
      fetcher,
    };

    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      const mw = this.middleware[i];
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

  async close(): Promise<void> {}
}
