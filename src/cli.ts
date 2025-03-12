#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import path from "node:path";
import os from "node:os";
import { VectorStoreService } from "./store/VectorStoreService.js";
import { findVersion, listLibraries } from "./tools/library.js";
import { search } from "./tools/search.js";
import { scrape } from "./tools/scrape.js";

const formatOutput = (data: unknown) => JSON.stringify(data, null, 2);

const program = new Command();

// Initialize the store manager
const store = new VectorStoreService();

// Function to ensure store is shutdown before exiting
const cleanupAndExit = async (error?: unknown) => {
  await store.shutdown();
  if (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
  process.exit(0);
};

// Handle cleanup on SIGINT
process.on("SIGINT", () => {
  cleanupAndExit();
});

program
  .name("docs-mcp")
  .description("CLI for managing documentation vector store")
  .version("1.0.0");

program
  .command("scrape <library> <version> <url>")
  .description("Scrape and index documentation from a URL")
  .option("-p, --max-pages <number>", "Maximum pages to scrape", "100")
  .option("-d, --max-depth <number>", "Maximum navigation depth", "3")
  .option(
    "--subpages-only",
    "Allow scraping pages outside the initial URL path",
    true
  )
  .action(async (library, version, url, options) => {
    try {
      const result = await scrape({
        storeService: store,
        url,
        library,
        version,
        options: {
          maxPages: Number.parseInt(options.maxPages),
          maxDepth: Number.parseInt(options.maxDepth),
        },
      });
      console.log(`✅ Successfully scraped ${result.pagesScraped} pages`);
      await cleanupAndExit();
    } catch (error) {
      await cleanupAndExit(error);
    }
  });

program
  .command("search <library> <version> <query>")
  .description(
    "Search documents in a library. Version matching examples:\n" +
      "  - search react 18.0.0 'hooks' -> matches docs for React 18.0.0 or earlier versions\n" +
      "  - search react 18.0.0 'hooks' --exact-match -> only matches React 18.0.0\n" +
      "  - search typescript 5.x 'types' -> matches any TypeScript 5.x.x version\n" +
      "  - search typescript 5.2.x 'types' -> matches any TypeScript 5.2.x version"
  )
  .option("-l, --limit <number>", "Maximum number of results", "5")
  .option(
    "-e, --exact-match",
    "Only use exact version match (e.g., '18.0.0' matches only 18.0.0, not 17.x.x) (default: false)",
    false
  )
  .action(async (library, version, query, options) => {
    try {
      const result = await search({
        library,
        version,
        query,
        limit: Number.parseInt(options.limit),
        exactMatch: options.exactMatch,
        storeService: store,
      });
      console.log(formatOutput(result.results));
      await cleanupAndExit();
    } catch (error) {
      await cleanupAndExit(error);
    }
  });

program
  .command("list-libraries")
  .description("List all available libraries and their versions")
  .action(async () => {
    try {
      const result = await listLibraries({ storeService: store });
      console.log(formatOutput(result.libraries));
      await cleanupAndExit();
    } catch (error) {
      await cleanupAndExit(error);
    }
  });

program
  .command("find-version <library> [targetVersion]")
  .description("Find the best matching version for a library")
  .action(async (library, targetVersion) => {
    try {
      const version = await findVersion({
        storeService: store,
        library,
        targetVersion,
      });
      if (version) {
        console.log(version);
        await cleanupAndExit();
      } else {
        await cleanupAndExit("No matching version found");
      }
    } catch (error) {
      await cleanupAndExit(error);
    }
  });

program.parse();
