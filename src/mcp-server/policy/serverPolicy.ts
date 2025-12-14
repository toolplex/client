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
   * - For org users: if allowlist is empty/null, NO servers are allowed
   * - For non-org users: if allowlist is empty/null, all servers are allowed
   *
   * @throws Error if attempting to use a server not in the allowed list
   */
  public enforceAllowedServerPolicy(serverId: string): void {
    const allowedServers = this.clientContext.permissions.allowed_mcp_servers;

    // If allowlist is empty/null
    if (!allowedServers || allowedServers.length === 0) {
      // For org users: empty allowlist means NO servers approved
      if (this.clientContext.isOrgUser) {
        throw new Error(
          `No tools have been approved for your organization yet. Please contact your admin to approve tools on the ToolPlex Dashboard.`,
        );
      }
      // For non-org users: no restrictions
      return;
    }

    // Check if server is in the allowlist
    if (!allowedServers.includes(serverId)) {
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
    // Skip this check if the server is in the allowed list (admin explicitly approved it)
    const allowedServers = this.clientContext.permissions.allowed_mcp_servers;
    const isExplicitlyAllowed =
      allowedServers && allowedServers.includes(serverId);

    if (
      !isExplicitlyAllowed &&
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

  /**
   * Filters servers to only include allowed servers (if allowlist is set).
   * - For org users: if allowlist is empty/null, return NO servers (admin hasn't approved any)
   * - For non-org users: if allowlist is empty/null, return all servers (no restrictions)
   *
   * @param servers List of objects containing server IDs
   * @param getServerId Function that extracts the server ID from an object
   * @returns Filtered list with only allowed servers
   */
  public filterToAllowedServers<T>(
    servers: T[],
    getServerId: (item: T) => string,
  ): T[] {
    const allowedServers = this.clientContext.permissions.allowed_mcp_servers;

    // If no allowlist configured
    if (!allowedServers || allowedServers.length === 0) {
      // For org users: empty allowlist means NO servers approved yet
      if (this.clientContext.isOrgUser) {
        return [];
      }
      // For non-org users: no restrictions, return all
      return servers;
    }

    const allowedSet = new Set(allowedServers);
    return servers.filter((server) => allowedSet.has(getServerId(server)));
  }

  /**
   * Applies both blocked and allowed server filtering.
   * First removes blocked servers, then filters to allowed servers (if set).
   *
   * @param servers List of objects containing server IDs
   * @param getServerId Function that extracts the server ID from an object
   * @returns Filtered list with policy applied
   */
  public filterServersByPolicy<T>(
    servers: T[],
    getServerId: (item: T) => string,
  ): T[] {
    const withoutBlocked = this.filterBlockedMcpServers(servers, getServerId);
    return this.filterToAllowedServers(withoutBlocked, getServerId);
  }
}
