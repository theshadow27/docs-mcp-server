import type { PipelineManager } from "../pipeline/PipelineManager"; // Import PipelineManager
import { PipelineStateError } from "../pipeline/errors";
import type { PipelineJob, PipelineJobStatus } from "../pipeline/types";

/**
 * Input parameters for the ListJobsTool.
 */
export interface ListJobsInput {
  /** Optional status to filter jobs by. */
  status?: PipelineJobStatus;
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
    this.manager = manager;
  }

  /**
   * Executes the tool to retrieve a list of pipeline jobs.
   * @param input - The input parameters, optionally including a status filter.
   * @returns A promise that resolves with the list of simplified job objects.
   * @throws {PipelineStateError} If the pipeline manager is somehow unavailable (though constructor ensures it).
   */
  async execute(input: ListJobsInput): Promise<{ jobs: Array<Record<string, unknown>> }> {
    // Use the manager instance directly
    const jobs = await this.manager.getJobs(input.status);

    // Transform jobs into simplified objects
    const simplifiedJobs = jobs.map((job: PipelineJob) => ({
      id: job.id,
      library: job.library,
      version: job.version,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      error: job.error?.message ?? null,
    }));

    return { jobs: simplifiedJobs };
  }
}
