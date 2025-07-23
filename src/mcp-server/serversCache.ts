import { StdioServerManagerClient } from "../shared/stdioServerManagerClient.js";
import { ListServersResultSchema } from "../shared/serverManagerTypes.js";
import { FileLogger } from "../shared/fileLogger.js";

const logger = FileLogger;

type ServerInfo = {
  server_id: string;
  server_name: string;
  description: string;
};

/**
 * An in-memory cache that tracks currently installed servers.
 * Maintains a set of server IDs for quick lookup of installed servers.
 * Can be refreshed by querying server manager clients for their current server lists.
 */
export class ServersCache {
  private _serverIds: Set<string> | null = null;

  constructor() {
    this._serverIds = null;
  }

  /**
   * Initialize the cache with a list of servers, e.g. from initialize() succeeded list.
   * Only tracks server IDs.
   */
  public init(servers: ServerInfo[]): void {
    this._serverIds = new Set(servers.map((s) => s.server_id));
  }

  /**
   * Update the cache with a new list of servers, e.g. after calling listServersHandler.
   * This does not imply initialization, but is meant to refresh the cache with the latest list.
   * Only tracks server IDs.
   */
  public updateServers(servers: ServerInfo[]): void {
    this._serverIds = new Set(servers.map((s) => s.server_id));
  }

  /**
   * Returns true if the server is installed (present in the cache).
   * Throws an error if the cache is not initialized.
   */
  public isInstalled(serverId: string): boolean {
    if (!this.isInitialized()) {
      throw new Error("ServersCache not initialized");
    }
    if (!serverId) {
      throw new Error(`Invalid serverId: "${serverId}"`);
    }

    return this._serverIds!.has(serverId);
  }

  /**
   * Get all cached server IDs.
   */
  public getServerIds(): string[] {
    if (!this._serverIds) {
      throw new Error("ServersCache not initialized");
    }
    return Array.from(this._serverIds);
  }

  /**
   * Refresh the cache by calling list_servers on all server manager clients.
   * This follows the pattern in handleListServers (listServersHandler.ts):
   * - Use sendRequest('list_servers', {}) on each client.
   * - Validate/parse the response with ListServersResultSchema.
   * - Collect all servers from all runtimes.
   * @param serverManagerClients - Record of server manager clients (e.g. from Registry)
   */
  public async refreshCache(
    serverManagerClients: Record<string, StdioServerManagerClient>,
  ): Promise<void> {
    const allServerIds: Set<string> = new Set();
    for (const [runtime, client] of Object.entries(serverManagerClients)) {
      try {
        const response_data = await client.sendRequest("list_servers", {});
        if (response_data.error) {
          await logger.warn(
            `Error from server manager client "${runtime}": ${response_data.error}`,
          );
          continue;
        }
        const parsed = ListServersResultSchema.safeParse(response_data);
        if (!parsed.success) {
          await logger.warn(
            `Failed to parse list_servers response from "${runtime}": ${JSON.stringify(response_data)}`,
          );
          continue;
        }
        if (parsed.data.servers && parsed.data.servers.length > 0) {
          for (const server of parsed.data.servers) {
            if (server && typeof server.server_id === "string") {
              allServerIds.add(server.server_id);
            }
          }
        }
      } catch (err) {
        await logger.warn(
          `Exception while refreshing cache from server manager client "${runtime}": ${err instanceof Error ? err.message : String(err)}`,
        );
        // Continue to next client
      }
    }
    this._serverIds = allServerIds;
  }

  /**
   * Check if the cache is initialized
   */
  public isInitialized(): boolean {
    return this._serverIds !== null;
  }

  /**
   * Reset the cache
   */
  public reset(): void {
    this._serverIds = null;
  }
}
