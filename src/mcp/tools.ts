import { FileFetcher, HttpFetcher } from "../scraper/fetcher";
import {
  CancelJobTool,
  FetchUrlTool,
  FindVersionTool,
  GetJobInfoTool,
  ListJobsTool,
  ListLibrariesTool,
  RemoveTool,
  ScrapeTool,
  SearchTool,
} from "../tools";
import { getDocService, getPipelineManager } from "./services";

/**
 * Interface for the shared tool instances.
 */
export interface McpServerTools {
  listLibraries: ListLibrariesTool;
  findVersion: FindVersionTool;
  scrape: ScrapeTool;
  search: SearchTool;
  listJobs: ListJobsTool;
  getJobInfo: GetJobInfoTool;
  cancelJob: CancelJobTool;
  remove: RemoveTool;
  fetchUrl: FetchUrlTool;
}

/**
 * Initializes and returns the shared tool instances.
 * This should be called after initializeServices has completed.
 * @returns An object containing all instantiated tool instances.
 */
export async function initializeTools(): Promise<McpServerTools> {
  const docService = getDocService();
  const pipelineManager = getPipelineManager();

  const tools: McpServerTools = {
    listLibraries: new ListLibrariesTool(docService),
    findVersion: new FindVersionTool(docService),
    scrape: new ScrapeTool(docService, pipelineManager),
    search: new SearchTool(docService),
    listJobs: new ListJobsTool(pipelineManager),
    getJobInfo: new GetJobInfoTool(pipelineManager),
    cancelJob: new CancelJobTool(pipelineManager),
    remove: new RemoveTool(docService),
    // FetchUrlTool now uses middleware pipeline internally
    fetchUrl: new FetchUrlTool(new HttpFetcher(), new FileFetcher()),
  };

  return tools;
}
