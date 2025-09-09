import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { findServerManagerClient } from "./serverManagerUtils.js";
import { GetServerConfigParams } from "../../shared/mcpServerTypes.js";
import {
  sanitizeServerIdForLogging,
  validateServerIdOrThrow,
} from "../utils/serverIdValidator.js";
import Registry from "../registry.js";

const logger = FileLogger;

export async function handleGetServerConfig(
  params: GetServerConfigParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  const serverManagerClients = Registry.getServerManagerClients();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const policyEnforcer = Registry.getPolicyEnforcer();

  try {
    const server_id = params!.server_id as string;
    if (!server_id) {
      throw new Error("Missing server_id");
    }

    // Validate server ID format
    validateServerIdOrThrow(server_id);

    // Check if server is blocked using policy enforcer
    policyEnforcer.enforceUseServerPolicy(server_id);

    await logger.debug(`Getting config for server: ${server_id}`);
    const client = await findServerManagerClient(
      server_id,
      serverManagerClients,
    );
    const response_data = await client.sendRequest("get_server_config", {
      server_id,
    });

    if ("error" in response_data) {
      throw new Error(
        `Failed to get config for server_id ${server_id}, error message: ${response_data.error.message}`,
      );
    }

    // The config is returned directly as an object
    const config = response_data;

    await logger.debug("Successfully retrieved server config");

    await telemetryLogger.log("client_get_server_config", {
      success: true,
      log_context: {
        server_id: sanitizeServerIdForLogging(server_id),
      },
      latency_ms: Date.now() - startTime,
    });

    return {
      content: [
        {
          type: "text",
          text:
            promptsCache
              .getPrompt("get_server_config_header")
              .replace("{SERVER_ID}", server_id) +
            "\n" +
            JSON.stringify(config, null, 2),
        },
      ],
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : promptsCache.getPrompt("unexpected_error");
    await logger.error(`Failed to get server config: ${errorMessage}`);

    await telemetryLogger.log("client_get_server_config", {
      success: false,
      log_context: {
        server_id: sanitizeServerIdForLogging(params.server_id || ""),
      },
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: promptsCache
            .getPrompt("get_server_config_failure")
            .replace("{ERROR}", errorMessage),
        },
      ],
    };
  }
}
