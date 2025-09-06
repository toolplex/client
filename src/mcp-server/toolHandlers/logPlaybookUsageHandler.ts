import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { LogPlaybookUsageParams } from "../../shared/mcpServerTypes.js";
import Registry from "../registry.js";

const logger = FileLogger;

export async function handleLogPlaybookUsage(
  params: LogPlaybookUsageParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  await logger.debug(
    `Handling log playbook usage request with params: ${JSON.stringify(params)}`,
  );

  const { playbook_id, success, error_message } = params;

  await logger.info(`Logging usage for playbook ${playbook_id}`);

  const apiService = Registry.getToolplexApiService();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const policyEnforcer = Registry.getPolicyEnforcer();
  const clientContext = Registry.getClientContext();

  try {
    // Check if the client is in restricted mode
    if (clientContext.clientMode === "restricted") {
      throw new Error("Playbook functionality is disabled in restricted mode.");
    }

    // Enforce playbook usage logging policy
    policyEnforcer.enforceLogPlaybookUsagePolicy();

    await apiService.logPlaybookUsage(playbook_id, success, error_message);

    await logger.info("Playbook usage logged successfully");

    await telemetryLogger.log("client_log_playbook_usage", {
      success: true,
      log_context: {
        playbook_id,
        success: success,
      },
      latency_ms: Date.now() - startTime,
    });

    return {
      content: [
        {
          type: "text",
          text: promptsCache.getPrompt("log_playbook_usage_success"),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`Failed to log playbook usage: ${errorMessage}`);

    await telemetryLogger.log("client_log_playbook_usage", {
      success: false,
      log_context: {
        playbook_id,
        success: success,
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
            .getPrompt("log_playbook_usage_failure")
            .replace("{ERROR}", errorMessage),
        },
      ],
    };
  }
}
