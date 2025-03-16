#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VectorStoreService } from "../store/VectorStoreService";
import {
  FindVersionTool,
  ListLibrariesTool,
  ScrapeTool,
  SearchTool,
  VersionNotFoundError,
} from "../tools";
import { createError, createResponse } from "./utils";

export async function startServer() {
  const storeService = new VectorStoreService();

  try {
    await storeService.initialize();

    const tools = {
      listLibraries: new ListLibrariesTool(storeService),
      findVersion: new FindVersionTool(storeService),
      scrape: new ScrapeTool(storeService),
      search: new SearchTool(storeService),
    };

    const server = new McpServer({
      name: "docs-mcp-server",
      version: "0.1.0",
      capabilities: {
        tools: {},
      },
    });

    // Scrape docs tool
    server.tool(
      "scrape_docs",
      "Scrape and index documentation from a URL",
      {
        url: z.string().url().describe("URL of the documentation to scrape"),
        library: z.string().describe("Name of the library"),
        version: z.string().describe("Version of the library"),
        maxPages: z
          .number()
          .optional()
          .default(100)
          .describe("Maximum number of pages to scrape"),
        maxDepth: z
          .number()
          .optional()
          .default(3)
          .describe("Maximum navigation depth"),
        subpagesOnly: z
          .boolean()
          .optional()
          .default(true)
          .describe("Only scrape pages under the initial URL path"),
      },
      async ({ url, library, version, maxPages, maxDepth }) => {
        try {
          const result = await tools.scrape.execute({
            url,
            library,
            version,
            options: {
              maxPages,
              maxDepth,
            },
          });

          return createResponse(
            `Successfully scraped ${result.pagesScraped} pages from ${url} for ${library} v${version}.`
          );
        } catch (error) {
          return createError(
            `Failed to scrape documentation: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    // Search docs tool
    server.tool(
      "search_docs",
      "Search indexed documentation. Examples:\n" +
        '- {library: "react", version: "18.0.0", query: "how do hooks work"} -> matches React 18.0.0 or earlier\n' +
        '- {library: "react", version: "18.0.0", query: "how do hooks work", exactMatch: true} -> only React 18.0.0\n' +
        '- {library: "typescript", version: "5.x", query: "ReturnType example"} -> any TypeScript 5.x.x version\n' +
        '- {library: "typescript", version: "5.2.x", query: "ReturnType example"} -> any TypeScript 5.2.x version',
      {
        library: z.string().describe("Name of the library"),
        version: z
          .string()
          .describe(
            "Version of the library (supports exact versions like '18.0.0' or X-Range patterns like '5.x', '5.2.x')"
          ),
        query: z.string().describe("Search query"),
        limit: z
          .number()
          .optional()
          .default(5)
          .describe("Maximum number of results"),
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

          return createResponse(
            `Search results for '${query}' in ${library} v${version}:\n\n${result.results
              .map(
                (r, i) => `Result ${i + 1}:
- URL: ${r.metadata.url}
- Title: ${r.metadata.title}
- Snippet: ${r.content}\n`
              )
              .join("")}`
          );
        } catch (error) {
          if (error instanceof VersionNotFoundError) {
            const indexedVersions = error.availableVersions
              .filter((v): v is { version: string; indexed: true } => v.indexed)
              .map((v) => v.version);
            return createError(
              indexedVersions.length > 0
                ? `Version not found. Available indexed versions for ${library}: ${indexedVersions.join(", ")}`
                : `Version not found. No indexed versions available for ${library}.`
            );
          }
          return createError(
            `Failed to search documentation: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    // List libraries tool
    server.tool(
      "list_libraries",
      "List all indexed libraries",
      {},
      async () => {
        try {
          const result = await tools.listLibraries.execute();

          return createResponse(
            `Indexed libraries:\n${result.libraries.map((lib) => `- ${lib.name}`).join("\n")}`
          );
        } catch (error) {
          return createError(
            `Failed to list libraries: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

    // Find version tool
    server.tool(
      "find_version",
      "Find best matching version for a library",
      {
        library: z.string().describe("Name of the library"),
        targetVersion: z
          .string()
          .optional()
          .describe(
            "Target version to match (supports exact versions like '18.0.0' or X-Range patterns like '5.x', '5.2.x')"
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
            }`
          );
        }
      }
    );

    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Documentation MCP server running on stdio");

    // Handle cleanup
    process.on("SIGINT", async () => {
      await storeService.shutdown();
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    await storeService.shutdown();
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
