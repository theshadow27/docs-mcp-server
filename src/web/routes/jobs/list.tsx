import type { FastifyInstance } from "fastify";
import type { JobInfo } from "../../../tools/GetJobInfoTool"; // Adjusted import path
import type { ListJobsTool } from "../../../tools/ListJobsTool"; // Adjusted import path
import { PipelineJobStatus } from "../../../pipeline/types"; // Adjusted import path

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
    {jobs.length === 0 ? (
      <p class="text-center text-gray-500 dark:text-gray-400">
        No pending jobs.
      </p>
    ) : (
      jobs.map((job) => <JobItem job={job} />)
    )}
  </div>
);

/**
 * Registers the API route for listing jobs.
 * @param server - The Fastify instance.
 * @param listJobsTool - The tool instance for listing jobs.
 */
export function registerJobListRoutes(
  server: FastifyInstance,
  listJobsTool: ListJobsTool
) {
  // GET /api/jobs - List current jobs (only the list)
  server.get("/api/jobs", async () => {
    const result = await listJobsTool.execute({});
    return <JobList jobs={result.jobs} />;
  });
}
