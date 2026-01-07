import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { NotifyParams } from "../../shared/mcpServerTypes.js";
import Registry from "../registry.js";

const logger = FileLogger;

/**
 * Handler for the notify tool.
 * Only available in automation mode.
 * Returns an HITL signal for the cloud-agent to process.
 */
export async function handleNotify(
  params: NotifyParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  await logger.debug(
    `Handling notify request with params: ${JSON.stringify(params)}`,
  );

  const telemetryLogger = Registry.getTelemetryLogger();
  const clientContext = Registry.getClientContext();

  try {
    // Verify we're in automation mode
    if (clientContext.clientMode !== "automation") {
      throw new Error(
        "The notify tool is only available in automation mode. It allows the agent to send notifications to the automation owner.",
      );
    }

    // Verify automation context is set
    const automationContext = clientContext.automationContext;
    if (!automationContext) {
      throw new Error(
        "Automation context not configured. Cannot send notifications without automation configuration.",
      );
    }

    // Verify notification email is configured
    if (!automationContext.notificationEmail) {
      throw new Error(
        "No notification email configured for this automation. Cannot send notification.",
      );
    }

    // Validate multi_choice has options
    if (params.response_type === "multi_choice") {
      if (!params.response_options || params.response_options.length === 0) {
        throw new Error(
          "response_options is required for multi_choice response type",
        );
      }
    }

    await logger.info(
      `Sending HITL notification: ${params.title} (pause: ${params.pause_until_response})`,
    );

    await telemetryLogger.log("client_notify", {
      success: true,
      log_context: {
        response_type: params.response_type,
        pause_until_response: params.pause_until_response,
        has_context: !!params.context,
      },
      latency_ms: Date.now() - startTime,
    });

    // Return HITL signal for cloud-agent to handle
    // The cloud-agent will parse this and create the notification
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            _hitl_required: true,
            _hitl_type: "agent_notify",
            title: params.title,
            content: params.content,
            context: params.context,
            response_type: params.response_type,
            response_options: params.response_options,
            pause_until_response: params.pause_until_response,
            automation_id: automationContext.automationId,
            run_id: automationContext.runId,
            notification_email: automationContext.notificationEmail,
            expiration_hours: automationContext.expirationHours,
          }),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`Failed to send notification: ${errorMessage}`);

    await telemetryLogger.log("client_notify", {
      success: false,
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Failed to send notification: ${errorMessage}`,
        },
      ],
    };
  }
}
