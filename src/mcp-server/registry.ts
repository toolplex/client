import { ClientContext } from "./clientContext.js";
import { ToolplexApiService } from "./toolplexApi/service.js";
import { StdioServerManagerClient } from "../shared/stdioServerManagerClient.js";
import { TelemetryLogger } from "./logging/telemetryLogger.js";
import { PromptsCache } from "./promptsCache.js";
import { ToolDefinitionsCache } from "./toolDefinitionsCache.js";
import { ServersCache } from "./serversCache.js";
import { PolicyEnforcer } from "./policy/policyEnforcer.js";
import { BundledDependencies } from "../shared/mcpServerTypes.js";

/**
 * In-memory global registry for the ToolPlex client.
 * Maintains singleton instances of core services and clients used throughout the application.
 */
class Registry {
  private static _clientContext: ClientContext | null = null;
  private static _toolplexApiService: ToolplexApiService | null = null;
  private static _serverManagerClients: Record<
    string,
    StdioServerManagerClient
  > | null = null;
  private static _telemetryLogger: TelemetryLogger | null = null;
  private static _promptsCache: PromptsCache | null = null;
  private static _toolDefinitionsCache: ToolDefinitionsCache | null = null;
  private static _serversCache: ServersCache | null = null;
  private static _policyEnforcer: PolicyEnforcer | null = null;
  private static _bundledDependencies: BundledDependencies = {};

  public static async init(clientContext: ClientContext): Promise<void> {
    if (
      this._clientContext ||
      this._toolplexApiService ||
      this._serverManagerClients
    ) {
      throw new Error("Registry already initialized");
    }
    this._clientContext = clientContext;
    this._toolplexApiService = new ToolplexApiService(clientContext);
    this._serverManagerClients = {};
    this._telemetryLogger = new TelemetryLogger();
    this._promptsCache = new PromptsCache();
    this._toolDefinitionsCache = new ToolDefinitionsCache();
    this._serversCache = new ServersCache();
    this._policyEnforcer = new PolicyEnforcer();

    // Tool definitions must be initialized early to use tools like initialize_toolplex.
    await this._toolDefinitionsCache.init(
      this._toolplexApiService,
      clientContext,
    );
  }

  public static getClientContext(): ClientContext {
    if (!this._clientContext) {
      throw new Error("ClientContext not initialized in Registry");
    }
    return this._clientContext;
  }

  public static getToolplexApiService(): ToolplexApiService {
    if (!this._toolplexApiService) {
      throw new Error("ToolplexApiService not initialized in Registry");
    }
    return this._toolplexApiService;
  }

  public static getServerManagerClients(): Record<
    string,
    StdioServerManagerClient
  > {
    if (!this._serverManagerClients) {
      throw new Error("ServerManagerClients not initialized in Registry");
    }
    return this._serverManagerClients;
  }

  public static setServerManagerClients(
    clients: Record<string, StdioServerManagerClient>,
  ): void {
    if (!this._serverManagerClients) {
      throw new Error("Registry not initialized");
    }
    this._serverManagerClients = clients;
  }

  public static getTelemetryLogger(): TelemetryLogger {
    if (!this._telemetryLogger) {
      throw new Error("TelemetryLogger not initialized in Registry");
    }
    return this._telemetryLogger;
  }

  public static getPromptsCache(): PromptsCache {
    if (!this._promptsCache) {
      throw new Error("PromptsCache not initialized in Registry");
    }
    return this._promptsCache;
  }

  public static getToolDefinitionsCache(): ToolDefinitionsCache {
    if (!this._toolDefinitionsCache) {
      throw new Error("ToolDefinitionsCache not initialized in Registry");
    }
    return this._toolDefinitionsCache;
  }

  public static getServersCache(): ServersCache {
    if (!this._serversCache) {
      throw new Error("ServersCache not initialized in Registry");
    }
    return this._serversCache;
  }

  public static getPolicyEnforcer(): PolicyEnforcer {
    if (!this._policyEnforcer) {
      throw new Error("PolicyEnforcer not initialized in Registry");
    }
    return this._policyEnforcer;
  }

  /**
   * Set bundled dependencies (paths to Node, Python, Git, etc.)
   * provided by the host application (e.g., Electron desktop app).
   */
  public static setBundledDependencies(deps: BundledDependencies): void {
    this._bundledDependencies = deps;
  }

  /**
   * Get bundled dependencies (paths to required executables).
   * Returns empty object if not set.
   */
  public static getBundledDependencies(): BundledDependencies {
    return this._bundledDependencies;
  }

  /**
   * Get the path for a specific bundled dependency by name.
   * Returns undefined if the dependency is not available.
   */
  public static getBundledDependencyPath(
    depName: "node" | "python" | "git" | "uvx" | "npx",
  ): string | undefined {
    return this._bundledDependencies[depName];
  }

  public static reset(): void {
    this._clientContext = null;
    this._toolplexApiService = null;
    this._serverManagerClients = null;
    this._telemetryLogger = null;
    if (this._promptsCache) {
      this._promptsCache.reset();
      this._promptsCache = null;
    }
    if (this._toolDefinitionsCache) {
      this._toolDefinitionsCache.reset();
      this._toolDefinitionsCache = null;
    }
    if (this._serversCache) {
      this._serversCache.reset();
      this._serversCache = null;
    }
    this._policyEnforcer = null;
    this._bundledDependencies = {};
  }
}

export default Registry;
