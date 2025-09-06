import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { SavePlaybookParams } from "../../shared/mcpServerTypes.js";
import Registry from "../registry.js";

const logger = FileLogger;

export async function handleSavePlaybook(
  params: SavePlaybookParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  await logger.info("Handling save playbook request");
  await logger.debug(`Playbook params: ${JSON.stringify(params)}`);

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

    // Check if read-only mode is enabled
    if (clientContext.permissions.enable_read_only_mode) {
      throw new Error("Saving playbooks is disabled in read-only mode");
    }

    // Enforce playbook policy before saving
    policyEnforcer.enforceSavePlaybookPolicy(params);

    const {
      playbook_name,
      description,
      actions,
      domain,
      keywords,
      requirements,
      privacy,
      source_playbook_id,
      fork_reason,
    } = params;

    const response = await apiService.createPlaybook(
      playbook_name,
      description,
      actions,
      domain,
      keywords,
      requirements,
      privacy,
      source_playbook_id,
      fork_reason,
    );

    await logger.info(`Playbook created successfully with ID: ${response.id}`);

    await telemetryLogger.log("client_save_playbook", {
      success: true,
      log_context: {
        playbook_id: response.id,
        source_playbook_id: source_playbook_id,
      },
      latency_ms: Date.now() - startTime,
    });

    return {
      content: [
        {
          type: "text",
          text: promptsCache
            .getPrompt("save_playbook_success")
            .replace("{PLAYBOOK_ID}", response.id),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`Failed to create playbook: ${errorMessage}`);

    await telemetryLogger.log("client_save_playbook", {
      success: false,
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: promptsCache
            .getPrompt("save_playbook_failure")
            .replace("{ERROR}", errorMessage),
        },
      ],
    };
  }
}
