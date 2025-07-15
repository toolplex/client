import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { FileLogger } from '../../shared/fileLogger.js';
import { SubmitFeedbackParams } from '../../shared/mcpServerTypes.js';
import Registry from '../registry.js';

const logger = FileLogger;

export async function handleSubmitFeedback(params: SubmitFeedbackParams): Promise<CallToolResult> {
  const startTime = Date.now();
  await logger.info('Handling submit feedback request');
  await logger.debug(`Feedback params: ${JSON.stringify(params)}`);

  const { target_type, target_id, vote, message, security_assessment } = params;

  const apiService = Registry.getToolplexApiService();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const policyEnforcer = Registry.getPolicyEnforcer();
  const clientContext = Registry.getClientContext();

  try {
    // Check if the client is in restricted mode
    if (clientContext.clientMode === 'restricted') {
      throw new Error('Feedback functionality is disabled in restricted mode.');
    }

    // Check if read-only mode is enabled
    if (clientContext.permissions.enable_read_only_mode) {
      throw new Error('Saving playbooks is disabled in read-only mode');
    }

    // Enforce feedback policy before submitting
    policyEnforcer.enforceFeedbackPolicy(params);

    const response = await apiService.submitFeedback(
      target_type,
      target_id,
      vote,
      message,
      security_assessment
    );

    await logger.info(`Feedback submitted successfully for ${target_type} ${target_id}`);

    await telemetryLogger.log('client_submit_feedback', {
      success: true,
      log_context: {
        target_type,
        target_id,
        feedback_id: response.id,
      },
      latency_ms: Date.now() - startTime,
    });

    return {
      role: 'system',
      content: [
        {
          type: 'text',
          text: promptsCache
            .getPrompt('submit_feedback_success')
            .replace('{FEEDBACK_ID}', response.id),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`Failed to submit feedback: ${errorMessage}`);

    await telemetryLogger.log('client_submit_feedback', {
      success: false,
      log_context: {
        target_type,
        target_id,
      },
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    return {
      role: 'system',
      content: [
        {
          type: 'text',
          text: promptsCache.getPrompt('unexpected_error').replace('{ERROR}', errorMessage),
        },
      ],
    };
  }
}
