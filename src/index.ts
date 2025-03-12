#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VectorStoreService } from "./store/VectorStoreService.js";
import { findVersion, listLibraries } from "./tools/library.js";
import { search } from "./tools/search.js";
import { scrape } from "./tools/scrape.js";

// Initialize vector store
const storeService = new VectorStoreService();

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
    const result = await scrape({
      storeService,
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
    const result = await search({
      library,
      version,
      query,
      limit,
      exactMatch,
      storeService,
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
  const result = await listLibraries({ storeService });

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
    const version = await findVersion({
      storeService: storeService,
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
server.connect(transport);
console.error("Documentation MCP server running on stdio");

// Handle cleanup
process.on("SIGINT", async () => {
  await storeService.shutdown();
  await server.close();
  process.exit(0);
});
