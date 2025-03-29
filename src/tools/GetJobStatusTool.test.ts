import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import type { PipelineManager } from "../pipeline/PipelineManager";
import { type PipelineJob, PipelineJobStatus } from "../pipeline/types";
import type { ScraperOptions } from "../scraper/types";
import { GetJobStatusTool } from "./GetJobStatusTool";

// Mock dependencies
vi.mock("../pipeline/PipelineManager");

describe("GetJobStatusTool", () => {
  let mockManagerInstance: Partial<PipelineManager>;
  let getJobStatusTool: GetJobStatusTool;

  const MOCK_JOB_ID_FOUND = "job-found-123";
  const MOCK_JOB_ID_NOT_FOUND = "job-not-found-456";

  const mockJob: PipelineJob = {
    id: MOCK_JOB_ID_FOUND,
    library: "lib-a",
    version: "1.0.0",
    status: PipelineJobStatus.RUNNING,
    createdAt: new Date("2023-01-01T10:00:00Z"),
    startedAt: new Date("2023-01-01T10:05:00Z"),
    options: { library: "lib-a", version: "1.0.0", url: "url1" } as ScraperOptions,
    progress: null,
    error: null,
    finishedAt: null,
    abortController: new AbortController(),
    completionPromise: Promise.resolve(),
    resolveCompletion: () => {},
    rejectCompletion: () => {},
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Define the mock implementation for the manager instance
    mockManagerInstance = {
      // Mock getJob to return the job if ID matches, otherwise undefined
      getJob: vi.fn().mockImplementation(async (jobId: string) => {
        if (jobId === MOCK_JOB_ID_FOUND) {
          return mockJob;
        }
        return undefined; // Simulate job not found
      }),
    };

    // Instantiate the tool with the correctly typed mock instance
    getJobStatusTool = new GetJobStatusTool(mockManagerInstance as PipelineManager);
  });

  it("should call manager.getJob with the provided jobId", async () => {
    await getJobStatusTool.execute({ jobId: MOCK_JOB_ID_FOUND });
    expect(mockManagerInstance.getJob).toHaveBeenCalledWith(MOCK_JOB_ID_FOUND);
  });

  it("should return the job details if the job is found", async () => {
    const result = await getJobStatusTool.execute({ jobId: MOCK_JOB_ID_FOUND });

    expect(result.job).toBeDefined();
    // Check if the returned job matches the mock data structure (checking ID is sufficient)
    expect(result.job?.id).toBe(MOCK_JOB_ID_FOUND);
    // Check if sensitive fields are removed (if sanitization is implemented)
    // expect(result.job?.resolveCompletion).toBeUndefined();
  });

  it("should return null if the job is not found", async () => {
    const result = await getJobStatusTool.execute({ jobId: MOCK_JOB_ID_NOT_FOUND });

    expect(mockManagerInstance.getJob).toHaveBeenCalledWith(MOCK_JOB_ID_NOT_FOUND);
    expect(result.job).toBeNull();
  });
});
