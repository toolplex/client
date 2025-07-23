import { ClientContext } from "../clientContext.js";

export class ServerPolicy {
  private clientContext: ClientContext;
  private blockedMcpServersSet: Set<string>;

  constructor(clientContext: ClientContext) {
    this.clientContext = clientContext;
    this.blockedMcpServersSet = new Set(
      clientContext.flags.blocked_mcp_servers || [],
    );
  }

  /**
   * Validates that a server is not blocked.
   *
   * @throws Error if attempting to use a blocked server
   */
  public enforceBlockedServerPolicy(serverId: string): void {
    if (this.blockedMcpServersSet.has(serverId)) {
      throw new Error(
        `Cannot use blocked server "${serverId}. Questions? Contact support@toolplex.ai"`,
      );
    }
  }

  /**
   * Validates that a server is allowed.
   *
   * @throws Error if attempting to use a server not in the allowed list
   */
  public enforceAllowedServerPolicy(serverId: string): void {
    const allowedServers = this.clientContext.permissions.allowed_mcp_servers;
    if (
      allowedServers &&
      allowedServers.length > 0 &&
      !allowedServers.includes(serverId)
    ) {
      throw new Error(
        `Server "${serverId}" is not allowed for your account. Please adjust the Allowed MCP Servers permissions on the ToolPlex Dashboard if this is a mistake.`,
      );
    }
  }

  /**
   * Validates that a server is not blocked before calling a tool on it.
   * Also checks if desktop commander is enabled when calling tools on the desktop commander server.
   *
   * @throws Error if attempting to call a tool on a blocked server or if desktop commander is disabled
   */
  public enforceCallToolPolicy(serverId: string): void {
    this.enforceBlockedServerPolicy(serverId);
    this.enforceAllowedServerPolicy(serverId);

    // Check if desktop commander is disabled and this is the desktop commander server
    if (
      !this.clientContext.permissions.use_desktop_commander &&
      serverId === this.clientContext.flags.desktop_commander_server_id
    ) {
      throw new Error("Desktop Commander is disabled for your account");
    }
  }

  /**
   * Validates that a server can be used.
   *
   * @throws Error if attempting to use a blocked or disallowed server
   */
  public enforceUseServerPolicy(serverId: string): void {
    this.enforceBlockedServerPolicy(serverId);
    this.enforceAllowedServerPolicy(serverId);
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
    return servers.filter(
      (server) => !this.blockedMcpServersSet.has(getServerId(server)),
    );
  }
}
