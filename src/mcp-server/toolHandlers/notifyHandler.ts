import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { NotifyParams } from "../../shared/mcpServerTypes.js";
import Registry from "../registry.js";

const logger = FileLogger;

/**
 * Handler for the notify tool.
 * Only available in automation mode.
 * Creates a notification via the API and optionally pauses the automation.
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
  const apiService = Registry.getToolplexApiService();

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

    // Call the API to create the notification (and pause if needed)
    const result = await apiService.createAutomationNotification({
      automationId: automationContext.automationId,
      runId: automationContext.runId,
      sessionId: clientContext.sessionId,
      title: params.title,
      content: params.content,
      context: params.context,
      responseType: params.response_type,
      responseOptions: params.response_options,
      pauseUntilResponse: params.pause_until_response,
      notificationRecipients: [{ email: automationContext.notificationEmail }],
      expirationHours: automationContext.expirationHours,
    });

    await telemetryLogger.log("client_notify", {
      success: true,
      log_context: {
        response_type: params.response_type,
        pause_until_response: params.pause_until_response,
        has_context: !!params.context,
        notification_id: result.notificationId,
      },
      latency_ms: Date.now() - startTime,
    });

    // Return simple result - cloud-agent checks for 'paused' flag
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            notificationId: result.notificationId,
            paused: result.paused,
            message: result.paused
              ? "Notification sent. Automation paused awaiting response."
              : "Notification sent. Automation continues.",
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
