import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  StdioServerParameters,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { ServerConfig } from "../shared/mcpServerTypes.js";
import { FileLogger } from "../shared/fileLogger.js";
import envPaths from "env-paths";
import { InitializeResult } from "../shared/serverManagerTypes.js";
import { getEnhancedPath } from "../shared/enhancedPath.js";

const logger = FileLogger;

export class ServerManager {
  private sessions: Map<string, Client>;
  private tools: Map<string, Tool[]>;
  private serverNames: Map<string, string>;
  private configPath: string;
  private config: Record<string, ServerConfig> = {};

  // Track ongoing installations to prevent race conditions
  private installationPromises: Map<string, Promise<void>> = new Map();

  // Add a file lock mechanism to prevent concurrent writes
  private configLock: Promise<void> = Promise.resolve();

  constructor() {
    this.sessions = new Map();
    this.tools = new Map();
    this.serverNames = new Map();

    const paths = envPaths("ToolPlex", { suffix: "" });
    this.configPath = path.join(paths.data, "server_config.json");
  }

  private async loadConfig(): Promise<Record<string, ServerConfig>> {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      await logger.debug(`Loaded config from ${this.configPath}`);

      const allConfig = JSON.parse(data);

      // Validate the config structure
      if (typeof allConfig !== "object" || allConfig === null) {
        await logger.warn("Invalid config format, using empty config");
        return {};
      }

      const config: Record<string, ServerConfig> = {};
      for (const [serverId, serverConfig] of Object.entries(allConfig)) {
        if (typeof serverConfig === "object" && serverConfig !== null) {
          config[serverId] = serverConfig as ServerConfig;
        } else {
          await logger.warn(`Invalid server config for ${serverId}, skipping`);
        }
      }
      return config;
    } catch (error: unknown) {
      let errorMessage = "Unknown error occurred";
      if (error instanceof Error) errorMessage = error.message;
      await logger.debug(
        `No existing config found at ${this.configPath}: ${errorMessage}`,
      );

      // If the file exists but is malformed, back it up and start fresh
      try {
        await fs.access(this.configPath);
        const backupPath = this.configPath + ".backup." + Date.now();
        await fs.copyFile(this.configPath, backupPath);
        await logger.warn(`Malformed config backed up to ${backupPath}`);
      } catch {
        // File doesn't exist, which is fine
      }

      return {};
    }
  }

  private async saveConfig(
    config: Record<string, ServerConfig>,
  ): Promise<void> {
    // Use a lock to prevent concurrent writes
    this.configLock = this.configLock.then(async () => {
      let existingConfig: Record<string, ServerConfig> = {};

      try {
        const data = await fs.readFile(this.configPath, "utf-8");
        existingConfig = JSON.parse(data);

        // Validate the existing config structure
        if (typeof existingConfig !== "object" || existingConfig === null) {
          await logger.warn(
            "Invalid existing config format, using empty config",
          );
          existingConfig = {};
        }
      } catch (error) {
        // Config file doesn't exist or is invalid, use empty config
        await logger.debug(`Could not read existing config: ${error}`);
        existingConfig = {};
      }

      const mergedConfig = {
        ...existingConfig,
        ...config,
      };

      // Validate the merged config before writing
      try {
        const testJson = JSON.stringify(mergedConfig, null, 2);
        JSON.parse(testJson); // This will throw if invalid
      } catch (error) {
        throw new Error(`Invalid config structure would be written: ${error}`);
      }

      await fs.mkdir(path.dirname(this.configPath), { recursive: true });

      // Write to a temporary file first, then rename (atomic operation)
      const tempPath = this.configPath + ".tmp";
      try {
        await fs.writeFile(tempPath, JSON.stringify(mergedConfig, null, 2));
        await fs.rename(tempPath, this.configPath);
        await logger.debug(`Saved config to ${this.configPath}`);
      } catch (error) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    });

    await this.configLock;
  }

  async initialize(): Promise<InitializeResult> {
    await this.cleanup();
    const succeeded: InitializeResult["succeeded"] = [];
    const failures: InitializeResult["failures"] = {};

    try {
      await logger.info("Initializing ServerManager");
      this.config = await this.loadConfig();
      await logger.debug(
        `Loaded ${Object.keys(this.config).length} server configs`,
      );

      for (const [serverId, serverConfig] of Object.entries(this.config)) {
        succeeded.push({
          server_id: serverId,
          server_name: serverConfig.server_name ?? serverId,
          description: serverConfig.description ?? "",
        });
      }
    } catch (err) {
      const errorMessage = (err as Error).message || String(err);
      await logger.error(`Failed to initialize: ${errorMessage}`);
    }

    return { succeeded, failures };
  }

  async getServerName(serverId: string): Promise<string> {
    await logger.debug(`Getting name for server ${serverId}`);
    return this.serverNames.get(serverId) || serverId;
  }

  async connectWithHandshakeTimeout(
    client: Client,
    transport: SSEClientTransport | StdioClientTransport,
    ms = 60000,
  ): Promise<{ tools?: Tool[] }> {
    let connectTimeout: NodeJS.Timeout;
    let listToolsTimeout: NodeJS.Timeout;

    try {
      // Race connect() with timeout
      await Promise.race([
        client.connect(transport),
        new Promise<never>((_, reject) => {
          connectTimeout = setTimeout(
            () => reject(new Error(`connect() timed out in ${ms} ms`)),
            ms,
          );
        }),
      ]);

      // Clear the connect timeout since it succeeded
      clearTimeout(connectTimeout!);

      // Race listTools() with timeout
      const result = await Promise.race<{ tools?: Tool[] }>([
        client.listTools(),
        new Promise<never>((_, reject) => {
          listToolsTimeout = setTimeout(
            () => reject(new Error(`listTools() timed out in ${ms} ms`)),
            ms,
          );
        }),
      ]);

      clearTimeout(listToolsTimeout!);
      return result;
    } catch (error) {
      // Clean up timeouts on error
      if (connectTimeout!) clearTimeout(connectTimeout);
      if (listToolsTimeout!) clearTimeout(listToolsTimeout);
      throw error;
    }
  }

  async install(
    serverId: string,
    serverName: string,
    description: string,
    config: ServerConfig,
  ): Promise<void> {
    await logger.info(`Installing server ${serverId} (${serverName})`);
    await logger.debug(`Server config: ${JSON.stringify(config)}`);

    // Check if there's already an ongoing installation for this server
    const existingInstall = this.installationPromises.get(serverId);
    if (existingInstall) {
      await logger.debug(
        `Installation already in progress for ${serverId}, waiting...`,
      );
      await existingInstall;
      return;
    }

    // Create the installation promise
    const installPromise = this.performInstall(
      serverId,
      serverName,
      description,
      config,
    );
    this.installationPromises.set(serverId, installPromise);

    try {
      await installPromise;
    } finally {
      // Always clean up the promise from the map
      this.installationPromises.delete(serverId);
    }
  }

  private async performInstall(
    serverId: string,
    serverName: string,
    description: string,
    config: ServerConfig,
  ): Promise<void> {
    if (this.sessions.has(serverId)) {
      await logger.debug(`Server ${serverId} already exists, removing first`);
      await this.removeServer(serverId);
    }

    let transport;
    if (config.transport === "sse") {
      if (!config.url) throw new Error("URL is required for SSE transport");
      transport = new SSEClientTransport(new URL(config.url));
    } else if (config.transport === "stdio") {
      if (!config.command)
        throw new Error("Command is required for stdio transport");

      // Use RuntimeCheck to resolve the command, which prioritizes bundled dependencies
      const { RuntimeCheck } = await import(
        "../mcp-server/utils/runtimeCheck.js"
      );
      // Extract command name first (handles paths with spaces correctly)
      const commandName = RuntimeCheck.extractCommandName(config.command);
      const resolvedCommand = RuntimeCheck.resolveDependency(commandName);

      const enhancedPath = getEnhancedPath();
      const serverParams: StdioServerParameters = {
        command: resolvedCommand,
        args: config.args || [],
        env: {
          ...(process.env as Record<string, string>),
          PATH: enhancedPath,
          ...(config.env || {}),
        },
        stderr: "pipe",
      };
      transport = new StdioClientTransport(serverParams);
    } else {
      throw new Error(`Invalid transport type: ${config.transport}`);
    }

    const client = new Client(
      { name: serverId, version: "1.0.0" },
      { capabilities: { prompts: {}, resources: {}, tools: {} } },
    );

    try {
      const toolsResponse = await this.connectWithHandshakeTimeout(
        client,
        transport,
        60000,
      );
      const tools = toolsResponse.tools || [];

      this.sessions.set(serverId, client);
      this.tools.set(serverId, tools);
      this.serverNames.set(serverId, serverName);

      const updatedEntry = {
        ...config,
        server_name: serverName,
        description,
      };

      const currentConfig = await this.loadConfig();
      await this.saveConfig({
        ...currentConfig,
        [serverId]: updatedEntry,
      });

      this.config[serverId] = updatedEntry;

      await logger.info(
        `Successfully installed server ${serverId} with ${tools.length} tools`,
      );
    } catch (err) {
      // Clean up on failure
      this.sessions.delete(serverId);
      this.tools.delete(serverId);
      this.serverNames.delete(serverId);

      // Close transport if it was created
      if (client && client.transport) {
        try {
          await client.transport.close();
        } catch (closeErr) {
          await logger.warn(
            `Failed to close transport during cleanup: ${closeErr}`,
          );
        }
      }

      throw err;
    }
  }

  async callTool(
    serverId: string,
    toolName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arguments_: Record<string, any>,
    timeout = 60000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    // Check for ongoing installation before attempting to install
    const existingInstall = this.installationPromises.get(serverId);
    if (existingInstall) {
      await logger.debug(`Waiting for ongoing installation of ${serverId}...`);
      await existingInstall;
    }

    if (!this.sessions.has(serverId)) {
      const config = this.config[serverId];
      if (!config) throw new Error(`No config found for server ${serverId}`);
      const name = config.server_name || serverId;
      const description = config.description || "";
      await this.install(serverId, name, description, config);
    }

    const client = this.sessions.get(serverId);
    if (!client) throw new Error(`Server ${serverId} is not initialized`);

    let watchdogTimer: NodeJS.Timeout | undefined;
    let didTimeout = false;

    const watchdog = new Promise<never>((_, reject) => {
      watchdogTimer = setTimeout(async () => {
        didTimeout = true;
        await logger.error(
          `[WATCHDOG] Tool call to ${toolName} on server ${serverId} timed out after ${timeout}ms. Removing server.`,
        );
        await this.removeServer(serverId);
        reject(new Error(`Tool call timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      const result = (await Promise.race([
        client.callTool({ name: toolName, arguments: arguments_ }),
        watchdog,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ])) as { content: any };

      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = undefined;
      }
      return result.content;
    } catch (err) {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = undefined;
      }

      if (!didTimeout) {
        await logger.error(
          `callTool failed for ${toolName} on ${serverId}: ${String(err)}`,
        );
        await this.removeServer(serverId);
      }

      throw err;
    }
  }

  async uninstall(serverId: string): Promise<void> {
    // Wait for any ongoing installation to complete before uninstalling
    const existingInstall = this.installationPromises.get(serverId);
    if (existingInstall) {
      await logger.debug(
        `Waiting for ongoing installation of ${serverId} before uninstalling...`,
      );
      try {
        await existingInstall;
      } catch (err) {
        // Installation failed, continue with uninstall
        await logger.debug(
          `Installation failed, continuing with uninstall: ${err}`,
        );
      }
    }

    // Remove the server from memory
    await this.removeServer(serverId);

    // Remove the server from the config file
    let config: Record<string, ServerConfig> = {};
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      config = JSON.parse(data);
    } catch (error) {
      // If config file doesn't exist, nothing to do
      await logger.debug(
        `Could not read existing config for uninstall: ${error}`,
      );
      return;
    }

    if (Object.prototype.hasOwnProperty.call(config, serverId)) {
      delete config[serverId];
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      await logger.debug(
        `Removed server ${serverId} from config at ${this.configPath}`,
      );
    }

    // Remove from in-memory config as well
    delete this.config[serverId];
  }

  async removeServer(serverId: string): Promise<void> {
    const client = this.sessions.get(serverId);
    if (client && client.transport) {
      try {
        await client.transport.close();
      } catch (err) {
        await logger.warn(`Failed to close transport for ${serverId}: ${err}`);
      }
    }

    this.sessions.delete(serverId);
    this.tools.delete(serverId);
    this.serverNames.delete(serverId);
  }

  async listServers(): Promise<
    Array<{
      server_id: string;
      server_name: string;
      tool_count: number;
      description: string;
    }>
  > {
    const config = await this.loadConfig();
    return Object.entries(config).map(([id, cfg]) => ({
      server_id: id,
      server_name: cfg.server_name || id,
      tool_count: this.tools.get(id)?.length || 0,
      description: cfg.description || "",
    }));
  }

  async listTools(serverId: string): Promise<Tool[]> {
    // Check for ongoing installation
    const existingInstall = this.installationPromises.get(serverId);
    if (existingInstall) {
      await logger.debug(`Waiting for ongoing installation of ${serverId}...`);
      await existingInstall;
    }

    if (!this.tools.has(serverId)) {
      const config = this.config[serverId];
      if (!config) throw new Error(`No config for server ${serverId}`);
      await this.install(
        serverId,
        config.server_name || serverId,
        config.description || "",
        config,
      );
    }
    return this.tools.get(serverId) || [];
  }

  async getServerConfig(serverId: string): Promise<ServerConfig> {
    // Always reload config from disk to ensure up-to-date
    const config = await this.loadConfig();
    const serverConfig = config[serverId];
    if (!serverConfig) {
      throw new Error(`No config found for server ${serverId}`);
    }
    return serverConfig;
  }

  async cleanup(): Promise<void> {
    // Wait for all ongoing installations to complete
    const ongoingInstalls = Array.from(this.installationPromises.values());
    if (ongoingInstalls.length > 0) {
      await logger.debug(
        `Waiting for ${ongoingInstalls.length} ongoing installations to complete...`,
      );
      await Promise.allSettled(ongoingInstalls);
    }

    // Clean up all sessions
    for (const serverId of this.sessions.keys()) {
      await this.removeServer(serverId);
    }

    // Clear the installation promises map
    this.installationPromises.clear();
  }
}
