import { ScraperRegistry, ScraperService } from "../scraper";
import type { ScraperOptions, ScraperProgress } from "../scraper/types";
import type { DocumentManagementService } from "../store";
import { logger } from "../utils/logger";
import { DocumentProcessingError, PipelineStateError } from "./errors";
import type { DocumentPipeline, DocumentPipelineCallbacks } from "./types";

/**
 * Coordinates document processing workflow from scraping to storage.
 * Manages the lifecycle of document processing including scraping, progress tracking,
 * and storage operations. Implements a pipeline pattern with error handling and
 * progress reporting through callbacks, ensuring reliable document processing
 * from source to vector store.
 */
export class DocumentProcessingPipeline implements DocumentPipeline {
  private readonly store: DocumentManagementService;
  private readonly library: string;
  private readonly version: string;
  private callbacks: DocumentPipelineCallbacks = {};
  private isProcessing = false;
  private registry: ScraperRegistry;
  private scraperService: ScraperService;

  constructor(store: DocumentManagementService, library: string, version: string) {
    this.store = store;
    this.library = library;
    this.version = version;
    this.registry = new ScraperRegistry();
    this.scraperService = new ScraperService(this.registry);
  }

  /**
   * Registers callback handlers for pipeline events
   */
  setCallbacks(callbacks: DocumentPipelineCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Initiates document processing pipeline.
   * Coordinates scraping and storage operations with progress tracking
   */
  async process(options: ScraperOptions): Promise<void> {
    if (this.isProcessing) {
      throw new PipelineStateError("Pipeline is already processing");
    }

    this.isProcessing = true;
    try {
      await this.scraperService.scrape(options, (progress: ScraperProgress) =>
        this.handleScrapingProgress(progress),
      );
      logger.info("✅ Pipeline processing complete");
    } catch (error) {
      logger.error(`❌ Pipeline failed: ${error}`);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Gracefully terminates ongoing processing
   */
  async stop(): Promise<void> {
    if (!this.isProcessing) return;
    this.isProcessing = false;
  }

  private async handleScrapingProgress(progress: ScraperProgress): Promise<void> {
    if (!this.isProcessing) return;

    // Process document if present
    if (!progress.document) return;

    try {
      await this.store.addDocument(this.library, this.version, {
        pageContent: progress.document.content,
        metadata: progress.document.metadata,
      });

      // Report page progress
      if (this.callbacks.onProgress) {
        await this.callbacks.onProgress(progress);
      }
    } catch (error) {
      if (this.callbacks.onError) {
        await this.callbacks.onError(
          error instanceof Error
            ? new DocumentProcessingError(
                error.message,
                progress.document.metadata.url,
                error,
              )
            : new DocumentProcessingError(String(error), progress.document.metadata.url),
          progress.document,
        );
      }
      logger.error(
        `❌ Failed to process document ${progress.document.metadata.url}: ${error}`,
      );
    }
  }
}
