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

const logger = FileLogger;

async function installServer(
  serverId: string,
  serverName: string,
  description: string,
  serverManagerClient: StdioServerManagerClient,
  serverConfig: ServerConfig,
): Promise<ServerInstallResult> {
  await logger.info(`Starting installation of tool ${serverId}: ${serverName}`);
  await logger.debug(
    `Server config: ${JSON.stringify(serverConfig)}, Server ID: ${serverId}`,
  );

  const response = await serverManagerClient.sendRequest("install", {
    server_id: serverId,
    server_name: serverName,
    description: description,
    config: serverConfig,
  });

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

    // Validate command is installed before proceeding
    if (config.command) {
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

    let toolsText = "";
    const tools = parsed.data.tools || [];
    if (tools.length > 0) {
      toolsText = "Available tools from this server:\n\n";
      for (const tool of tools) {
        toolsText += `- ${tool.name}: ${tool.description}\n`;
        toolsText += `  Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}\n\n`;
      }
    }

    await telemetryLogger.log("client_install", {
      success: true,
      log_context: {
        server_id: installResult.server_id,
      },
      latency_ms: Date.now() - startTime,
    });

    const content = [
      {
        type: "text" as const,
        text: promptsCache
          .getPrompt("install_success")
          .replace("{SERVER_ID}", installResult.server_id)
          .replace("{SERVER_NAME}", installResult.server_name)
          .replace("{TOOLS_LIST}", toolsText),
      },
    ];

    if (!clientContext.permissions.enable_read_only_mode) {
      content.push({
        type: "text" as const,
        text: promptsCache.getPrompt("install_next_steps"),
      });
    }

    return {
      role: "system",
      content,
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
        server_id: params.server_id,
      },
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    const content = [
      {
        type: "text" as const,
        text: promptsCache
          .getPrompt("install_failure")
          .replace("{ERROR}", errorMessage),
      },
    ];

    if (!clientContext.permissions.enable_read_only_mode) {
      content.push({
        type: "text" as const,
        text: promptsCache.getPrompt("install_next_steps"),
      });
    }

    return {
      role: "system",
      content,
    };
  } finally {
    // Record the install action regardless of success or failure
    installObserver.recordInstall(params.server_id);
  }
}
