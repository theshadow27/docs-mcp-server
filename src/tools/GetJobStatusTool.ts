import type { PipelineManager } from "../pipeline/PipelineManager";
import { PipelineStateError } from "../pipeline/errors";
import type { PipelineJob } from "../pipeline/types";

/**
 * Input parameters for the GetJobStatusTool.
 */
export interface GetJobStatusInput {
  /** The ID of the job to retrieve status for. */
  jobId: string;
}

/**
 * Tool for retrieving the status and details of a specific pipeline job.
 */
export class GetJobStatusTool {
  private manager: PipelineManager;

  /**
   * Creates an instance of GetJobStatusTool.
   * @param manager The PipelineManager instance.
   */
  constructor(manager: PipelineManager) {
    this.manager = manager;
  }

  /**
   * Executes the tool to retrieve the status of a specific job.
   * @param input - The input parameters, containing the jobId.
   * @returns A promise that resolves with the simplified job details or null if not found.
   */
  async execute(
    input: GetJobStatusInput,
  ): Promise<{ job: Record<string, unknown> | null }> {
    const job = await this.manager.getJob(input.jobId);

    if (!job) {
      // Return null in the result if job not found
      return { job: null };
    }

    // Transform the job into a simplified object
    const simplifiedJob = {
      id: job.id,
      library: job.library,
      version: job.version,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      error: job.error?.message ?? null,
    };

    return { job: simplifiedJob };
  }
}
