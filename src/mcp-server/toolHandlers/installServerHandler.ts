import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { StdioServerManagerClient } from "../../shared/stdioServerManagerClient.js";
import { ServerConfig, InstallParams } from "../../shared/mcpServerTypes.js";
import {
  ServerInstallResult,
  ServerInstallResultSchema,
  ListToolsResultSchema,
} from "../../shared/serverManagerTypes.js";
import Registry from "../registry.js";
import { RuntimeCheck } from "../utils/runtimeCheck.js";
import {
  sanitizeServerIdForLogging,
  validateServerIdOrThrow,
} from "../utils/serverIdValidator.js";
import { isAbsolute, parse } from "path";

const logger = FileLogger;

/**
 * Sanitizes ServerConfig for telemetry logging by extracting aggregate patterns
 * while avoiding PII exposure. This function extracts useful installation patterns
 * without logging sensitive data like file paths, API keys, or user-specific values.
 *
 * SECURITY: This function only logs metadata patterns, never actual values:
 * - Command names (not paths): "npx" vs "/Users/john/bin/tool"
 * - Argument flags (not values): "--port" vs actual port numbers
 * - Environment variable names (not values): "API_KEY" vs actual keys
 * - Path types for portability analysis: "absolute" vs "package_manager"
 */
function sanitizeServerConfig(config: ServerConfig) {
  // Extract command executable name without sensitive path information
  const extractCommandType = (command?: string): string => {
    if (!command) return "none";
    // For absolute paths, extract only the executable name (e.g., "/usr/bin/node" -> "node")
    if (isAbsolute(command)) {
      return parse(command).name;
    }
    // For relative commands, get the base command (e.g., "npx" from "npx --version")
    return (
      command
        .split(/[\s/\\]/)
        .pop()
        ?.split(".")[0] || "unknown"
    );
  };

  // Categorize path types for portability analysis - helps identify installation reliability patterns
  const detectPathType = (
    command?: string,
    args?: string[],
  ): "absolute" | "package_manager" | "system_command" => {
    if (!command) return "system_command";
    // Absolute paths indicate potential portability issues
    if (isAbsolute(command) || args?.some((arg) => isAbsolute(arg))) {
      return "absolute";
    }
    // Package managers are typically more reliable across systems
    if (["npx", "uvx", "pip", "yarn", "pnpm"].includes(command)) {
      return "package_manager";
    }
    return "system_command";
  };

  // Extract common argument flags and patterns (not values) for usage analysis
  const extractArgPatterns = (args?: string[]): string[] => {
    return (
      args?.filter(
        (arg) =>
          arg.startsWith("-") || // Command flags like --port, --config
          ["stdio", "mcp", "start", "latest", "@latest"].includes(arg), // Common MCP patterns
      ) || []
    );
  };

  // Extract environment variable names (not values) to understand integration patterns
  // SAFE: Only logs key names like "API_KEY", "DATABASE_URL" - never the actual values
  const extractEnvKeys = (env?: Record<string, string>): string[] => {
    if (!env) return [];
    return Object.keys(env).sort();
  };

  return {
    runtime: config.runtime || "node",
    transport: config.transport,
    command_type: extractCommandType(config.command),
    path_type: detectPathType(config.command, config.args),
    arg_patterns: extractArgPatterns(config.args),
    arg_count: config.args?.length || 0,
    env_keys: extractEnvKeys(config.env),
    env_count: config.env ? Object.keys(config.env).length : 0,
  };
}

async function installServer(
  serverId: string,
  serverName: string,
  description: string,
  serverManagerClient: StdioServerManagerClient,
  serverConfig: ServerConfig,
  timeoutMs?: number,
): Promise<ServerInstallResult> {
  await logger.info(`Starting installation of tool ${serverId}: ${serverName}`);
  await logger.debug(
    `Server config: ${JSON.stringify(serverConfig)}, Server ID: ${serverId}`,
  );

  const response = await serverManagerClient.sendRequest(
    "install",
    {
      server_id: serverId,
      server_name: serverName,
      description: description,
      config: serverConfig,
    },
    timeoutMs,
  );

  if ("error" in response) {
    const error = `Server installation failed: ${response.error.message}`;
    await logger.error(error);
    throw new Error(error);
  }

  const parsed = ServerInstallResultSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error(
      `Invalid server install response: ${JSON.stringify(parsed.error.errors)}`,
    );
  }

  logger.debug(`Install response: ${JSON.stringify(response)}`);

  if (!response) {
    const error = "Server installation failed: No response received";
    await logger.error(error);
    throw new Error(error);
  }

  await logger.info(`Successfully installed tool ${serverId}`);
  return parsed.data;
}

export async function handleInstallServer(
  params: InstallParams,
): Promise<CallToolResult> {
  const serverManagerClients = Registry.getServerManagerClients();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const serversCache = Registry.getServersCache();
  const clientContext = Registry.getClientContext();
  const policyEnforcer = Registry.getPolicyEnforcer();
  const installObserver = policyEnforcer.getInstallObserver();
  const startTime = Date.now();
  let errorMessage: string | undefined;

  try {
    // Check if the client is in restricted mode
    if (clientContext.clientMode === "restricted") {
      throw new Error("Install functionality is disabled in restricted mode.");
    }

    const { config, server_id, server_name } = params;
    const description = params.description || server_name;

    if (!config || !server_id || !server_name) {
      throw new Error("Missing required install parameters");
    }

    // Validate server ID format
    validateServerIdOrThrow(server_id);

    // Validate stdio transport configuration early to avoid timeouts
    if (config.transport === "stdio") {
      // Validate that command is provided
      if (!config.command) {
        throw new Error("Command is required for stdio transport");
      }

      // Validate command is installed
      await RuntimeCheck.validateCommandOrThrow(config.command);

      // Check that args is provided and not empty for package managers
      // Package managers like npx, uvx, pnpm dlx, etc. require a package name as first arg
      const command = config.command.toLowerCase();
      const requiresPackageName = ["npx", "uvx", "pnpm", "yarn"].some((pm) =>
        command.includes(pm),
      );

      if (requiresPackageName && (!config.args || config.args.length === 0)) {
        throw new Error(
          `Package manager command '${config.command}' requires args to specify package name. Received args: ${config.args ? "[]" : "undefined"}`,
        );
      }
    } else if (config.command) {
      // For non-stdio transports, still validate command if provided
      await RuntimeCheck.validateCommandOrThrow(config.command);
    }

    // Check if server is disallowed using policy enforcer
    policyEnforcer.enforceUseServerPolicy(server_id);

    const runtime = config.runtime || "node";

    const runtimeKey = "node";
    const client = serverManagerClients[runtimeKey];

    // Keep for now -- may add separate server managers for different runtimes if needed.
    if (!client) {
      throw new Error(`Unsupported runtime: ${runtime}`);
    }

    // Install server
    const installResult = await installServer(
      server_id,
      server_name,
      description,
      client,
      config,
      params.timeout_ms,
    );

    // After successful install, refresh the servers cache
    await serversCache.refreshCache(serverManagerClients);

    // List tools on the newly installed server
    const toolsResponse = await client.sendRequest("list_tools", {
      server_id: installResult.server_id,
    });

    if ("error" in toolsResponse) {
      throw new Error(
        `Failed to list tools for server_id ${installResult.server_id}, error message: ${toolsResponse.error.message}`,
      );
    }

    const parsed = ListToolsResultSchema.safeParse(toolsResponse);
    if (!parsed.success) {
      throw new Error(
        `Invalid list_tools response: ${JSON.stringify(parsed.error.errors)}, response was: ${JSON.stringify(toolsResponse)}`,
      );
    }

    const tools = parsed.data.tools || [];

    await telemetryLogger.log("client_install", {
      success: true,
      log_context: {
        server_id: sanitizeServerIdForLogging(installResult.server_id),
        sanitized_config: sanitizeServerConfig(config),
      },
      latency_ms: Date.now() - startTime,
    });

    // Return structured JSON for clean UI rendering
    const response = {
      success: true,
      server_id: installResult.server_id,
      server_name: installResult.server_name,
      message: `Successfully installed server ${installResult.server_id} (${installResult.server_name})`,
      tools: tools,
      tool_count: tools.length,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error: unknown) {
    errorMessage =
      error instanceof Error
        ? error.message
        : promptsCache.getPrompt("unexpected_error");
    await logger.error(`Installation failed: ${errorMessage}`);

    await telemetryLogger.log("client_install", {
      success: false,
      log_context: {
        server_id: sanitizeServerIdForLogging(params.server_id),
      },
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    // Return structured error JSON
    const errorResponse = {
      success: false,
      error: errorMessage,
      server_id: params.server_id,
    };

    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
    };
  } finally {
    // Record the install action regardless of success or failure
    installObserver.recordInstall(params.server_id);
  }
}
