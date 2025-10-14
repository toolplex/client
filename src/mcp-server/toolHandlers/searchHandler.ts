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

    // Handle both unified format (entities) and legacy format (mcp_servers/playbooks)
    let totalResults = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let servers: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let playbooks: any[] = [];

    if (results.entities) {
      // Unified format (v0.1.16+) - split entities by type for annotation
      totalResults = results.entities.length;
      servers = results.entities.filter(
        (e: any) => e.type === "server" || e.server_id, // eslint-disable-line @typescript-eslint/no-explicit-any
      );
      playbooks = results.entities.filter(
        (e: any) => e.type === "playbook" || e.playbook_id, // eslint-disable-line @typescript-eslint/no-explicit-any
      );
    } else {
      // Legacy format (< v0.1.16) - separate arrays
      servers = Array.isArray(results.mcp_servers) ? results.mcp_servers : [];
      playbooks = Array.isArray(results.playbooks) ? results.playbooks : [];
      totalResults = servers.length + playbooks.length;
    }

    // Log telemetry event
    await telemetryLogger.log("client_search", {
      success: true,
      log_context: {
        filter,
        size,
        scope,
        num_expanded_keywords: expandedKeywords.length,
        num_results: totalResults,
      },
      latency_ms: Date.now() - startTime,
    });

    if (totalResults === 0) {
      await logger.info("No search results found");
      return {
        content: [
          {
            type: "text",
            text: promptsCache.getPrompt("search_no_results"),
          },
        ],
      };
    }

    await logger.debug(`Found ${totalResults} results`);

    // Annotate installed servers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let annotatedServers: any[] = servers;
    if (servers.length > 0) {
      try {
        annotatedServers = annotateInstalledServers(servers, serversCache);
      } catch (err) {
        await logger.warn(`Error annotating installed servers: ${err}`);
      }
    }

    // Rebuild response in the same format we received it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let responseData: any;
    if (results.entities) {
      // Unified format - rebuild entities array preserving backend ranking
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const annotatedEntities = results.entities.map((entity: any) => {
        if (entity.type === "server" || entity.server_id) {
          // Find annotated version
          const annotated = annotatedServers.find(
            (s: any) => s.server_id === (entity.server_id || entity.id), // eslint-disable-line @typescript-eslint/no-explicit-any
          );
          return annotated || entity;
        }
        return entity;
      });

      responseData = {
        query,
        expanded_keywords: expandedKeywords,
        filter,
        scope,
        size,
        entities: annotatedEntities,
        total_results: totalResults,
      };
    } else {
      // Legacy format - return separate arrays
      responseData = {
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
      };
    }

    // Build structured response content
    const content = [
      // First: Structured JSON for easy parsing
      {
        type: "text",
        text: JSON.stringify(responseData),
      } as { [x: string]: unknown; type: "text"; text: string },
      {
        type: "text",
        text: promptsCache.getPrompt("search_results_footer"),
        _meta: { role: "system" },
      } as { [x: string]: unknown; type: "text"; text: string },
    ];

    await logger.info("Search completed successfully");
    return {
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
      isError: true,
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
