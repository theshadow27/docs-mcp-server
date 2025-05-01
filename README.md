# Docs MCP Server: Enhance Your AI Coding Assistant

AI coding assistants often struggle with outdated documentation, leading to incorrect suggestions or hallucinated code examples. Verifying AI responses against specific library versions can be time-consuming and inefficient.

The **Docs MCP Server** addresses these challenges by providing a personal, always-current knowledge base for your AI assistant. It acts as a bridge, connecting your LLM directly to the **latest official documentation** from thousands of software libraries.

By grounding AI responses in accurate, version-aware context, the Docs MCP Server enables you to receive concise and relevant integration details and code snippets, improving the reliability and efficiency of LLM-assisted development.

It's **free**, **open-source**, runs **locally** for privacy, and integrates seamlessly with your workflow via the Model Context Protocol (MCP).

## Why Use the Docs MCP Server?

LLM-assisted coding promises speed and efficiency, but often falls short due to:

- 🌀 **Stale Knowledge:** LLMs train on snapshots of the internet, quickly falling behind new library releases and API changes.
- 👻 **Code Hallucinations:** AI can invent plausible-looking code that is syntactically correct but functionally wrong or uses non-existent APIs.
- ❓ **Version Ambiguity:** Generic answers rarely account for the specific version dependencies in _your_ project, leading to subtle bugs.
- ⏳ **Verification Overhead:** Developers spend valuable time double-checking AI suggestions against official documentation.

**The Docs MCP Server tackles these problems head-on by:**

- ✅ **Providing Always Up-to-Date Context:** It fetches and indexes documentation _directly_ from official sources (websites, GitHub, npm, PyPI, local files) on demand.
- 🎯 **Delivering Version-Specific Answers:** Search queries can target exact library versions, ensuring the information aligns with your project's dependencies.
- 💡 **Reducing Hallucinations:** By grounding the LLM in real documentation, it provides accurate examples and integration details.
- ⚡ **Boosting Productivity:** Get trustworthy answers faster, integrated directly into your AI assistant workflow.

## ✨ Key Features

- **Up-to-Date Knowledge:** Fetches the latest documentation directly from the source.
- **Version-Aware Search:** Get answers relevant to specific library versions (e.g., `react@18.2.0` vs `react@17.0.0`).
- **Accurate Snippets:** Reduces AI hallucinations by using context from official docs.
- **Web Interface:** Provides a easy-to-use web interface for searching and managing documentation.
- **Broad Source Compatibility:** Scrapes websites, GitHub repos, package manager sites (npm, PyPI), and even local file directories.
- **Intelligent Processing:** Automatically chunks documentation semantically and generates embeddings.
- **Flexible Embedding Models:** Supports OpenAI (incl. compatible APIs like Ollama), Google Gemini/Vertex AI, Azure OpenAI, AWS Bedrock, and more.
- **Powerful Hybrid Search:** Combines vector similarity with full-text search for relevance.
- **Local & Private:** Runs entirely on your machine, keeping your data and queries private.
- **Free & Open Source:** Built for the community, by the community.
- **Simple Deployment:** Easy setup via Docker or `npx`.
- **Seamless Integration:** Works with MCP-compatible clients (like Claude, Cline, Roo).

## Running the MCP Server

Get up and running quickly!

### Option 1: Using Docker

This approach is easy, straightforward, and doesn't require Node.js to be installed.

1. **Ensure Docker is installed and running.**
2. **Configure your MCP settings:**

   **Claude/Cline/Roo Configuration Example:**
   Add the following configuration block to your MCP settings file (adjust path as needed):

   ```json
   {
     "mcpServers": {
       "docs-mcp-server": {
         "command": "docker",
         "args": [
           "run",
           "-i",
           "--rm",
           "-e",
           "OPENAI_API_KEY",
           "-v",
           "docs-mcp-data:/data",
           "ghcr.io/arabold/docs-mcp-server:latest"
         ],
         "env": {
           "OPENAI_API_KEY": "sk-proj-..." // Required: Replace with your key
         },
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

   Remember to replace `"sk-proj-..."` with your actual OpenAI API key and restart the application.

3. **That's it!** The server will now be available to your AI assistant.

**Docker Container Settings:**

- `-i`: Keep STDIN open, crucial for MCP communication over stdio.
- `--rm`: Automatically remove the container when it exits.
- `-e OPENAI_API_KEY`: **Required.** Set your OpenAI API key.
- `-v docs-mcp-data:/data`: **Required for persistence.** Mounts a Docker named volume `docs-mcp-data` to store the database. You can replace with a specific host path if preferred (e.g., `-v /path/on/host:/data`).

Any of the configuration environment variables (see [Configuration](#configuration) above) can be passed to the container using the `-e` flag. For example:

```bash
# Example 1: Using OpenAI embeddings (default)
docker run -i --rm \
  -e OPENAI_API_KEY="your-key-here" \
  -e DOCS_MCP_EMBEDDING_MODEL="text-embedding-3-small" \
  -v docs-mcp-data:/data \
  ghcr.io/arabold/docs-mcp-server:latest

# Example 2: Using OpenAI-compatible API (like Ollama)
docker run -i --rm \
  -e OPENAI_API_KEY="your-key-here" \
  -e OPENAI_API_BASE="http://localhost:11434/v1" \
  -e DOCS_MCP_EMBEDDING_MODEL="embeddings" \
  -v docs-mcp-data:/data \
  ghcr.io/arabold/docs-mcp-server:latest

# Example 3a: Using Google Cloud Vertex AI embeddings
docker run -i --rm \
  -e OPENAI_API_KEY="your-openai-key" \  # Keep for fallback to OpenAI
  -e DOCS_MCP_EMBEDDING_MODEL="vertex:text-embedding-004" \
  -e GOOGLE_APPLICATION_CREDENTIALS="/app/gcp-key.json" \
  -v docs-mcp-data:/data \
  -v /path/to/gcp-key.json:/app/gcp-key.json:ro \
  ghcr.io/arabold/docs-mcp-server:latest

# Example 3b: Using Google Generative AI (Gemini) embeddings
docker run -i --rm \
  -e OPENAI_API_KEY="your-openai-key" \  # Keep for fallback to OpenAI
  -e DOCS_MCP_EMBEDDING_MODEL="gemini:embedding-001" \
  -e GOOGLE_API_KEY="your-google-api-key" \
  -v docs-mcp-data:/data \
  ghcr.io/arabold/docs-mcp-server:latest

# Example 4: Using AWS Bedrock embeddings
docker run -i --rm \
  -e AWS_ACCESS_KEY_ID="your-aws-key" \
  -e AWS_SECRET_ACCESS_KEY="your-aws-secret" \
  -e AWS_REGION="us-east-1" \
  -e DOCS_MCP_EMBEDDING_MODEL="aws:amazon.titan-embed-text-v1" \
  -v docs-mcp-data:/data \
  ghcr.io/arabold/docs-mcp-server:latest

# Example 5: Using Azure OpenAI embeddings
docker run -i --rm \
  -e AZURE_OPENAI_API_KEY="your-azure-key" \
  -e AZURE_OPENAI_API_INSTANCE_NAME="your-instance" \
  -e AZURE_OPENAI_API_DEPLOYMENT_NAME="your-deployment" \
  -e AZURE_OPENAI_API_VERSION="2024-02-01" \
  -e DOCS_MCP_EMBEDDING_MODEL="microsoft:text-embedding-ada-002" \
  -v docs-mcp-data:/data \
  ghcr.io/arabold/docs-mcp-server:latest
```

### Option 2: Using npx

This approach is useful when you need local file access (e.g., indexing documentation from your local file system). While this can also be achieved by mounting paths into a Docker container, using `npx` is simpler but requires a Node.js installation.

1. **Ensure Node.js is installed.**
2. **Configure your MCP settings:**

   **Claude/Cline/Roo Configuration Example:**
   Add the following configuration block to your MCP settings file:

   ```json
   {
     "mcpServers": {
       "docs-mcp-server": {
         "command": "npx",
         "args": ["-y", "--package=@arabold/docs-mcp-server", "docs-server"],
         "env": {
           "OPENAI_API_KEY": "sk-proj-..." // Required: Replace with your key
         },
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

   Remember to replace `"sk-proj-..."` with your actual OpenAI API key and restart the application.

3. **That's it!** The server will now be available to your AI assistant.

### Option 3: Using `npx` with HTTP Protocol

Similar to Option 2, this uses `npx` to run the latest published package without needing Docker or a local clone. However, this option starts the server using the Streamable HTTP protocol instead of the default stdio, making it accessible via HTTP endpoints. This is useful if you have multiple clients, you work with multiple code assistants in parallel, or want to expose the server to other applications.

1.  **Ensure Node.js is installed.**
2.  **Run the command:**

    ```bash
    # Ensure required environment variables like OPENAI_API_KEY are set
    `npx` --package=@arabold/docs-mcp-server docs-server --protocol http --port 8000
    ```

    - `--protocol http`: Instructs the server to use the HTTP protocol.
    - `--port <number>`: Specifies the listening port (default: 8000).

    The server will expose endpoints like `/mcp` and `/sse` on the specified port.

## Using the Web Interface

You can access a web-based GUI at `http://localhost:3000` to manage and search library documentation through your browser. **Important: Use the same method (Docker or npx) for both the server and web interface to ensure access to the same indexed documentation.**

### Using Docker Web Interface

If you're running the server with Docker, use Docker for the web interface as well:

```bash
docker run --rm \
  -e OPENAI_API_KEY="your-openai-api-key-here" \
  -v docs-mcp-data:/data \
  -p 3000:3000 \
  ghcr.io/arabold/docs-mcp-server:latest \
  docs-web
```

Make sure to:

- Use the same volume name (`docs-mcp-data` in this example) as your server
- Map port 3000 with `-p 3000:3000`
- Pass any configuration environment variables with `-e` flags

### Using `npx Web Interface

If you're running the server with `npx`, use `npx` for the web interface as well:

```bash
npx -y --package=@arabold/docs-mcp-server docs-web
```

The `npx` approach will use the default data directory on your system (typically in your home directory), ensuring consistency between server and web interface.

## Using the CLI

You can use the CLI to manage documentation directly, either via Docker or npx. **Important: Use the same method (Docker or npx) for both the server and CLI to ensure access to the same indexed documentation.**

Here's how to invoke the CLI:

### Using Docker CLI

If you're running the server with Docker, use Docker for the CLI as well:

```bash
docker run --rm \
  -e OPENAI_API_KEY="your-openai-api-key-here" \
  -v docs-mcp-data:/data \
  ghcr.io/arabold/docs-mcp-server:latest \
  docs-cli <command> [options]
```

Make sure to use the same volume name (`docs-mcp-data` in this example) as you did for the server. Any of the configuration environment variables (see [Configuration](#configuration) above) can be passed using `-e` flags, just like with the server.

### Using `npx CLI

If you're running the server with npx, use `npx` for the CLI as well:

```bash
npx -y --package=@arabold/docs-mcp-server docs-cli <command> [options]
```

The `npx` approach will use the default data directory on your system (typically in your home directory), ensuring consistency between server and CLI.

The main commands available are:

- `scrape`: Scrapes and indexes documentation from a URL.
- `search`: Searches the indexed documentation.
- `list`: Lists all indexed libraries.
- `remove`: Removes indexed documentation.
- `fetch-url`: Fetches a single URL and converts to Markdown.
- `find-version`: Finds the best matching version for a library.

See the [CLI Command Reference](#cli-command-reference) below for detailed command usage.

## Configuration

The following environment variables are supported to configure the embedding model behavior:

### Embedding Model Configuration

- `DOCS_MCP_EMBEDDING_MODEL`: **Optional.** Format: `provider:model_name` or just `model_name` (defaults to `text-embedding-3-small`). Supported providers and their required environment variables:

  - `openai` (default): Uses OpenAI's embedding models

    - `OPENAI_API_KEY`: **Required.** Your OpenAI API key
    - `OPENAI_ORG_ID`: **Optional.** Your OpenAI Organization ID
    - `OPENAI_API_BASE`: **Optional.** Custom base URL for OpenAI-compatible APIs (e.g., Ollama, Azure OpenAI)

  - `vertex`: Uses Google Cloud Vertex AI embeddings

    - `GOOGLE_APPLICATION_CREDENTIALS`: **Required.** Path to service account JSON key file

  - `gemini`: Uses Google Generative AI (Gemini) embeddings

    - `GOOGLE_API_KEY`: **Required.** Your Google API key

  - `aws`: Uses AWS Bedrock embeddings

    - `AWS_ACCESS_KEY_ID`: **Required.** AWS access key
    - `AWS_SECRET_ACCESS_KEY`: **Required.** AWS secret key
    - `AWS_REGION` or `BEDROCK_AWS_REGION`: **Required.** AWS region for Bedrock

  - `microsoft`: Uses Azure OpenAI embeddings
    - `AZURE_OPENAI_API_KEY`: **Required.** Azure OpenAI API key
    - `AZURE_OPENAI_API_INSTANCE_NAME`: **Required.** Azure instance name
    - `AZURE_OPENAI_API_DEPLOYMENT_NAME`: **Required.** Azure deployment name
    - `AZURE_OPENAI_API_VERSION`: **Required.** Azure API version

### Vector Dimensions

The database schema uses a fixed dimension of 1536 for embedding vectors. Only models that produce vectors with dimension ≤ 1536 are supported, except for certain providers (like Gemini) that support dimension reduction.

For OpenAI-compatible APIs (like Ollama), use the `openai` provider with `OPENAI_API_BASE` pointing to your endpoint.

These variables can be set regardless of how you run the server (Docker, npx, or from source).

## Development & Advanced Setup

This section covers running the server/CLI directly from the source code for development purposes. The primary usage method is now via the public Docker image as described in "Method 2".

### Running from Source (Development)

This provides an isolated environment and exposes the server via HTTP endpoints.

This method is useful for contributing to the project or running un-published versions.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/arabold/docs-mcp-server.git # Replace with actual URL if different
    cd docs-mcp-server
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Build the project:**
    This compiles TypeScript to JavaScript in the `dist/` directory.
    ```bash
    npm run build
    ```
4.  **Setup Environment:**
    Create and configure your `.env` file as described in "Environment Setup" below. This is crucial for providing the `OPENAI_API_KEY`.

5.  **Run:**
    - **Server (Development Mode):** `npm run dev:server` (builds, watches, and restarts)
    - **Server (Production Mode):** `npm run start` (runs pre-built code)
    - **CLI:** `npm run cli -- <command> [options]` or `node dist/cli.js <command> [options]`

### Environment Setup (for Source/Docker)

**Note:** This `.env` file setup is primarily needed when running the server from source or using the Docker method. When using the `npx` integration method, the `OPENAI_API_KEY` is set directly in the MCP configuration file.

1. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Update your OpenAI API key in `.env`:

   ```
   # Required: Your OpenAI API key for generating embeddings.
   OPENAI_API_KEY=your-api-key-here

   # Optional: Your OpenAI Organization ID (handled automatically by LangChain if set)
   OPENAI_ORG_ID=

   # Optional: Custom base URL for OpenAI API (e.g., for Azure OpenAI or compatible APIs)
   OPENAI_API_BASE=

   # Optional: Embedding model name (defaults to "text-embedding-3-small")
   # Examples: text-embedding-3-large, text-embedding-ada-002
   DOCS_MCP_EMBEDDING_MODEL=

   # Optional: Specify a custom directory to store the SQLite database file (documents.db).
   # If set, this path takes precedence over the default locations.
   # Default behavior (if unset):
   # 1. Uses './.store/' in the project root if it exists (legacy).
   # 2. Falls back to OS-specific data directory (e.g., ~/Library/Application Support/docs-mcp-server on macOS).
   # DOCS_MCP_STORE_PATH=/path/to/your/desired/storage/directory
   ```

### Testing (from Source)

Since MCP servers communicate over stdio when run directly via Node.js, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script after building:

```bash
npx @modelcontextprotocol/inspector node dist/server.js
```

The Inspector will provide a URL to access debugging tools in your browser.

### Architecture

For details on the project's architecture and design principles, please see [ARCHITECTURE.md](ARCHITECTURE.md).

_Notably, the vast majority of this project's code was generated by the AI assistant Cline, leveraging the capabilities of this very MCP server._
