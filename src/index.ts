#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import os from "node:os";
import { VectorStoreManager } from "./store/VectorStoreManager.js";
import { findVersion, listLibraries } from "./tools/library.js";
import { search } from "./tools/search.js";
import { scrape } from "./tools/scrape.js";

// Initialize vector store
const baseDir = path.join(os.homedir(), ".docs-mcp", "data");
const store = new VectorStoreManager(baseDir);

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
        description: "Search indexed documentation",
        input: {
          library: "Name of the library",
          version: "Version of the library",
          query: "Search query",
          limit: "Maximum number of results (default: 5)",
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
  async ({ url, library, version, maxPages, maxDepth, subpagesOnly }) => {
    const result = await scrape(
      {
        url,
        library,
        version,
        options: {
          maxPages,
          maxDepth,
        },
      },
      (progress) => ({
        content: progress.content,
      })
    );

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
  },
  async ({ library, version, query, limit }) => {
    const result = await search({
      library,
      version,
      query,
      limit,
      store,
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
server.tool("list_libraries", "", async () => {
  const result = await listLibraries({ store });

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
    const version = await findVersion({ store, library, targetVersion });

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
process.on("SIGINT", () => {
  process.exit(0);
});
