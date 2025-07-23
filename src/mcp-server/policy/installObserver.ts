class InstallObserver {
  // Map of serverId -> Set of install/uninstall actions
  private serverInstallActions: Map<string, Set<string>>;

  constructor() {
    this.serverInstallActions = new Map();
  }

  // Record an install action on a server
  public recordInstall(serverId: string): void {
    this.recordAction(serverId, "install");
  }

  // Record an uninstall action on a server
  public recordUninstall(serverId: string): void {
    this.recordAction(serverId, "uninstall");
  }

  // Check if a server has been installed
  public wasServerInstalled(serverId: string): boolean {
    return (
      this.serverInstallActions.has(serverId) &&
      this.serverInstallActions.get(serverId)!.has("install")
    );
  }

  // Check if a server has been uninstalled
  public wasServerUninstalled(serverId: string): boolean {
    return (
      this.serverInstallActions.has(serverId) &&
      this.serverInstallActions.get(serverId)!.has("uninstall")
    );
  }

  // Optionally, clear all records (for testing or reset)
  public clear(): void {
    this.serverInstallActions.clear();
  }

  // Private method to record an action
  private recordAction(serverId: string, action: string): void {
    if (!this.serverInstallActions.has(serverId)) {
      this.serverInstallActions.set(serverId, new Set());
    }
    this.serverInstallActions.get(serverId)!.add(action);
  }
}

export default InstallObserver;
