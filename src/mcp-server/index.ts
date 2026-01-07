import { serve } from "./toolplexServer.js";
import dotenv from "dotenv";
import {
  ToolplexServerConfig,
  ClientMode,
  LogLevel,
  BundledDependencies,
} from "../shared/mcpServerTypes.js";
import { FileLogger } from "../shared/fileLogger.js";
import type { AutomationContext } from "./toolplexApi/types.js";

dotenv.config();

FileLogger.initialize("mcp-server");

const isDev: boolean = process.env.DEV === "true";
const apiKey: string | undefined = process.env.TOOLPLEX_API_KEY;
// CLIENT_MODE can come from ai-engine (automation mode) or TOOLPLEX_CLIENT_MODE (legacy)
const clientMode: ClientMode =
  (process.env.CLIENT_MODE as ClientMode) ||
  (process.env.TOOLPLEX_CLIENT_MODE as ClientMode) ||
  "standard";
const clientName: string = process.env.CLIENT_NAME || "unknown";
const logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
// Optional user ID for per-user telemetry (system API keys only)
const userId: string | undefined = process.env.TOOLPLEX_USER_ID;

// Read bundled dependency paths from environment variables
// These are provided by the host application (e.g., Electron desktop)
const bundledDependencies: BundledDependencies = {
  node: process.env.TOOLPLEX_NODE_PATH,
  npm: process.env.TOOLPLEX_NPM_PATH,
  npx: process.env.TOOLPLEX_NPX_PATH,
  python: process.env.TOOLPLEX_PYTHON_PATH,
  pip: process.env.TOOLPLEX_PIP_PATH,
  uv: process.env.TOOLPLEX_UV_PATH,
  uvx: process.env.TOOLPLEX_UVX_PATH,
  git: process.env.TOOLPLEX_GIT_PATH,
};

// Parse session resume history for restored chat sessions
// This allows the enforcement layer to validate save_playbook and submit_feedback
// based on historical tool usage from the database
let sessionResumeHistory:
  | {
      tool_calls: Array<{ server_id: string; tool_name: string }>;
      installs: Array<{ server_id: string }>;
      uninstalls: Array<{ server_id: string }>;
    }
  | undefined;

if (process.env.TOOLPLEX_SESSION_RESUME_HISTORY) {
  try {
    sessionResumeHistory = JSON.parse(
      process.env.TOOLPLEX_SESSION_RESUME_HISTORY,
    );

    FileLogger.info(
      `Parsed session resume history - ` +
        `${sessionResumeHistory?.tool_calls.length || 0} tool calls, ` +
        `${sessionResumeHistory?.installs.length || 0} installs, ` +
        `${sessionResumeHistory?.uninstalls.length || 0} uninstalls`,
    );
  } catch (error) {
    FileLogger.warn(`Failed to parse session resume history: ${error}`);
  }
}

// Parse automation context for HITL support (only in automation mode)
let automationContext: AutomationContext | undefined;

if (process.env.AUTOMATION_CONTEXT) {
  try {
    automationContext = JSON.parse(process.env.AUTOMATION_CONTEXT);

    FileLogger.info(
      `Parsed automation context - ` +
        `automationId: ${automationContext?.automationId}, ` +
        `runId: ${automationContext?.runId}, ` +
        `toolsRequiringApproval: ${automationContext?.toolsRequiringApproval?.length || 0}`,
    );
  } catch (error) {
    FileLogger.warn(`Failed to parse automation context: ${error}`);
  }
}

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
  sessionResumeHistory,
  userId,
  automationContext,
};

serve(config).catch(() => {
  process.exit(1);
});
