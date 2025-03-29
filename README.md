# docs-mcp-server MCP Server

A MCP server for fetching and searching 3rd party package documentation.

This project provides a Model Context Protocol (MCP) server designed to scrape, process, index, and search documentation for various software libraries and packages. It fetches content from specified URLs, splits it into meaningful chunks using semantic splitting techniques, generates vector embeddings using OpenAI, and stores the data in an SQLite database. The server utilizes `sqlite-vec` for efficient vector similarity search and FTS5 for full-text search capabilities, combining them for hybrid search results. It supports versioning, allowing documentation for different library versions (including unversioned content) to be stored and queried distinctly.

The scraping process is managed by an asynchronous job queue (`PipelineManager`), allowing multiple scrape jobs to run concurrently.

The server exposes MCP tools for:

- Starting a scraping job (`scrape_docs`): Returns a `jobId` immediately.
- Checking job status (`get_job_status`): Retrieves the current status and progress of a specific job.
- Listing active/completed jobs (`list_jobs`): Shows recent and ongoing jobs.
- Cancelling a job (`cancel_job`): Attempts to stop a running or queued job.
- Searching documentation (`search_docs`).
- Listing indexed libraries (`list_libraries`).
- Finding appropriate versions (`find_version`).

A companion CLI (`docs-mcp`) is also included for local management and interaction (note: the CLI `scrape` command waits for completion).

## Building the Project

Before you can use the server (e.g., by integrating it with Claude Desktop as described in the "Installation" section), you need to clone the repository and build the project from source.

1.  **Clone the repository:**
    If you haven't already, clone the project to your local machine:

    ```bash
    git clone <repository-url> # Replace <repository-url> with the actual URL
    cd docs-mcp-server
    ```

2.  **Install dependencies:**
    Navigate into the project directory and install the required Node.js packages:

    ```bash
    npm install
    ```

3.  **Build the server:**
    Compile the TypeScript source code into JavaScript. The output will be placed in the `dist/` directory. This step is necessary to generate the `dist/server.js` file referenced in the installation instructions.

    ```bash
    npm run build
    ```

After completing these steps and setting up your `.env` file (see "Environment Setup" under Development), you can proceed with the "Installation" or "Running with Docker" instructions.

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

## Running with Docker

Alternatively, you can build and run the server using Docker. This provides an isolated environment and exposes the server via HTTP endpoints.

1.  **Build the Docker image:**

    ```bash
    docker build -t docs-mcp-server .
    ```

2.  **Run the Docker container:**

    Make sure your `.env` file is present in the project root directory, as it contains the necessary `OPENAI_API_KEY`. The container will read variables from this file at runtime using the `--env-file` flag. (See "Environment Setup" under Development for details on the `.env` file).

    ```bash
    docker run -p 8000:8000 --env-file .env --name docs-mcp-server-container docs-mcp-server
    ```

    - `-p 8000:8000`: Maps port 8000 on your host to port 8000 in the container.
    - `--env-file .env`: Loads environment variables from your local `.env` file at runtime. This is the recommended way to handle secrets.
    - `--name docs-mcp-server-container`: Assigns a name to the container for easier management.

3.  **Available Endpoints:**

    Once the container is running, the MCP server is accessible via:

    - **SSE Endpoint:** `http://localhost:8000/sse` (for Server-Sent Events communication)
    - **POST Messages:** `http://localhost:8000/message` (for sending individual messages)

This method is useful if you prefer not to run the server directly via Node.js or integrate it with Claude Desktop using the standard installation method.

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

For details on the project's architecture and design principles, please see [ARCHITECTURE.md](ARCHITECTURE.md).

_Notably, the vast majority of this project's code was generated by the AI assistant Cline, leveraging the capabilities of this very MCP server._

### Environment Setup

**Note:** This `.env` file setup is primarily needed when running the server manually (e.g., `node dist/server.js`) or during local development/testing using the CLI (`docs-mcp`). When configuring the server for Claude Desktop (see "Installation"), the `OPENAI_API_KEY` is typically set directly in the `claude_desktop_config.json` file, and this `.env` file is not used by the Claude integration.

1. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

2. Update your OpenAI API key in `.env`:

```
OPENAI_API_KEY=your-api-key-here
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npx @modelcontextprotocol/inspector node dist/server.js
```

The Inspector will provide a URL to access debugging tools in your browser.
