import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { FileLogger } from '../../shared/fileLogger.js';
import { findServerManagerClient } from './serverManagerUtils.js';
import { ListToolplexToolsParams } from '../../shared/mcpServerTypes.js';
import {
  ListToolsResultSchema,
  ListAllToolsResultSchema,
} from '../../shared/serverManagerTypes.js';
import Registry from '../registry.js';

const logger = FileLogger;

export async function handleListTools(params: ListToolplexToolsParams): Promise<CallToolResult> {
  const startTime = Date.now();
  const serverManagerClients = Registry.getServerManagerClients();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const policyEnforcer = Registry.getPolicyEnforcer();

  try {
    const server_id = params!.server_id as string;
    let response = '';

    if (server_id) {
      // Check if server is blocked using policy enforcer
      policyEnforcer.enforceUseServerPolicy(server_id);

      await logger.debug(`Listing tools for specific server: ${server_id}`);
      const client = await findServerManagerClient(server_id, serverManagerClients);
      const response_data = await client.sendRequest('list_tools', { server_id: server_id });
      if ('error' in response_data) {
        throw new Error(
          `Failed to list tools for server_id ${server_id}, error message: ${response_data.error.message}`
        );
      }

      const parsed = ListToolsResultSchema.safeParse(response_data);
      if (!parsed.success) {
        throw new Error(`Invalid response from server manager: ${parsed.error}`);
      }

      response = promptsCache
        .getPrompt('list_tools_server_header')
        .replace('{SERVER_ID}', parsed.data.server_id)
        .replace('{SERVER_NAME}', parsed.data.server_name);

      if (!parsed.data.tools || parsed.data.tools.length === 0) {
        response += promptsCache.getPrompt('list_tools_empty');
      } else {
        parsed.data.tools.forEach((tool) => {
          response += `- ${tool.name}: ${tool.description}\n`;
          response += `  Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}\n\n`;
        });
      }
    } else {
      await logger.debug('Listing tools from all installed servers');
      response = promptsCache.getPrompt('list_tools_all_header');
      for (const [runtime, client] of Object.entries(serverManagerClients)) {
        const response_data = await client.sendRequest('list_all_tools', {});
        if (response_data.error) {
          continue;
        }

        const parsed = ListAllToolsResultSchema.safeParse(response_data);
        if (!parsed.success) {
          await logger.error(
            `Invalid response from server manager: ${parsed.error}, runtime: ${runtime}`
          );
          continue;
        }

        // Filter out blocked servers
        const serverEntries = Object.entries(parsed.data.tools);
        const filteredEntries = policyEnforcer.filterBlockedMcpServers(
          serverEntries,
          ([serverId]) => serverId
        );

        for (const [serverId, serverTools] of filteredEntries) {
          if (serverTools && serverTools.length > 0) {
            response += `Server: ${serverId}\n`;
            serverTools.forEach((tool) => {
              response += `- ${tool.name}: ${tool.description}\n`;
              response += `  Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}\n\n`;
            });
            response += '\n';
          }
        }
      }

      if (response === promptsCache.getPrompt('list_tools_all_header')) {
        response += promptsCache.getPrompt('list_tools_empty');
      }
    }

    await logger.debug('Successfully retrieved tools list');

    await telemetryLogger.log('client_list_tools', {
      success: true,
      log_context: {
        server_id: params.server_id,
      },
      latency_ms: Date.now() - startTime,
    });

    return {
      role: 'system',
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : promptsCache.getPrompt('unexpected_error');
    await logger.error(`Failed to list tools: ${errorMessage}`);

    await telemetryLogger.log('client_list_tools', {
      success: false,
      log_context: {
        server_id: params.server_id,
      },
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    return {
      role: 'system',
      content: [
        {
          type: 'text',
          text: promptsCache.getPrompt('list_tools_failure').replace('{ERROR}', errorMessage),
        },
      ],
    };
  }
}
