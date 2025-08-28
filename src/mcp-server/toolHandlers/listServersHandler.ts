import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { ListServersResultSchema } from "../../shared/serverManagerTypes.js";
import Registry from "../registry.js";

const logger = FileLogger;

export async function handleListServers(): Promise<CallToolResult> {
  const startTime = Date.now();
  const serverManagerClients = Registry.getServerManagerClients();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const serversCache = Registry.getServersCache();
  const policyEnforcer = Registry.getPolicyEnforcer();

  try {
    await logger.debug("Listing all installed servers");

    // Collect all servers for updating the cache
    const allServers: Array<{
      server_id: string;
      server_name: string;
      description: string;
    }> = [];

    for (const [runtime, client] of Object.entries(serverManagerClients)) {
      const response_data = await client.sendRequest("list_servers", {});
      if (response_data.error) {
        continue;
      }

      const parsed = ListServersResultSchema.safeParse(response_data);
      if (!parsed.success) {
        await logger.error(
          `Invalid response from server manager: ${parsed.error}, runtime: ${runtime}`,
        );
        continue;
      }

      if (parsed.data.servers && parsed.data.servers.length > 0) {
        // Filter out blocked servers
        const filteredServers = policyEnforcer.filterBlockedMcpServers(
          parsed.data.servers,
          (server) => server.server_id,
        );

        filteredServers.forEach((server) => {
          // Add to allServers for cache update and structured response
          allServers.push({
            server_id: server.server_id,
            server_name: server.server_name,
            description: server.description,
          });
        });
      }
    }

    // Update the servers cache with the fresh list
    serversCache.updateServers(allServers);

    await logger.debug("Successfully retrieved servers list");

    await telemetryLogger.log("client_list_servers", {
      success: true,
      latency_ms: Date.now() - startTime,
    });

    // Build response content
    if (allServers.length === 0) {
      return {
        role: "system",
        content: [
          {
            type: "text",
            text: promptsCache.getPrompt("list_servers_empty"),
          },
        ],
      };
    }

    return {
      role: "system",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            servers: allServers,
            count: allServers.length,
          }),
        },
        {
          type: "text",
          text: `Found ${allServers.length} installed MCP server${allServers.length !== 1 ? "s" : ""}`,
        },
      ],
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : promptsCache.getPrompt("unexpected_error");
    await logger.error(`Failed to list servers: ${errorMessage}`);

    await telemetryLogger.log("client_list_servers", {
      success: false,
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    return {
      role: "system",
      content: [
        {
          type: "text",
          text: promptsCache
            .getPrompt("unexpected_error")
            .replace("{ERROR}", errorMessage),
        },
      ],
    };
  }
}
