# Documentation MCP Server Architecture

## Overview

The Documentation MCP Server is designed with a modular architecture that ensures feature parity and code reuse between its two main interfaces:

1. Command Line Interface (CLI)
2. Model Context Protocol (MCP) Server

## Core Design Principles

### 1. Shared Tooling

The project maintains a `tools/` directory containing modular implementations of core functionality. This design choice ensures that:

- Both CLI and MCP server use the same underlying business logic
- Features are implemented once and reused across interfaces
- Changes to functionality only need to be made in one place
- Testing is simplified as core logic is isolated from interface concerns

### 2. Tool Structure

Each tool in the `tools/` directory follows a consistent pattern:

```typescript
// Example tool structure (tools/example.ts)
export interface ToolOptions {
  // Input parameters
}

export interface ToolResult {
  // Output structure
}

export const toolFunction = async (
  options: ToolOptions
): Promise<ToolResult> => {
  // Core implementation
};
```

Current tools include:

- `scrape.ts` - Documentation scraping functionality
- `search.ts` - Search capabilities
- `library.ts` - Library version management
- `document.ts` - Document management operations

### 3. Interface-Specific Adapters

#### CLI (cli.ts)

- Uses Commander.js for command-line argument parsing
- Converts command-line arguments to tool options
- Formats tool results for console output
- Handles CLI-specific error reporting

```typescript
// Example CLI usage
program.command("example <arg>").action(async (arg) => {
  const result = await toolFunction({
    // Convert CLI args to tool options
  });
  console.log(formatOutput(result));
});
```

#### MCP Server (index.ts)

- Implements MCP protocol for AI interaction
- Wraps tool functions in MCP tool definitions
- Formats results as MCP responses
- Provides progress feedback through MCP protocol

```typescript
// Example MCP tool registration
server.tool(
  "example_tool",
  {
    // Zod schema for parameters
  },
  async (params) => {
    const result = await toolFunction({
      // Convert MCP params to tool options
    });
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);
```

### 4. Progress Reporting

Tools that involve long-running operations support progress reporting through callback functions. This allows both interfaces to provide appropriate feedback:

- CLI: Console output with progress information
- MCP: Structured progress updates through the MCP protocol

## Benefits

1. **Maintainability**

   - Single source of truth for business logic
   - Clear separation of concerns
   - Easier to test and debug

2. **Feature Parity**

   - Guaranteed same functionality in both interfaces
   - Consistent behavior and error handling

3. **Extensibility**
   - Easy to add new tools
   - Simple to add new interfaces (e.g., REST API) using same tools

## Future Considerations

When adding new functionality:

1. Implement core logic in a new tool under `tools/`
2. Add CLI command in `cli.ts`
3. Add MCP tool in `index.ts`
4. Maintain consistent error handling and progress reporting

## Directory Structure

```
src/
├── tools/           # Shared core functionality
│   ├── scrape.ts
│   ├── search.ts
│   ├── library.ts
│   └── document.ts
├── cli.ts          # CLI interface
├── index.ts        # MCP server interface
├── types/          # Shared type definitions
├── store/          # Vector store implementation
├── scraper/        # Web scraping implementation
└── utils/          # Shared utilities
```
