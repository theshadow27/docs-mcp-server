import * as semver from "semver";
import { DocumentProcessingPipeline } from "../pipeline/DocumentProcessingPipeline";
import type { ScraperProgress } from "../scraper/types";
import type { DocumentManagementService } from "../store/DocumentManagementService";
import type { ProgressResponse } from "../types";
import { logger } from "../utils/logger";

export interface ScrapeToolOptions {
  library: string;
  version?: string | null; // Make version optional
  url: string;
  onProgress?: (response: ProgressResponse) => void;
  options?: {
    maxPages?: number;
    maxDepth?: number;
    maxConcurrency?: number;
    ignoreErrors?: boolean;
  };
}

export interface ScrapeResult {
  pagesScraped: number;
}

/**
 * Tool for scraping and indexing documentation from a URL.
 * Handles initialization of document processing pipeline and progress reporting.
 */
export class ScrapeTool {
  private docService: DocumentManagementService;

  constructor(docService: DocumentManagementService) {
    this.docService = docService;
  }

  async execute(options: ScrapeToolOptions): Promise<ScrapeResult> {
    const { library, version, url, onProgress, options: scraperOptions } = options;

    // Initialize the store
    await this.docService.initialize();

    let internalVersion: string;
    const partialVersionRegex = /^\d+(\.\d+)?$/; // Matches '1' or '1.2'

    if (version === null || version === undefined) {
      // Case 1: Version omitted -> Use empty string
      internalVersion = "";
    } else {
      const validFullVersion = semver.valid(version);
      if (validFullVersion) {
        // Case 2: Valid full semver (e.g., '1.2.3', '1.2.3-beta.1') -> Use it directly
        internalVersion = validFullVersion;
      } else if (partialVersionRegex.test(version)) {
        // Case 3: Potentially partial version ('1', '1.2')
        const coercedVersion = semver.coerce(version);
        if (coercedVersion) {
          // Coercion successful -> Use coerced 'X.Y.Z'
          internalVersion = coercedVersion.version;
        } else {
          // Should not happen if regex matches, but handle defensively
          throw new Error(
            `Invalid version format for scraping: '${version}'. Use 'X.Y.Z', 'X.Y.Z-prerelease', 'X.Y', 'X', or omit.`,
          );
        }
      } else {
        // Case 4: Invalid format (e.g., '1.x', 'latest', 'foo') -> Reject
        throw new Error(
          `Invalid version format for scraping: '${version}'. Use 'X.Y.Z', 'X.Y.Z-prerelease', 'X.Y', 'X', or omit.`,
        );
      }
    }

    // Ensure internalVersion is lowercase for consistency (though semver output is usually normalized)
    internalVersion = internalVersion.toLowerCase();

    // Remove any existing documents for this library/version (using the validated/normalized internal version)
    await this.docService.removeAllDocuments(library, internalVersion);
    logger.info(
      `💾 Using clean store for ${library}@${internalVersion || "[no version]"}`,
    );

    const pipeline = new DocumentProcessingPipeline(
      this.docService,
      library,
      internalVersion, // Pass the normalized internal version
    );
    let pagesScraped = 0;

    const reportProgress = (text: string) => {
      if (onProgress) {
        onProgress({
          content: [{ type: "text", text }],
        });
      }
    };

    pipeline.setCallbacks({
      onProgress: async (progress: ScraperProgress) => {
        reportProgress(
          `🌐 Indexed page ${progress.pagesScraped}/${progress.maxPages}: ${progress.currentUrl}`,
        );
        if (progress.pagesScraped > pagesScraped) {
          pagesScraped = progress.pagesScraped;
        }
      },
      onError: async (error, doc) => {
        reportProgress(
          `❌ Error processing ${doc?.metadata.title ?? "document"}: ${error.message}`,
        );
      },
    });

    // Start processing with config
    await pipeline.process({
      url: url,
      library: library,
      version: internalVersion, // Pass the normalized internal version to the pipeline process
      subpagesOnly: true,
      maxPages: scraperOptions?.maxPages ?? 100,
      maxDepth: scraperOptions?.maxDepth ?? 3,
      maxConcurrency: scraperOptions?.maxConcurrency ?? 3,
      ignoreErrors: scraperOptions?.ignoreErrors ?? true,
    });

    // Return final statistics
    return {
      pagesScraped,
    };
  }
}
