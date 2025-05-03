import type { JobInfo } from "../../tools/GetJobInfoTool";
import JobItem from "./JobItem"; // Adjusted import path

/**
 * Props for the JobList component.
 */
interface JobListProps {
  jobs: JobInfo[];
}

/**
 * Renders a list of JobItem components or a message if the list is empty.
 * @param props - Component props including the array of jobs.
 */
const JobList = ({ jobs }: JobListProps) => (
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

export default JobList;
