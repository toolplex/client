import { ClientContext } from "../clientContext.js";
import { PlaybookPolicy } from "./playbookPolicy.js";
import { FeedbackPolicy } from "./feedbackPolicy.js";
import CallToolObserver from "./callToolObserver.js";
import InstallObserver from "./installObserver.js";
import {
  SavePlaybookParams,
  SubmitFeedbackParams,
} from "../../shared/mcpServerTypes.js";
import { ServerPolicy } from "./serverPolicy.js";

export class PolicyEnforcer {
  private playbookPolicy: PlaybookPolicy | null = null;
  private feedbackPolicy: FeedbackPolicy | null = null;
  private serverPolicy: ServerPolicy | null = null;
  private callToolObserver: CallToolObserver | null = null;
  private installObserver: InstallObserver | null = null;

  constructor() {}

  /**
   * Initialize the policy enforcer with the client context
   */
  public init(clientContext: ClientContext): void {
    this.callToolObserver = new CallToolObserver();
    this.installObserver = new InstallObserver();
    this.playbookPolicy = new PlaybookPolicy(
      clientContext,
      this.callToolObserver,
    );
    this.feedbackPolicy = new FeedbackPolicy(
      clientContext,
      this.callToolObserver,
      this.installObserver,
    );
    this.serverPolicy = new ServerPolicy(clientContext);
  }

  /**
   * Enforce playbook policy validation before saving.
   * Throws if the playbook does not pass policy.
   */
  public enforceSavePlaybookPolicy(playbook: SavePlaybookParams): void {
    if (!this.playbookPolicy) {
      throw new Error("PolicyEnforcer not initialized");
    }
    this.playbookPolicy.enforceSavePlaybookPolicy(playbook);
  }

  /**
   * Enforce feedback policy validation.
   * Throws if the feedback does not pass policy.
   */
  public enforceFeedbackPolicy(feedback: SubmitFeedbackParams): void {
    if (!this.feedbackPolicy) {
      throw new Error("PolicyEnforcer not initialized");
    }
    this.feedbackPolicy.enforceFeedbackPolicy(feedback);
  }

  /**
   * Enforce server call tool policy validation.
   * Throws if attempting to call a tool on a blocked server.
   */
  public enforceCallToolPolicy(serverId: string): void {
    if (!this.serverPolicy) {
      throw new Error("PolicyEnforcer not initialized");
    }
    this.serverPolicy.enforceCallToolPolicy(serverId);
  }

  /**
   * Enforce server config policy validation.
   * Throws if attempting to use a blocked or disallowed server.
   */
  public enforceUseServerPolicy(serverId: string): void {
    if (!this.serverPolicy) {
      throw new Error("PolicyEnforcer not initialized");
    }
    this.serverPolicy.enforceUseServerPolicy(serverId);
  }

  /**
   * Enforce playbook usage logging policy validation.
   * Throws if read-only mode is enabled.
   */
  public enforceLogPlaybookUsagePolicy(): void {
    if (!this.playbookPolicy) {
      throw new Error("PolicyEnforcer not initialized");
    }
    this.playbookPolicy.enforceLogPlaybookUsagePolicy();
  }

  /**
   * Filters out blocked servers from a list of objects.
   *
   * @param servers List of objects containing server IDs
   * @param getServerId Function that extracts the server ID from an object
   * @returns Filtered list with blocked servers removed
   */
  public filterBlockedMcpServers<T>(
    servers: T[],
    getServerId: (item: T) => string,
  ): T[] {
    if (!this.serverPolicy) {
      throw new Error("PolicyEnforcer not initialized");
    }
    return this.serverPolicy.filterBlockedMcpServers(servers, getServerId);
  }

  /**
   * Get a reference to the CallToolObserver instance.
   */
  public getCallToolObserver(): CallToolObserver {
    if (!this.callToolObserver) {
      throw new Error("PolicyEnforcer not initialized");
    }
    return this.callToolObserver;
  }

  /**
   * Get a reference to the InstallObserver instance.
   */
  public getInstallObserver(): InstallObserver {
    if (!this.installObserver) {
      throw new Error("PolicyEnforcer not initialized");
    }
    return this.installObserver;
  }
}
