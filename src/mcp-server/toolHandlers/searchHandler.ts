import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { SearchParams } from "../../shared/mcpServerTypes.js";
import Registry from "../registry.js";
import { ServersCache } from "../serversCache.js";
import { annotateInstalledServers } from "../utils/resultAnnotators.js";

const logger = FileLogger;

export async function handleSearchTool(
  params: SearchParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  await logger.info("Handling search request");
  await logger.debug(`Search params: ${JSON.stringify(params)}`);

  const apiService = Registry.getToolplexApiService();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const serversCache: ServersCache = Registry.getServersCache();
  const clientContext = Registry.getClientContext();
  const query = params.query;
  const expandedKeywords = params.expanded_keywords || [];
  const filter = params.filter || "all";
  const size = params.size || 10;
  const scope = params.scope || "all";

  try {
    // Check if the client is in restricted mode
    if (clientContext.clientMode === "restricted") {
      throw new Error("Search functionality is disabled in restricted mode.");
    }

    const results = await apiService.search(
      query,
      expandedKeywords,
      filter,
      size,
      scope,
    );

    // Log telemetry event
    await telemetryLogger.log("client_search", {
      success: true,
      log_context: {
        filter,
        size,
        scope,
        num_expanded_keywords: expandedKeywords.length,
        num_results:
          (results.mcp_servers?.length ?? -1) +
          (results.playbooks?.length ?? -1),
      },
      latency_ms: Date.now() - startTime,
    });

    const mcpServers = Array.isArray(results.mcp_servers)
      ? results.mcp_servers
      : [];
    const playbooks = Array.isArray(results.playbooks) ? results.playbooks : [];
    const totalResults = mcpServers.length + playbooks.length;

    // Annotate installed servers using resultAnnotators
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let annotatedServers: any[] = [];
    if (mcpServers.length > 0) {
      try {
        annotatedServers = annotateInstalledServers(mcpServers, serversCache);
      } catch (err) {
        await logger.warn(`Error annotating installed servers: ${err}`);
        annotatedServers = mcpServers;
      }
    }

    if (totalResults === 0) {
      await logger.info("No search results found");
      return {
        role: "system",
        content: [
          {
            type: "text",
            text: promptsCache.getPrompt("search_no_results"),
          },
        ],
      };
    }

    await logger.debug(`Found ${totalResults} results`);

    // Build structured response content
    const content = [
      // First: Structured JSON for easy parsing
      {
        type: "text",
        text: JSON.stringify({
          query,
          expanded_keywords: expandedKeywords,
          filter,
          scope,
          size,
          servers: annotatedServers,
          playbooks,
          server_count: annotatedServers.length,
          playbook_count: playbooks.length,
          total_results: totalResults,
        }),
      } as { [x: string]: unknown; type: "text"; text: string },

      // Second: Human-readable summary
      {
        type: "text",
        text: `Found ${totalResults} results for "${query}": ${annotatedServers.length} servers, ${playbooks.length} playbooks`,
      } as { [x: string]: unknown; type: "text"; text: string },
    ];

    await logger.info("Search completed successfully");
    return {
      role: "system",
      content,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`Search failed: ${errorMessage}`);

    await telemetryLogger.log("client_search", {
      success: false,
      log_context: {
        filter,
        size,
        scope,
        num_expanded_keywords: expandedKeywords.length,
      },
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
