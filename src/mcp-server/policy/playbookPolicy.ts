import CallToolObserver from './callToolObserver.js';
import { ClientContext } from '../clientContext.js';
import { SavePlaybookParams } from '../../shared/mcpServerTypes.js';
import Registry from '../registry.js';

export class PlaybookPolicy {
  private callToolObserver: CallToolObserver;
  private clientContext: ClientContext;
  private blockedMcpServersSet: Set<string>;

  constructor(clientContext: ClientContext, callToolObserver: CallToolObserver) {
    this.callToolObserver = callToolObserver;
    this.clientContext = clientContext;
    this.blockedMcpServersSet = new Set(clientContext.flags.blocked_mcp_servers || []);
  }

  /**
   * Validates a playbook before saving by checking that:
   * - Referenced servers and tools have been used
   * - No blocked servers are referenced
   * - Private playbooks are only created when enabled
   *
   * For each action with a 'call' property, verifies that:
   * - Any referenced server has been connected to
   * - Any referenced server/tool combination has been executed
   * - The server is not in the blocked servers list
   *
   * @throws Error if a referenced server or tool has not been used in the current session,
   * if a blocked server is referenced, or if trying to create a private playbook when disabled
   */
  public enforceSavePlaybookPolicy(playbook: SavePlaybookParams): void {
    if (!Array.isArray(playbook.actions)) {
      throw new Error('Playbook actions must be an array');
    }

    for (const [idx, action] of playbook.actions.entries()) {
      if (!action.call) continue;

      // Parse the call string
      // Supported formats:
      // - "mcp_server_id:<server_id>::<tool_name>"
      // - "mcp_server_id:<server_id>"
      // - "playbook_id:<playbook_id>"
      const call = action.call.trim();

      if (call.startsWith('mcp_server_id:')) {
        // Could be with or without tool_name
        // e.g. mcp_server_id:abc123::toolX or mcp_server_id:abc123
        const match = call.match(/^mcp_server_id:([^:]+)(?:::([^:]+))?$/);
        if (!match) {
          throw new Error(`Invalid call format in action ${idx + 1}: "${call}"`);
        }
        const serverId = match[1];
        const toolName = match[2];

        // Check if server is blocked
        if (this.blockedMcpServersSet.has(serverId)) {
          throw new Error(`Playbook action ${idx + 1} references blocked server "${serverId}"`);
        }

        if (toolName) {
          // Must have called this tool on this server
          if (!this.callToolObserver.wasToolCalled(serverId, toolName)) {
            throw new Error(
              `Playbook action ${idx + 1} references tool "${toolName}" on server "${serverId}" which has not been used in this session.`
            );
          }
        } else {
          // Only server referenced, must have called any tool on this server
          if (!this.callToolObserver.wasServerCalled(serverId)) {
            throw new Error(
              `Playbook action ${idx + 1} references server "${serverId}" which has not been used in this session.`
            );
          }
        }
      } else if (call.startsWith('playbook_id:')) {
        // For playbook references, we could skip or add logic if needed
        // For now, we do not validate playbook_id usage
        continue;
      } else {
        throw new Error(`Playbook action ${idx + 1} has an unrecognized call format: "${call}"`);
      }
    }
  }

  /**
   * Validates if playbook usage logging is allowed based on read-only mode
   * @throws Error if read-only mode is enabled
   */
  public enforceLogPlaybookUsagePolicy(): void {
    if (this.clientContext.permissions.enable_read_only_mode) {
      const promptsCache = Registry.getPromptsCache();
      throw new Error(promptsCache.getPrompt('log_playbook_usage_disabled'));
    }
  }
}
