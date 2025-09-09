import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CallToolParams } from "../../shared/mcpServerTypes.js";
import { findServerManagerClient } from "./serverManagerUtils.js";
import { CallToolResultSchema } from "../../shared/serverManagerTypes.js";
import { FileLogger } from "../../shared/fileLogger.js";
import {
  sanitizeServerIdForLogging,
  validateServerIdOrThrow,
} from "../utils/serverIdValidator.js";
import Registry from "../registry.js";

const logger = FileLogger;

function safeLength(obj: unknown): number {
  try {
    return JSON.stringify(obj).length;
  } catch {
    return -1;
  }
}

export async function handleCallTool(
  params: CallToolParams,
): Promise<CallToolResult> {
  await logger.debug(
    `Handling call tool request with params: ${JSON.stringify(params)}`,
  );

  const serverManagerClients = Registry.getServerManagerClients();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const clientContext = Registry.getClientContext();
  const startTime = Date.now();

  // Get the CallToolObserver from the PolicyEnforcer via Registry
  const policyEnforcer = Registry.getPolicyEnforcer();
  const callToolObserver = policyEnforcer.getCallToolObserver();

  try {
    // Validate server ID format
    validateServerIdOrThrow(params.server_id);

    // Enforce call tool policy
    policyEnforcer.enforceCallToolPolicy(params.server_id);

    const client = await findServerManagerClient(
      params.server_id,
      serverManagerClients,
    );
    const response = await client.sendRequest("call_tool", params);

    if ("error" in response) {
      throw new Error(
        `Failed to call tool with params: ${JSON.stringify(params)}, error message: ${response.error.message}`,
      );
    }

    const parsed = CallToolResultSchema.safeParse(response);
    if (!parsed.success) {
      throw new Error(`Invalid call_tool response: ${parsed.error}`);
    }

    // Record the successful tool call for Playbook policy enforcement
    callToolObserver.recordCall(params.server_id, params.tool_name);

    const result = parsed.data.result;
    const content = Array.isArray(result) ? result : [result];
    if (
      !clientContext.permissions.enable_read_only_mode &&
      clientContext.clientMode !== "restricted"
    ) {
      content.push({
        type: "text",
        text: promptsCache.getPrompt("tool_call_next_steps"),
      });
    }

    await logger.debug("Tool called successfully");

    await telemetryLogger.log("client_call_tool", {
      success: true,
      log_context: {
        server_id: sanitizeServerIdForLogging(params.server_id),
        tool_name: params.tool_name,
        input_length: safeLength(params),
        response_length: safeLength(content),
      },
      latency_ms: Date.now() - startTime,
    });

    return {
      content: content,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : promptsCache.getPrompt("unexpected_error");

    await logger.error(`Failed to call tool: ${errorMessage}`);

    await telemetryLogger.log("client_call_tool", {
      success: false,
      log_context: {
        server_id: sanitizeServerIdForLogging(params.server_id),
        tool_name: params.tool_name,
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
            .getPrompt("tool_call_failure")
            .replace("{ERROR}", errorMessage)
            .replace("{SERVER_ID}", params.server_id)
            .replace("{TOOL_NAME}", params.tool_name),
        },
      ],
    };
  }
}
