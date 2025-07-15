import { StdioServerManagerClient } from '../../shared/stdioServerManagerClient.js';

export async function findServerManagerClient(
  serverId: string,
  serverManagerClients: Record<string, StdioServerManagerClient>
): Promise<StdioServerManagerClient> {
  for (const client of Object.values(serverManagerClients)) {
    const response = await client.sendRequest('list_servers', {});
    if ('error' in response) {
      throw new Error(`Failed to list servers; error message: ${response.error.message}`);
    }
    // Handle both array and object responses
    const serverList = Array.isArray(response) ? response : response.servers;
    // Ensure serverList is an array and handle potential null/undefined
    if (Array.isArray(serverList)) {
      const hasServer = serverList.some(
        (s) =>
          // Handle both server_id and serverId properties
          s.server_id === serverId || s.serverId === serverId
      );
      if (hasServer) {
        return client;
      }
    }
  }
  throw new Error(`Server ${serverId} not found`);
}
