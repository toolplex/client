import { serve } from "./toolplexServer.js";
import dotenv from "dotenv";
import {
  ToolplexServerConfig,
  ClientMode,
  LogLevel,
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

if (!apiKey) {
  process.exit(1);
}

const config: ToolplexServerConfig = {
  dev: isDev,
  apiKey,
  clientMode,
  clientName,
  logLevel,
};

serve(config).catch(() => {
  process.exit(1);
});
