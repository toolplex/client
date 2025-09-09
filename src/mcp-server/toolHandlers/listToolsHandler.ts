import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { findServerManagerClient } from "./serverManagerUtils.js";
import { ListToolplexToolsParams } from "../../shared/mcpServerTypes.js";
import {
  ListToolsResultSchema,
  ListAllToolsResultSchema,
} from "../../shared/serverManagerTypes.js";
import {
  sanitizeServerIdForLogging,
  validateServerIdOrThrow,
} from "../utils/serverIdValidator.js";
import Registry from "../registry.js";

const logger = FileLogger;

export async function handleListTools(
  params: ListToolplexToolsParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  const serverManagerClients = Registry.getServerManagerClients();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const policyEnforcer = Registry.getPolicyEnforcer();

  try {
    const server_id = params!.server_id as string;
    const content = [];

    if (server_id) {
      // Validate server ID format
      validateServerIdOrThrow(server_id);

      // Check if server is blocked using policy enforcer
      policyEnforcer.enforceUseServerPolicy(server_id);

      await logger.debug(`Listing tools for specific server: ${server_id}`);
      const client = await findServerManagerClient(
        server_id,
        serverManagerClients,
      );
      const response_data = await client.sendRequest("list_tools", {
        server_id: server_id,
      });
      if ("error" in response_data) {
        throw new Error(
          `Failed to list tools for server_id ${server_id}, error message: ${response_data.error.message}`,
        );
      }

      const parsed = ListToolsResultSchema.safeParse(response_data);
      if (!parsed.success) {
        throw new Error(
          `Invalid response from server manager: ${parsed.error}`,
        );
      }

      const tools = parsed.data.tools || [];

      if (tools.length > 0) {
        // First: Structured JSON for easy parsing
        content.push({
          type: "text",
          text: JSON.stringify({
            server_id: parsed.data.server_id,
            server_name: parsed.data.server_name,
            tools: tools,
            tool_count: tools.length,
          }),
        } as { [x: string]: unknown; type: "text"; text: string });

        // Second: Human-readable summary
        content.push({
          type: "text",
          text: `Available tools from server '${parsed.data.server_name}' (${parsed.data.server_id}): ${tools.length} tool${tools.length !== 1 ? "s" : ""}`,
        } as { [x: string]: unknown; type: "text"; text: string });
      } else {
        content.push({
          type: "text",
          text: promptsCache.getPrompt("list_tools_empty"),
        } as { [x: string]: unknown; type: "text"; text: string });
      }
    } else {
      await logger.debug("Listing tools from all installed servers");
      const allServerTools: Array<{
        server_id: string;
        tools: unknown[];
      }> = [];

      for (const [runtime, client] of Object.entries(serverManagerClients)) {
        const response_data = await client.sendRequest("list_all_tools", {});
        if (response_data.error) {
          continue;
        }

        const parsed = ListAllToolsResultSchema.safeParse(response_data);
        if (!parsed.success) {
          await logger.error(
            `Invalid response from server manager: ${parsed.error}, runtime: ${runtime}`,
          );
          continue;
        }

        // Filter out blocked servers
        const serverEntries = Object.entries(parsed.data.tools);
        const filteredEntries = policyEnforcer.filterBlockedMcpServers(
          serverEntries,
          ([serverId]) => serverId,
        );

        for (const [serverId, serverTools] of filteredEntries) {
          if (serverTools && serverTools.length > 0) {
            allServerTools.push({
              server_id: serverId,
              tools: serverTools,
            });
          }
        }
      }

      if (allServerTools.length > 0) {
        const totalTools = allServerTools.reduce(
          (sum, server) => sum + server.tools.length,
          0,
        );

        // First: Structured JSON for easy parsing
        content.push({
          type: "text",
          text: JSON.stringify({
            server_tools: allServerTools,
            server_count: allServerTools.length,
            total_tools: totalTools,
          }),
        } as { [x: string]: unknown; type: "text"; text: string });

        // Second: Human-readable summary
        content.push({
          type: "text",
          text: `Found ${totalTools} tools across ${allServerTools.length} server${allServerTools.length !== 1 ? "s" : ""}`,
        } as { [x: string]: unknown; type: "text"; text: string });
      } else {
        content.push({
          type: "text",
          text: promptsCache.getPrompt("list_tools_empty"),
        } as { [x: string]: unknown; type: "text"; text: string });
      }
    }

    await logger.debug("Successfully retrieved tools list");

    await telemetryLogger.log("client_list_tools", {
      success: true,
      log_context: {
        server_id: sanitizeServerIdForLogging(params.server_id || ""),
      },
      latency_ms: Date.now() - startTime,
    });

    return {
      content,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : promptsCache.getPrompt("unexpected_error");
    await logger.error(`Failed to list tools: ${errorMessage}`);

    await telemetryLogger.log("client_list_tools", {
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
            .getPrompt("list_tools_failure")
            .replace("{ERROR}", errorMessage),
        },
      ],
    };
  }
}
