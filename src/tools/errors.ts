import semver from "semver";

class ToolError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class VersionNotFoundError extends ToolError {
  constructor(
    public readonly library: string,
    public readonly requestedVersion: string,
    public readonly availableVersions: Array<{
      version: string;
      indexed: boolean;
    }>,
  ) {
    super(
      `Version ${requestedVersion} not found for ${library}. Available versions: ${availableVersions.map((v) => v.version).join(", ")}`,
      "SearchTool",
    );
  }

  getLatestVersion() {
    return this.availableVersions.sort((a, b) => semver.compare(b.version, a.version))[0];
  }
}

export { ToolError, VersionNotFoundError };
