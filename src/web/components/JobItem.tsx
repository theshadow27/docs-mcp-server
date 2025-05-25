import type { JobInfo } from "../../tools/GetJobInfoTool";
import { PipelineJobStatus } from "../../pipeline/types";
import VersionBadge from "./VersionBadge"; // Adjusted import path

/**
 * Props for the JobItem component.
 */
interface JobItemProps {
  job: JobInfo;
}

/**
 * Renders a single job item with its details and status.
 * @param props - Component props including the job information.
 */
const JobItem = ({ job }: JobItemProps) => (
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
        {/* Status badge with inline stop button for QUEUED/RUNNING jobs */}
        <div class="flex items-center gap-2">
          <span
            class={`px-1.5 py-0.5 text-xs font-medium rounded ${
              job.status === PipelineJobStatus.COMPLETED
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                : job.error
                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
            }`}
          >
            {job.status}
          </span>
          {/* Stop button for QUEUED/RUNNING jobs */}
          {(job.status === PipelineJobStatus.QUEUED ||
            job.status === PipelineJobStatus.RUNNING) && (
            <button
              type="button"
              class="font-medium rounded-lg text-xs p-1 text-center inline-flex items-center transition-colors duration-150 ease-in-out border border-gray-300 bg-white text-red-600 hover:bg-red-50 focus:ring-4 focus:outline-none focus:ring-red-100 dark:border-gray-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700 dark:focus:ring-red-900"
              title="Stop this job"
              x-data={`{
                get confirming() { return $store.jobStates['${job.id}']?.confirming || false },
                get isStopping() { return $store.jobStates['${job.id}']?.isStopping || false },
                get timeoutId() { return $store.jobStates['${job.id}']?.timeoutId || null },
                setConfirming(value) { 
                  if (!$store.jobStates['${job.id}']) $store.jobStates['${job.id}'] = {};
                  $store.jobStates['${job.id}'].confirming = value;
                },
                setStopping(value) { 
                  if (!$store.jobStates['${job.id}']) $store.jobStates['${job.id}'] = {};
                  $store.jobStates['${job.id}'].isStopping = value;
                },
                setTimeoutId(value) { 
                  if (!$store.jobStates['${job.id}']) $store.jobStates['${job.id}'] = {};
                  $store.jobStates['${job.id}'].timeoutId = value;
                }
              }`}
              x-bind:class="confirming ? 'bg-red-100 border-red-300 text-red-700' : ''"
              x-bind:disabled="isStopping"
              {...{
                "x-on:click.prevent.stop": `
                if (isStopping) return;
                if (confirming) {
                  if (timeoutId) {
                    clearTimeout(timeoutId);
                    setTimeoutId(null);
                  }
                  setStopping(true);
                  fetch(\`/api/jobs/${job.id}/cancel\`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                  })
                    .then(r => r.json())
                    .then(() => {
                      setStopping(false);
                      setConfirming(false);
                      document.dispatchEvent(new CustomEvent('job-list-refresh'));
                    })
                    .catch(() => { setStopping(false); setConfirming(false); });
                } else {
                  setConfirming(true);
                  const id = setTimeout(() => { 
                    setConfirming(false); 
                    setTimeoutId(null); 
                  }, 3000);
                  setTimeoutId(id);
                }
              `,
              }}
            >
              <span x-show="!confirming && !isStopping">
                {/* Red Stop Icon */}
                <svg
                  class="w-4 h-4"
                  aria-hidden="true"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <rect x="5" y="5" width="10" height="10" rx="2" />
                </svg>
              </span>
              <span x-show="confirming && !isStopping" class="px-2">
                Cancel?
              </span>
            </button>
          )}
        </div>
        {job.error && (
          // Keep the error badge for clarity if an error occurred
          <span class="bg-red-100 text-red-800 text-xs font-medium px-1.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">
            Error
          </span>
        )}
      </div>
    </div>
  </div>
);

export default JobItem;
