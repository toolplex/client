import { serve } from "./toolplexServer.js";
import dotenv from "dotenv";
import {
  ToolplexServerConfig,
  ClientMode,
  LogLevel,
  BundledDependencies,
} from "../shared/mcpServerTypes.js";
import { FileLogger } from "../shared/fileLogger.js";

dotenv.config();

FileLogger.initialize("mcp-server");

const isDev: boolean = process.env.DEV === "true";
const apiKey: string | undefined = process.env.TOOLPLEX_API_KEY;
const clientMode: ClientMode =
  (process.env.TOOLPLEX_CLIENT_MODE as ClientMode) || "standard";
const clientName: string = process.env.CLIENT_NAME || "unknown";
const logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

// Read bundled dependency paths from environment variables
// These are provided by the host application (e.g., Electron desktop)
const bundledDependencies: BundledDependencies = {
  node: process.env.TOOLPLEX_NODE_PATH,
  python: process.env.TOOLPLEX_PYTHON_PATH,
  git: process.env.TOOLPLEX_GIT_PATH,
  uvx: process.env.TOOLPLEX_UVX_PATH,
  npx: process.env.TOOLPLEX_NPX_PATH,
};

if (!apiKey) {
  process.exit(1);
}

const config: ToolplexServerConfig = {
  dev: isDev,
  apiKey,
  clientMode,
  clientName,
  logLevel,
  bundledDependencies,
};

serve(config).catch(() => {
  process.exit(1);
});
