#!/usr/bin/env node
import "dotenv/config";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DocumentManagementService } from "../store/DocumentManagementService";
import { PipelineManager } from "../pipeline/PipelineManager"; // Import PipelineManager
import { PipelineJobStatus } from "../pipeline/types"; // Import PipelineJobStatus
import {
  CancelJobTool, // Import new tool
  FindVersionTool,
  GetJobStatusTool, // Import new tool
  ListJobsTool, // Import new tool
  ListLibrariesTool,
  ScrapeTool, // Keep existing tools
  SearchTool,
  VersionNotFoundError,
} from "../tools"; // Ensure this path is correct
import { createError, createResponse } from "./utils";
import { logger } from "../utils/logger";
import { PipelineStateError } from "../pipeline/errors"; // Import error type

export async function startServer() {
  const docService = new DocumentManagementService();

  try {
    await docService.initialize();

    // Instantiate PipelineManager
    // TODO: Check if concurrency needs to be configurable
    const pipelineManager = new PipelineManager(docService);
    // Start the pipeline manager to process jobs
    await pipelineManager.start(); // Assuming start is async and needed

    // Instantiate tools, passing dependencies
    const tools = {
      listLibraries: new ListLibrariesTool(docService),
      findVersion: new FindVersionTool(docService),
      // TODO: Update ScrapeTool constructor if needed to accept PipelineManager
      // ScrapeTool currently uses docService.getPipelineManager() which doesn't exist.
      // Pass both docService and pipelineManager to ScrapeTool constructor
      scrape: new ScrapeTool(docService, pipelineManager),
      search: new SearchTool(docService),
      listJobs: new ListJobsTool(pipelineManager), // Instantiate new tool
      getJobStatus: new GetJobStatusTool(pipelineManager), // Instantiate new tool
      cancelJob: new CancelJobTool(pipelineManager), // Instantiate new tool
    };

    const server = new McpServer(
      {
        name: "docs-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      },
    );

    // --- Existing Tool Definitions ---

    // Scrape docs tool (Keep as is for now, but likely needs ScrapeTool refactor)
    server.tool(
      "scrape_docs",
      "Scrape and index documentation from a URL",
      {
        url: z.string().url().describe("URL of the documentation to scrape"),
        library: z.string().describe("Name of the library"),
        version: z.string().optional().describe("Version of the library"),
        maxPages: z
          .number()
          .optional()
          .default(100)
          .describe("Maximum number of pages to scrape"),
        maxDepth: z.number().optional().default(3).describe("Maximum navigation depth"),
        subpagesOnly: z
          .boolean()
          .optional()
          .default(true)
          .describe("Only scrape pages under the initial URL path"),
      },
      // Remove context as it's not used without progress reporting
      async ({ url, library, version, maxPages, maxDepth, subpagesOnly }) => {
        try {
          // Execute scrape tool without waiting and without progress callback
          // NOTE: This might fail if ScrapeTool relies on docService.getPipelineManager()
          const result = await tools.scrape.execute({
            url,
            library,
            version,
            waitForCompletion: false, // Don't wait for completion
            // onProgress: undefined, // Explicitly undefined or omitted
            options: {
              maxPages,
              maxDepth,
              subpagesOnly,
            },
          });

          // Check the type of result
          if ("jobId" in result) {
            // If we got a jobId back, report that
            return createResponse(`🚀 Scraping job started with ID: ${result.jobId}.`);
          }
          // This case shouldn't happen if waitForCompletion is false, but handle defensively
          return createResponse(
            `Scraping finished immediately (unexpectedly) with ${result.pagesScraped} pages.`,
          );
        } catch (error) {
          // Handle errors during job *enqueueing* or initial setup
          return createError(
            `Failed to scrape documentation: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    );

    // Search docs tool (Keep as is)
    server.tool(
      "search_docs",
      "Search indexed documentation. Examples:\n" +
        '- {library: "react", query: "how do hooks work"} -> matches latest version of React\n' +
        '- {library: "react", version: "18.0.0", query: "how do hooks work"} -> matches React 18.0.0 or earlier\n' +
        '- {library: "react", version: "18.0.0", query: "how do hooks work", exactMatch: true} -> only React 18.0.0\n' +
        '- {library: "typescript", version: "5.x", query: "ReturnType example"} -> any TypeScript 5.x.x version\n' +
        '- {library: "typescript", version: "5.2.x", query: "ReturnType example"} -> any TypeScript 5.2.x version',
      {
        library: z.string().describe("Name of the library"),
        version: z
          .string()
          .optional()
          .describe(
            "Version of the library (supports exact versions like '18.0.0' or X-Range patterns like '5.x', '5.2.x')",
          ),
        query: z.string().describe("Search query"),
        limit: z.number().optional().default(5).describe("Maximum number of results"),
        exactMatch: z
          .boolean()
          .optional()
          .default(false)
          .describe("Only use exact version match"),
      },
      async ({ library, version, query, limit, exactMatch }) => {
        try {
          const result = await tools.search.execute({
            library,
            version,
            query,
            limit,
            exactMatch,
          });

          const formattedResults = result.results.map(
            (r, i) => `
------------------------------------------------------------
Result ${i + 1}: ${r.url}

${r.content}\n`,
          );

          return createResponse(
            `Search results for '${query}' in ${library} v${version}:
${formattedResults.join("")}`,
          );
        } catch (error) {
          if (error instanceof VersionNotFoundError) {
            const indexedVersions = error.availableVersions
              .filter((v): v is { version: string; indexed: true } => v.indexed)
              .map((v) => v.version);
            return createError(
              indexedVersions.length > 0
                ? `Version not found. Available indexed versions for ${library}: ${indexedVersions.join(", ")}`
                : `Version not found. No indexed versions available for ${library}.`,
            );
          }
          return createError(
            `Failed to search documentation: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    );

    // List libraries tool (Keep as is)
    server.tool("list_libraries", "List all indexed libraries", {}, async () => {
      try {
        const result = await tools.listLibraries.execute();

        return createResponse(
          `Indexed libraries:\n${result.libraries.map((lib) => `- ${lib.name}`).join("\n")}`,
        );
      } catch (error) {
        return createError(
          `Failed to list libraries: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    // Find version tool (Keep as is)
    server.tool(
      "find_version",
      "Find best matching version for a library",
      {
        library: z.string().describe("Name of the library"),
        targetVersion: z
          .string()
          .optional()
          .describe(
            "Target version to match (supports exact versions like '18.0.0' or X-Range patterns like '5.x', '5.2.x')",
          ),
      },
      async ({ library, targetVersion }) => {
        try {
          const version = await tools.findVersion.execute({
            library,
            targetVersion,
          });

          if (!version) {
            return createError("No matching version found");
          }

          return createResponse(`Found matching version: ${version}`);
        } catch (error) {
          return createError(
            `Failed to find version: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    );

    // List jobs tool
    server.tool(
      "list_jobs",
      "List pipeline jobs, optionally filtering by status.",
      {
        status: z
          .nativeEnum(PipelineJobStatus)
          .optional()
          .describe("Optional status to filter jobs by."),
      },
      async ({ status }) => {
        try {
          const result = await tools.listJobs.execute({ status });
          // Format the job list for display
          const formattedJobs = result.jobs
            .map(
              (job) =>
                `- ID: ${job.id}\n  Status: ${job.status}\n  Library: ${job.library}@${job.version}\n  Created: ${job.createdAt.toISOString()}${job.startedAt ? `\n  Started: ${job.startedAt.toISOString()}` : ""}${job.finishedAt ? `\n  Finished: ${job.finishedAt.toISOString()}` : ""}${job.error ? `\n  Error: ${job.error.message}` : ""}`,
            )
            .join("\n\n");
          return createResponse(
            result.jobs.length > 0
              ? `Current Jobs:\n\n${formattedJobs}`
              : "No jobs found matching criteria.",
          );
        } catch (error) {
          return createError(
            `Failed to list jobs: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    );

    // Get job status tool
    server.tool(
      "get_job_status",
      "Get the status and details of a specific pipeline job.",
      {
        jobId: z.string().uuid().describe("The ID of the job to query."),
      },
      async ({ jobId }) => {
        try {
          const result = await tools.getJobStatus.execute({ jobId });
          if (!result.job) {
            return createError(`Job with ID ${jobId} not found.`);
          }
          const job = result.job;
          const formattedJob = `- ID: ${job.id}\n  Status: ${job.status}\n  Library: ${job.library}@${job.version}\n  Created: ${job.createdAt.toISOString()}${job.startedAt ? `\n  Started: ${job.startedAt.toISOString()}` : ""}${job.finishedAt ? `\n  Finished: ${job.finishedAt.toISOString()}` : ""}${job.error ? `\n  Error: ${job.error.message}` : ""}`;
          return createResponse(`Job Status:\n\n${formattedJob}`);
        } catch (error) {
          return createError(
            `Failed to get job status for ${jobId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    );

    // Cancel job tool
    server.tool(
      "cancel_job",
      "Attempt to cancel a queued or running pipeline job.",
      {
        jobId: z.string().uuid().describe("The ID of the job to cancel."),
      },
      async ({ jobId }) => {
        try {
          const result = await tools.cancelJob.execute({ jobId });
          // Use the message and success status from the tool's result
          if (result.success) {
            return createResponse(result.message);
          }
          // If not successful according to the tool, treat it as an error in MCP
          return createError(result.message);
        } catch (error) {
          // Catch any unexpected errors during the tool execution itself
          return createError(
            `Failed to cancel job ${jobId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    );

    server.prompt(
      "docs",
      "Search indexed documentation",
      {
        library: z.string().describe("Name of the library"),
        version: z.string().optional().describe("Version of the library"),
        query: z.string().describe("Search query"),
      },
      async ({ library, version, query }) => {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please search ${library} ${version || ""} documentation for this query: ${query}`,
              },
            },
          ],
        };
      },
    );

    server.resource(
      "libraries",
      "docs://libraries",
      {
        description: "List all indexed libraries",
      },
      async (uri: URL) => {
        const result = await tools.listLibraries.execute();

        return {
          contents: result.libraries.map((lib) => ({
            uri: new URL(lib.name, uri).href,
            text: lib.name,
          })),
        };
      },
    );

    server.resource(
      "versions",
      new ResourceTemplate("docs://libraries/{library}/versions", {
        list: undefined,
      }),
      {
        description: "List all indexed versions for a library",
      },
      async (uri: URL, { library }) => {
        const result = await tools.listLibraries.execute();

        const lib = result.libraries.find((l) => l.name === library);
        if (!lib) {
          return { contents: [] };
        }

        return {
          contents: lib.versions.map((v) => ({
            uri: new URL(v.version, uri).href,
            text: v.version,
          })),
        };
      },
    );

    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Documentation MCP server running on stdio");

    // Handle cleanup
    process.on("SIGINT", async () => {
      await pipelineManager.stop(); // Stop the pipeline manager
      await docService.shutdown();
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    await docService.shutdown(); // Ensure docService shutdown on error too
    logger.error(`❌ Fatal Error: ${error}`);
    process.exit(1);
  }
}
