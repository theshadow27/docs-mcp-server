import { PipelineManager } from "../pipeline/PipelineManager";
import { DocumentManagementService } from "../store/DocumentManagementService";
import { logger } from "../utils/logger";

let docService: DocumentManagementService | undefined;
let pipelineManager: PipelineManager | undefined;

/**
 * Initializes the shared services (DocumentManagementService and PipelineManager).
 * This should be called once at the server startup.
 */
export async function initializeServices(): Promise<void> {
  if (docService || pipelineManager) {
    logger.warn("⚠️ Services already initialized.");
    return;
  }

  docService = new DocumentManagementService();
  try {
    await docService.initialize();
    logger.debug("DocumentManagementService initialized.");

    // TODO: Check if concurrency needs to be configurable
    pipelineManager = new PipelineManager(docService);
    await pipelineManager.start();
    logger.debug("PipelineManager initialized and started.");
  } catch (error) {
    logger.error(`❌ Failed to initialize services: ${error}`);
    // Attempt to shut down any services that might have been partially initialized
    await shutdownServices();
    throw error; // Re-throw the error to indicate initialization failure
  }
}

/**
 * Shuts down the shared services.
 * This should be called during server cleanup.
 */
export async function shutdownServices(): Promise<void> {
  if (pipelineManager) {
    await pipelineManager.stop();
    logger.debug("PipelineManager stopped.");
    pipelineManager = undefined;
  }
  if (docService) {
    await docService.shutdown();
    logger.debug("DocumentManagementService shutdown.");
    docService = undefined;
  }
}

/**
 * Gets the initialized DocumentManagementService instance.
 * @returns The DocumentManagementService instance.
 * @throws Error if services have not been initialized.
 */
export function getDocService(): DocumentManagementService {
  if (!docService) {
    throw new Error("DocumentManagementService has not been initialized.");
  }
  return docService;
}

/**
 * Gets the initialized PipelineManager instance.
 * @returns The PipelineManager instance.
 * @throws Error if services have not been initialized.
 */
export function getPipelineManager(): PipelineManager {
  if (!pipelineManager) {
    throw new Error("PipelineManager has not been initialized.");
  }
  return pipelineManager;
}
