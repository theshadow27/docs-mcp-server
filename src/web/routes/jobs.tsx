import type { FastifyInstance } from "fastify";
import type { JobInfo } from "../../tools/GetJobInfoTool";
import { PipelineJobStatus } from "../../pipeline/types";

const JobItem = ({ job }: { job: JobInfo }) => (
  <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
    <div>
      <p class="text-sm font-medium text-gray-900 dark:text-white">
        <span safe>{job.library}</span> (<span safe>{job.version}</span>)
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Created: <span safe>{new Date(job.createdAt).toLocaleString()}</span>
      </p>
    </div>
    <div class="flex flex-col items-end gap-1">
      <span class="px-2 py-1 text-xs font-medium text-white bg-blue-500 rounded-full">
        {job.status}
      </span>
      {job.error && (
        <span class="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded-full">
          Error
        </span>
      )}
    </div>
  </div>
);

const JobList = ({ jobs }: { jobs: JobInfo[] }) => (
  <div class="space-y-4">
    {jobs.map((job) => (
      <JobItem job={job} />
    ))}
  </div>
);

/**
 * Registers the API routes for job management.
 * @param server - The Fastify instance.
 */
export function registerJobsRoutes(server: FastifyInstance) {
  server.get("/api/jobs", async () => {
    // Placeholder data - replace with actual job fetching logic
    const jobs: JobInfo[] = [
      {
        id: "1",
        library: "react",
        version: "18.2.0",
        status: PipelineJobStatus.RUNNING,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
      },
      {
        id: "2",
        library: "typescript",
        version: "5.0.4",
        status: PipelineJobStatus.QUEUED,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        error: null,
      },
      {
        id: "3",
        library: "fastify",
        version: "4.24.3",
        status: PipelineJobStatus.FAILED,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        error: "Failed to fetch documentation",
      },
    ];

    return <JobList jobs={jobs} />;
  });
}
