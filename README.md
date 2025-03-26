# docs-mcp-server MCP Server

This project provides a Model Context Protocol (MCP) server designed to scrape, process, index, and search documentation for various software libraries and packages. It fetches content from specified URLs, splits it into meaningful chunks using semantic splitting techniques, generates vector embeddings using OpenAI, and stores the data in an SQLite database. The server utilizes `sqlite-vec` for efficient vector similarity search and FTS5 for full-text search capabilities, combining them for hybrid search results. It supports versioning, allowing documentation for different library versions (including unversioned content) to be stored and queried distinctly. The server exposes MCP tools for scraping (`scrape_docs`), searching (`search_docs`), listing indexed libraries (`list_libraries`), and finding appropriate versions (`find_version`). A companion CLI (`docs-mcp`) is also included for local management and interaction.

A MCP server for fetching and searching 3rd party package documentation

## CLI Usage

The `docs-mcp` CLI provides commands for managing documentation. To see available commands and options:

```bash
# Show all commands
docs-mcp --help

# Show help for a specific command
docs-mcp scrape --help
docs-mcp search --help
docs-mcp find-version --help
```

### Scraping Documentation (`scrape`)

Scrapes and indexes documentation from a given URL for a specific library.

```bash
docs-mcp scrape <library> <url> [options]
```

**Options:**

- `-v, --version <string>`: The specific version to associate with the scraped documents.
  - Accepts full versions (`1.2.3`), pre-release versions (`1.2.3-beta.1`), or partial versions (`1`, `1.2` which are expanded to `1.0.0`, `1.2.0`).
  - If omitted, the documentation is indexed as **unversioned**.
- `-p, --max-pages <number>`: Maximum pages to scrape (default: 100).
- `-d, --max-depth <number>`: Maximum navigation depth (default: 3).
- `-c, --max-concurrency <number>`: Maximum concurrent requests (default: 3).
- `--ignore-errors`: Ignore errors during scraping (default: true).

**Examples:**

```bash
# Scrape React 18.2.0 docs
docs-mcp scrape react --version 18.2.0 https://react.dev/

# Scrape React docs without a specific version (indexed as unversioned)
docs-mcp scrape react https://react.dev/

# Scrape partial version (will be stored as 7.0.0)
docs-mcp scrape semver --version 7 https://github.com/npm/node-semver

# Scrape pre-release version
docs-mcp scrape mylib --version 2.0.0-rc.1 https://mylib.com/docs
```

### Searching Documentation (`search`)

Searches the indexed documentation for a library, optionally filtering by version.

```bash
docs-mcp search <library> <query> [options]
```

**Options:**

- `-v, --version <string>`: The target version or range to search within.
  - Supports exact versions (`18.0.0`), partial versions (`18`), or ranges (`18.x`).
  - If omitted, searches the **latest** available indexed version.
  - If a specific version/range doesn't match, it falls back to the latest indexed version _older_ than the target.
  - To search **only unversioned** documents, explicitly pass an empty string: `--version ""`. (Note: Omitting `--version` searches latest, which _might_ be unversioned if no other versions exist).
- `-l, --limit <number>`: Maximum number of results (default: 5).
- `-e, --exact-match`: Only match the exact version specified (disables fallback and range matching) (default: false).

**Examples:**

```bash
# Search latest React docs for 'hooks'
docs-mcp search react 'hooks'

# Search React 18.x docs for 'hooks'
docs-mcp search react --version 18.x 'hooks'

# Search React 17 docs (will match 17.x.x or older if 17.x.x not found)
docs-mcp search react --version 17 'hooks'

# Search only React 18.0.0 docs
docs-mcp search react --version 18.0.0 --exact-match 'hooks'

# Search only unversioned React docs
docs-mcp search react --version "" 'hooks'
```

### Finding Available Versions (`find-version`)

Checks the index for the best matching version for a library based on a target, and indicates if unversioned documents exist.

```bash
docs-mcp find-version <library> [options]
```

**Options:**

- `-v, --version <string>`: The target version or range. If omitted, finds the latest available version.

**Examples:**

```bash
# Find the latest indexed version for react
docs-mcp find-version react

# Find the best match for react version 17.x
docs-mcp find-version react --version 17.x

# Find the best match for react version 17.0.0 (may fall back to older)
docs-mcp find-version react --version 17.0.0
```

### Listing Libraries (`list-libraries`)

Lists all libraries currently indexed in the store.

```bash
docs-mcp list-libraries
```

### Version Handling Summary

- **Scraping:** Requires a specific, valid version (`X.Y.Z`, `X.Y.Z-pre`, `X.Y`, `X`) or no version (for unversioned docs). Ranges (`X.x`) are invalid for scraping.
- **Searching/Finding:** Accepts specific versions, partials, or ranges (`X.Y.Z`, `X.Y`, `X`, `X.x`). Falls back to the latest older version if the target doesn't match. Omitting the version targets the latest available. Explicitly searching `--version ""` targets unversioned documents.
- **Unversioned Docs:** Libraries can have documentation stored without a specific version (by omitting `--version` during scrape). These can be searched explicitly using `--version ""`. The `find-version` command will also report if unversioned docs exist alongside any semver matches.

## Development

Install dependencies:

```bash
npm install
```

Build the server:

```bash
npm run build
```

### Environment Setup

1. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

2. Update your OpenAI API key in `.env`:

```
OPENAI_API_KEY=your-api-key-here
```

3. Start the MCP server:

The MCP server provides two endpoints:

- SSE endpoint: http://localhost:8000/sse
- POST messages: http://localhost:8000/message

## Installation

To use with Claude Desktop, add the server config:

- On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "docs-mcp-server": {
      "command": "node",
      "args": ["/path/to/docs-mcp-server/dist/server.js"],
      "env": {
        "OPENAI_API_KEY": "sk-proj-..."
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npx @modelcontextprotocol/inspector node dist/server.js
```

The Inspector will provide a URL to access debugging tools in your browser.
