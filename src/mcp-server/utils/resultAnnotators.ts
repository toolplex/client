/**
 * Annotate a server object with "(installed)" in the server_name or set installed: true,
 * if the server is installed according to the provided serversCache.
 *
 * This is used in both searchHandler and lookupEntityHandler.
 *
 * @param server - The server object to annotate (should have server_id and optionally server_name)
 * @param serversCache - The ServersCache instance with isInstalled(server_id) method
 * @returns The annotated server object (may be the same object if not installed)
 */

export function annotateInstalledServer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server: any,
  serversCache: { isInstalled: (id: string) => boolean }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (!server || typeof server !== 'object' || !server.server_id) {
    return server;
  }
  if (serversCache.isInstalled(server.server_id)) {
    if (server.server_name) {
      return {
        ...server,
        server_name: `${server.server_name} (installed)`,
      };
    } else {
      return {
        ...server,
        installed: true,
      };
    }
  }
  return server;
}

/**
 * Annotate an array of server objects with installed status.
 *
 * @param servers - Array of server objects
 * @param serversCache - The ServersCache instance
 * @returns Annotated array of server objects
 */

export function annotateInstalledServers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  servers: any[],
  serversCache: { isInstalled: (id: string) => boolean }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  if (!Array.isArray(servers)) return [];
  return servers.map((server) => annotateInstalledServer(server, serversCache));
}
