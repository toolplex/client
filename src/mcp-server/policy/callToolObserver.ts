class CallToolObserver {
  // Map of serverId -> Set of toolNames called
  private serverToolCalls: Map<string, Set<string>>;

  constructor() {
    this.serverToolCalls = new Map();
  }

  // Record a call to a tool on a server
  public recordCall(serverId: string, toolName: string): void {
    if (!this.serverToolCalls.has(serverId)) {
      this.serverToolCalls.set(serverId, new Set());
    }
    this.serverToolCalls.get(serverId)!.add(toolName);
  }

  // Seed the observer with historical tool calls (for session resume)
  public seedHistory(
    history: Array<{ server_id: string; tool_name: string }>,
  ): void {
    history.forEach(({ server_id, tool_name }) => {
      this.recordCall(server_id, tool_name);
    });
  }

  // Check if a server was called at all
  public wasServerCalled(serverId: string): boolean {
    return (
      this.serverToolCalls.has(serverId) &&
      this.serverToolCalls.get(serverId)!.size > 0
    );
  }

  // Check if a specific tool was called on a server
  public wasToolCalled(serverId: string, toolName: string): boolean {
    return (
      this.serverToolCalls.has(serverId) &&
      this.serverToolCalls.get(serverId)!.has(toolName)
    );
  }

  // Optionally, clear all records (for testing or reset)
  public clear(): void {
    this.serverToolCalls.clear();
  }
}

export default CallToolObserver;
