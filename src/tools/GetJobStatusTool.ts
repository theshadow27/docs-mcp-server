import type { PipelineJob } from "../pipeline/types";
import type { PipelineManager } from "../pipeline/PipelineManager";
import { PipelineStateError } from "../pipeline/errors";

/**
 * Input parameters for the GetJobStatusTool.
 */
export interface GetJobStatusInput {
  /** The ID of the job to retrieve status for. */
  jobId: string;
}

/**
 * Output result for the GetJobStatusTool.
 * Returns the job details or null if not found.
 */
export interface GetJobStatusResult {
  /** The pipeline job details, or null if the job ID was not found. */
  job: PipelineJob | null;
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
   * @returns A promise that resolves with the job details or null if not found.
   */
  async execute(input: GetJobStatusInput): Promise<GetJobStatusResult> {
    const job = await this.manager.getJob(input.jobId);

    if (!job) {
      // Return null in the result if job not found, rather than throwing
      return { job: null };
    }

    // Sanitize the job object similar to ListJobsTool
    const sanitizedJob: PipelineJob = {
      ...job,
      // Explicitly remove potentially sensitive or internal fields if needed
      // completionPromise: undefined,
      // resolveCompletion: undefined,
      // rejectCompletion: undefined,
      // abortController: undefined,
    };

    return { job: sanitizedJob };
  }
}
