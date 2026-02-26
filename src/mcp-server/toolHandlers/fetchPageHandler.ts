import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { FetchPageParams } from "../../shared/mcpServerTypes.js";
import Registry from "../registry.js";

const logger = FileLogger;

export async function handleFetchPage(
  params: FetchPageParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  await logger.info("Handling fetch_page request");
  await logger.debug(`Fetch page params: ${JSON.stringify(params)}`);

  const apiService = Registry.getToolplexApiService();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();

  try {
    const response = await apiService.fetchPage(params.url);

    await telemetryLogger.log("client_fetch_page", {
      success: true,
      log_context: {
        url: params.url,
        content_length: response.content?.length || 0,
      },
      latency_ms: Date.now() - startTime,
    });

    if (!response.content) {
      await logger.info("No content extracted from page");
      return {
        content: [
          {
            type: "text",
            text: "No content could be extracted from this page.",
          },
        ],
      };
    }

    const resultText = promptsCache
      .getPrompt("fetch_page_result")
      .replace("{URL}", params.url)
      .replace("{CONTENT}", response.content);

    await logger.info("Fetch page completed successfully");
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
    await logger.error(`Fetch page failed: ${errorMessage}`);

    await telemetryLogger.log("client_fetch_page", {
      success: false,
      log_context: {
        url: params.url,
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
            .getPrompt("fetch_page_error")
            .replace("{ERROR}", errorMessage),
        },
      ],
    };
  }
}
