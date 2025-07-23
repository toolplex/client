// stdioServer.ts
import { ServerManager } from "./serverManager.js";
import {
  StdioTransport,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
} from "./stdioTransportProtocol.js";
import { FileLogger } from "../shared/fileLogger.js";
import {
  CallToolParamsSchema,
  InstallParamsSchema,
  ListToolsParamsSchema,
  UninstallParamsSchema,
} from "../shared/mcpServerTypes.js";

const logger = FileLogger;

export class ServerManagerProtocol {
  private transport: StdioTransport;
  private serverManager: ServerManager;

  constructor() {
    this.serverManager = new ServerManager();
    this.transport = new StdioTransport();
    this.transport.setOnMessage(this.handleMessage.bind(this));

    // Clean up on process exit
    process.on("exit", async () => {
      await logger.info("Process exit - cleaning up server manager");
      await logger.flush();
      await this.serverManager.cleanup();
    });

    process.on("SIGINT", async () => {
      await logger.warn("SIGINT received - cleaning up server manager");
      await logger.flush();
      await this.serverManager.cleanup();
      process.exit();
    });

    process.on("SIGTERM", async () => {
      await logger.warn("SIGTERM received - cleaning up server manager");
      await logger.flush();
      await this.serverManager.cleanup();
      process.exit();
    });
  }

  async start(): Promise<void> {
    await logger.info("Starting ServerManagerProtocol transport");
    await this.transport.start();
    await logger.info("ServerManagerProtocol transport started successfully");
  }

  private async safeSend(msg: JSONRPCResponse) {
    try {
      await this.transport.send(msg);
    } catch (e) {
      process.stderr.write(`transport.send failed: ${e}\n`);
    }
  }

  private async handleMessage(message: JSONRPCMessage): Promise<void> {
    try {
      if (!("id" in message) || !("method" in message)) {
        await this.safeSend({
          jsonrpc: "2.0",
          error: { code: -1001, message: "Invalid Request" },
          id: null,
        });
        return;
      }

      const req = message as JSONRPCRequest;
      let result: unknown;

      try {
        result = await this.callMethod(req.method, req.params ?? {});
      } catch (err) {
        await logger.error(
          `callMethod failed (${req.method}): ${err instanceof Error ? err.message : "Unknown error"}`,
        );
        await this.safeSend({
          jsonrpc: "2.0",
          error: {
            code: -1000,
            message: err instanceof Error ? err.message : "Server error",
          },
          id: req.id,
        });
        return;
      }

      await this.safeSend({ jsonrpc: "2.0", result, id: req.id });
    } catch (fatal: unknown) {
      process.stderr.write(`handleMessage fatal: ${String(fatal)}\n`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async callMethod(method: string, params: any): Promise<any> {
    switch (method) {
      case "initialize": {
        await logger.info("Calling ServerManager.initialize()");
        const { succeeded, failures } = await this.serverManager.initialize();
        return { succeeded, failures };
      }

      case "install": {
        const install_params = InstallParamsSchema.parse(params);
        await logger.info(`Installing server ${install_params.server_id}`);
        await this.serverManager.install(
          install_params.server_id,
          install_params.server_name,
          install_params.description,
          install_params.config,
        );
        const server_name = await this.serverManager.getServerName(
          install_params.server_id,
        );
        return { server_id: install_params.server_id, server_name };
      }

      case "list_servers": {
        await logger.debug("Listing servers");
        const servers = await this.serverManager.listServers();
        return { servers };
      }

      case "list_tools": {
        const list_tools_params = ListToolsParamsSchema.parse(params);
        if (!list_tools_params.server_id) throw new Error("Missing server_id");
        await logger.debug(
          `Listing tools for server ${list_tools_params.server_id}`,
        );
        const tools = await this.serverManager.listTools(
          list_tools_params.server_id,
        );
        const server_name = await this.serverManager.getServerName(
          list_tools_params.server_id,
        );
        return { server_id: list_tools_params.server_id, server_name, tools };
      }

      case "get_server_config": {
        if (!params || typeof params.server_id !== "string") {
          throw new Error("Missing or invalid server_id");
        }
        await logger.debug(`Getting config for server ${params.server_id}`);
        // Just return the config directly
        const config = await this.serverManager.getServerConfig(
          params.server_id,
        );
        return config;
      }

      case "call_tool": {
        const call_tool_params = CallToolParamsSchema.parse(params);
        await logger.debug(
          `Calling tool ${call_tool_params.tool_name} on server ${call_tool_params.server_id}`,
        );
        const result = await this.serverManager.callTool(
          call_tool_params.server_id,
          call_tool_params.tool_name,
          call_tool_params.arguments,
          60000, // 60s timeout
        );
        return { result };
      }

      case "uninstall": {
        const uninstall_params = UninstallParamsSchema.parse(params);
        await logger.info(`Uninstalling server ${uninstall_params.server_id}`);
        const server_name = await this.serverManager.getServerName(
          uninstall_params.server_id,
        );
        await this.serverManager.uninstall(uninstall_params.server_id);
        return { server_id: uninstall_params.server_id, server_name };
      }

      case "cleanup": {
        await logger.info("Cleaning up server manager");
        await this.serverManager.cleanup();
        return {};
      }

      default:
        await logger.error(`Method ${method} not found`);
        throw new Error(`Method ${method} not found`);
    }
  }
}
