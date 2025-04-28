import type { FastifyInstance } from "fastify";
import type { JobInfo } from "../../../tools/GetJobInfoTool"; // Adjusted import path
import type { ListJobsTool } from "../../../tools/ListJobsTool"; // Adjusted import path
import { PipelineJobStatus } from "../../../pipeline/types"; // Adjusted import path
import VersionBadge from "../../components/VersionBadge"; // Import VersionBadge

const JobItem = ({ job }: { job: JobInfo }) => (
  // Use Flowbite Card structure with reduced padding and added border
  <div class="block p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-900 dark:text-white">
          <span safe>{job.library}</span>{" "}
          {/* Display version as badge if exists */}
          <VersionBadge version={job.version} />
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Indexed: <span safe>{new Date(job.createdAt).toLocaleString()}</span>
        </p>
      </div>
      <div class="flex flex-col items-end gap-1">
        {/* Use Flowbite Badge for status with dynamic color */}
        <span
          class={`px-1.5 py-0.5 text-xs font-medium me-2 rounded ${
            job.status === PipelineJobStatus.COMPLETED
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              : job.error
                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
          }`}
        >
          {job.status}
        </span>
        {job.error && (
          // Keep the error badge for clarity if an error occurred
          <span class="bg-red-100 text-red-800 text-xs font-medium me-2 px-1.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">
            Error
          </span>
        )}
      </div>
    </div>
  </div>
);

const JobList = ({ jobs }: { jobs: JobInfo[] }) => (
  <div class="space-y-2">
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
