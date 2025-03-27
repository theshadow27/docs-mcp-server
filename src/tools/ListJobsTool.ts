import type { PipelineJob, PipelineJobStatus } from "../pipeline/types";
import type { PipelineManager } from "../pipeline/PipelineManager"; // Import PipelineManager
import { PipelineStateError } from "../pipeline/errors";

/**
 * Input parameters for the ListJobsTool.
 */
export interface ListJobsInput {
  /** Optional status to filter jobs by. */
  status?: PipelineJobStatus;
}

/**
 * Output result for the ListJobsTool.
 */
export interface ListJobsResult {
  /** The list of pipeline jobs matching the criteria. */
  jobs: PipelineJob[];
}

/**
 * Tool for listing pipeline jobs managed by the PipelineManager.
 * Allows filtering jobs by their status.
 */
export class ListJobsTool {
  private manager: PipelineManager; // Change property name and type

  /**
   * Creates an instance of ListJobsTool.
   * @param manager The PipelineManager instance.
   */
  constructor(manager: PipelineManager) {
    // Change constructor parameter
    this.manager = manager; // Assign manager
  }

  /**
   * Executes the tool to retrieve a list of pipeline jobs.
   * @param input - The input parameters, optionally including a status filter.
   * @returns A promise that resolves with the list of jobs.
   * @throws {PipelineStateError} If the pipeline manager is somehow unavailable (though constructor ensures it).
   */
  async execute(input: ListJobsInput): Promise<ListJobsResult> {
    // Use the manager instance directly
    const jobs = await this.manager.getJobs(input.status);

    // We might want to sanitize the jobs before returning,
    // e.g., remove internal fields like resolveCompletion/rejectCompletion
    // For now, returning the full object.
    // Add explicit type for 'job' parameter
    const sanitizedJobs = jobs.map((job: PipelineJob) => ({
      ...job,
      // Explicitly remove potentially sensitive or internal fields if needed
      // completionPromise: undefined, // Keep these commented out for now
      // resolveCompletion: undefined,
      // rejectCompletion: undefined,
      // abortController: undefined,
    }));

    return { jobs: sanitizedJobs };
  }
}
