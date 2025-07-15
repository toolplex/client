import CallToolObserver from './callToolObserver.js';
import InstallObserver from './installObserver.js';
import { ClientContext } from '../clientContext.js';
import { SubmitFeedbackParams } from '../../shared/mcpServerTypes.js';

export class FeedbackPolicy {
  private callToolObserver: CallToolObserver;
  private installObserver: InstallObserver;
  private clientContext: ClientContext;
  private blockedMcpServersSet: Set<string>;

  constructor(
    clientContext: ClientContext,
    callToolObserver: CallToolObserver,
    installObserver: InstallObserver
  ) {
    this.callToolObserver = callToolObserver;
    this.installObserver = installObserver;
    this.clientContext = clientContext;
    this.blockedMcpServersSet = new Set(clientContext.flags.blocked_mcp_servers || []);
  }

  /**
   * Validates feedback by checking that:
   * - The referenced server has been used or had an install/uninstall action
   * - The server is not in the blocked servers list
   *
   * For server feedback, verifies that:
   * - The referenced server has been connected to and used or had an install/uninstall action
   * - The server is not blocked
   *
   * For playbook feedback, no validation is currently performed
   * since playbooks can reference other playbooks.
   *
   * @throws Error if feedback references a server that hasn't been used or had an install/uninstall action
   * in the current session or if the server is blocked
   */
  public enforceFeedbackPolicy(feedback: SubmitFeedbackParams): void {
    const { target_type, target_id } = feedback;

    if (target_type === 'server') {
      // Check if server is blocked
      if (this.blockedMcpServersSet.has(target_id)) {
        throw new Error(`Cannot submit feedback for blocked server "${target_id}"`);
      }

      // For server feedback, verify the server was actually used or had an install/uninstall action
      if (
        !this.callToolObserver.wasServerCalled(target_id) &&
        !this.installObserver.wasServerInstalled(target_id) &&
        !this.installObserver.wasServerUninstalled(target_id)
      ) {
        throw new Error(
          `Cannot submit feedback for server "${target_id}" which has not been used or had an install/uninstall action in this session.`
        );
      }
    }
    // For playbook feedback, we don't validate usage since playbooks can reference other playbooks
  }
}
