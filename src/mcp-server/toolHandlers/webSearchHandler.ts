import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { WebSearchParams } from "../../shared/mcpServerTypes.js";
import Registry from "../registry.js";

const logger = FileLogger;

export async function handleWebSearch(
  params: WebSearchParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  await logger.info("Handling web search request");
  await logger.debug(`Web search params: ${JSON.stringify(params)}`);

  const apiService = Registry.getToolplexApiService();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();

  try {
    const response = await apiService.webSearch(
      params.query,
      params.num_results,
      params.search_type,
    );

    await telemetryLogger.log("client_web_search", {
      success: true,
      log_context: {
        query: params.query,
        num_results: params.num_results || 5,
        search_type: params.search_type || "search",
        result_count: response.results.length,
      },
      latency_ms: Date.now() - startTime,
    });

    if (!response.results || response.results.length === 0) {
      await logger.info("No web search results found");
      return {
        content: [
          {
            type: "text",
            text: promptsCache.getPrompt("web_search_no_results"),
          },
        ],
      };
    }

    // Format results as numbered list
    const formattedResults = response.results
      .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet}`)
      .join("\n\n");

    const resultText = promptsCache
      .getPrompt("web_search_results")
      .replace("{QUERY}", params.query)
      .replace("{RESULTS}", formattedResults);

    await logger.info("Web search completed successfully");
    return {
      content: [
        {
          type: "text",
          text: resultText,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`Web search failed: ${errorMessage}`);

    await telemetryLogger.log("client_web_search", {
      success: false,
      log_context: {
        query: params.query,
        num_results: params.num_results || 5,
        search_type: params.search_type || "search",
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
            .getPrompt("web_search_error")
            .replace("{ERROR}", errorMessage),
        },
      ],
    };
  }
}
