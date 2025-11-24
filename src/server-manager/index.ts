import { ServerManagerProtocol } from "./stdioServer.js";
import { FileLogger } from "../shared/fileLogger.js";
import Registry from "../mcp-server/registry.js";

FileLogger.initialize("server-manager");

// Initialize bundled dependencies from environment variables.
// These are passed from the MCP server process which received them from Electron.
// This is critical for proper command resolution (e.g., npx -> node + npx-cli.js).
//
// NOTE: We do NOT call Registry.init() here because that does heavy initialization
// (API services, caches, etc.) that the server-manager doesn't need. We only need
// the bundled dependency paths for command resolution.
function initializeBundledDeps() {
  const bundledDependencies = {
    node: process.env.TOOLPLEX_NODE_PATH,
    npm: process.env.TOOLPLEX_NPM_PATH,
    npx: process.env.TOOLPLEX_NPX_PATH,
    python: process.env.TOOLPLEX_PYTHON_PATH,
    pip: process.env.TOOLPLEX_PIP_PATH,
    uv: process.env.TOOLPLEX_UV_PATH,
    uvx: process.env.TOOLPLEX_UVX_PATH,
    git: process.env.TOOLPLEX_GIT_PATH,
  };

  // Only set if we have at least one bundled dep
  const hasAnyBundledDep = Object.values(bundledDependencies).some(Boolean);
  if (hasAnyBundledDep) {
    Registry.setBundledDependencies(bundledDependencies);
    FileLogger.debug(
      `Server-manager initialized with bundled deps: ${JSON.stringify(bundledDependencies)}`,
    );
  }
}

// Initialize bundled deps and start
initializeBundledDeps();

const protocol = new ServerManagerProtocol();
protocol.start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
