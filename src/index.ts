#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VectorStoreService } from "./store/VectorStoreService.js";
import {
  FindVersionTool,
  ListLibrariesTool,
  ScrapeTool,
  SearchTool,
} from "./tools";

async function main() {
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
        tools: {
          scrape_docs: {
            description: "Scrape and index documentation from a URL",
            input: {
              url: "URL of the documentation to scrape",
              library: "Name of the library",
              version: "Version of the library",
              maxPages: "Maximum number of pages to scrape (default: 100)",
              maxDepth: "Maximum navigation depth (default: 3)",
              subpagesOnly:
                "Only scrape pages under the initial URL path (default: true)",
            },
          },
          search_docs: {
            description:
              "Search indexed documentation. Examples:\n" +
              "- {library: 'react', version: '18.0.0', query: 'hooks'} -> matches React 18.0.0 or earlier\n" +
              "- {library: 'react', version: '18.0.0', query: 'hooks', exactMatch: true} -> only React 18.0.0\n" +
              "- {library: 'typescript', version: '5.x', query: 'types'} -> any TypeScript 5.x.x version\n" +
              "- {library: 'typescript', version: '5.2.x', query: 'types'} -> any TypeScript 5.2.x version",
            input: {
              library: "Name of the library",
              version:
                "Version of the library (supports exact versions like '18.0.0' or X-Range patterns like '5.x', '5.2.x')",
              query: "Search query",
              limit: "Maximum number of results (default: 5)",
              exactMatch: "Only use exact version match (default: false)",
            },
          },
          list_libraries: {
            description: "List all indexed libraries",
          },
          find_version: {
            description: "Find best matching version for a library",
            input: {
              library: "Name of the library",
              targetVersion: "Target version to match (optional)",
            },
          },
        },
      },
    });

    // Scrape docs tool
    server.tool(
      "scrape_docs",
      {
        url: z.string().url(),
        library: z.string(),
        version: z.string(),
        maxPages: z.number().optional().default(100),
        maxDepth: z.number().optional().default(3),
        subpagesOnly: z.boolean().optional().default(true),
      },
      async ({ url, library, version, maxPages, maxDepth }) => {
        const result = await tools.scrape.execute({
          url,
          library,
          version,
          options: {
            maxPages,
            maxDepth,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: `Successfully scraped ${result.pagesScraped} pages`,
            },
          ],
        };
      }
    );

    // Search docs tool
    server.tool(
      "search_docs",
      {
        library: z.string(),
        version: z.string(),
        query: z.string(),
        limit: z.number().optional().default(5),
        exactMatch: z.boolean().optional().default(false),
      },
      async ({ library, version, query, limit, exactMatch }) => {
        const result = await tools.search.execute({
          library,
          version,
          query,
          limit,
          exactMatch,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.results, null, 2),
            },
          ],
        };
      }
    );

    // List libraries tool
    server.tool("list_libraries", {}, async () => {
      const result = await tools.listLibraries.execute();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.libraries, null, 2),
          },
        ],
      };
    });

    // Find version tool
    server.tool(
      "find_version",
      {
        library: z.string(),
        targetVersion: z.string().optional(),
      },
      async ({ library, targetVersion }) => {
        const version = await tools.findVersion.execute({
          library,
          targetVersion,
        });

        if (!version) {
          return {
            content: [
              {
                type: "text",
                text: "No matching version found",
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: version,
            },
          ],
        };
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

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
