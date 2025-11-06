#!/usr/bin/env node

import path from "path";
import { fileURLToPath } from "url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolResult,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { ClientContext } from "./clientContext.js";
import Registry from "./registry.js";
import { PRE_INITIALIZATION_PROMPTS } from "./staticPrompts.js";
import { createToolDefinitions } from "./tools.js";

import { handleInitialize } from "./toolHandlers/initHandler.js";
import { handleSearchTool } from "./toolHandlers/searchHandler.js";
import { handleInstallServer } from "./toolHandlers/installServerHandler.js";
import { handleListTools } from "./toolHandlers/listToolsHandler.js";
import { handleListServers } from "./toolHandlers/listServersHandler.js";
import { handleCallTool } from "./toolHandlers/callToolHandler.js";
import { handleUninstallServer } from "./toolHandlers/uninstallServerHandler.js";
import { handleSavePlaybook } from "./toolHandlers/savePlaybookHandler.js";
import { handleLogPlaybookUsage } from "./toolHandlers/logPlaybookUsageHandler.js";
import { handleLookupEntityTool } from "./toolHandlers/lookupEntityHandler.js";
import { handleSubmitFeedback } from "./toolHandlers/submitFeedbackHandler.js";
import { handleGetServerConfig } from "./toolHandlers/getServerConfigHandler.js";

import { StdioServerManagerClient } from "../shared/stdioServerManagerClient.js";
import { FileLogger } from "../shared/fileLogger.js";
import {
  ToolplexServerConfig,
  CallToolParamsSchema,
  InitializeToolplexParamsSchema,
  InstallParamsSchema,
  ListToolsParamsSchema,
  SearchParamsSchema,
  UninstallParamsSchema,
  SavePlaybookParamsSchema,
  LogPlaybookUsageParamsSchema,
  LookupEntityParamsSchema,
  SubmitFeedbackParamsSchema,
  GetServerConfigParamsSchema,
} from "../shared/mcpServerTypes.js";

import { version as clientVersion } from "../version.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = FileLogger;

export async function serve(config: ToolplexServerConfig): Promise<void> {
  const clientContext = new ClientContext();
  clientContext.dev = config.dev;
  clientContext.apiKey = config.apiKey;
  clientContext.clientMode = config.clientMode;
  clientContext.clientName = config.clientName;
  clientContext.clientVersion = clientVersion;

  await Registry.init(clientContext);

  // Store bundled dependencies in Registry for use throughout the application
  if (config.bundledDependencies) {
    Registry.setBundledDependencies(config.bundledDependencies);
    await logger.debug(
      `Bundled dependencies registered: ${JSON.stringify(config.bundledDependencies)}`,
    );
  }

  // Store server config in Registry (includes session resume history)
  Registry.setServerConfig(config);

  await logger.info(
    `Starting Toolplex server in ${config.dev ? "development" : "production"} mode`,
  );

  const server = new Server(
    {
      name: "toolplex-server",
      version: clientContext.clientVersion,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  // Initialize server manager clients
  await logger.info("Initializing server manager clients");
  const serverManagerClients: Record<string, StdioServerManagerClient> = {
    node: new StdioServerManagerClient(
      "node",
      [path.join(__dirname, "..", "server-manager", "index.js")],
      { LOG_LEVEL: config.logLevel },
    ),
  };

  // Start all server manager clients
  await logger.info("Starting server manager clients");
  await Promise.all(
    Object.values(serverManagerClients).map((client) => client.start()),
  );
  await logger.info("All server manager clients started successfully");

  Registry.setServerManagerClients(serverManagerClients);

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    await logger.debug("Handling list tools request");
    return {
      tools: createToolDefinitions(),
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: params } = request.params;
    await logger.info(`Handling tool call request for tool: ${name}`);
    let result: CallToolResult;

    if (!Registry.getToolDefinitionsCache().isInitialized()) {
      result = {
        isError: true,
        content: [
          {
            type: "text",
            text: PRE_INITIALIZATION_PROMPTS.tools_initialization_error,
          },
        ],
      };
      return result;
    }

    if (!clientContext.isInitialized() && name !== "initialize_toolplex") {
      result = {
        role: "system",
        content: [
          {
            type: "text",
            text: PRE_INITIALIZATION_PROMPTS.enforce_init_toolplex.replace(
              "{TOOL_NAME}",
              name,
            ),
          },
        ],
      };
      return result;
    }

    try {
      switch (name) {
        case "initialize_toolplex": {
          await logger.debug("Handling initialize_toolplex request");
          const parsed = InitializeToolplexParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(
              `Invalid initialize_toolplex params: ${parsed.error}`,
            );
          clientContext.llmContext = parsed.data.llm_context;
          result = await handleInitialize(parsed.data);
          break;
        }

        case "search": {
          await logger.debug("Handling search request");
          const parsed = SearchParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(`Invalid search params: ${parsed.error}`);
          result = await handleSearchTool(parsed.data);
          break;
        }

        case "install": {
          await logger.debug("Handling install request");
          const parsed = InstallParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(`Invalid install params: ${parsed.error}`);
          result = await handleInstallServer(parsed.data);
          server.sendToolListChanged();
          break;
        }

        case "list_tools": {
          await logger.debug("Handling list_tools request");
          const parsed = ListToolsParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(
              `Invalid list_toolplex_tools params: ${parsed.error}`,
            );
          result = await handleListTools(parsed.data);
          break;
        }

        case "list_servers": {
          await logger.debug("Handling list_toolplex_tools request");
          result = await handleListServers();
          break;
        }

        case "call_tool": {
          await logger.debug("Handling call_tool request");
          const parsed = CallToolParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(`Invalid call_tool params: ${parsed.error}`);
          result = await handleCallTool(parsed.data);
          break;
        }

        case "uninstall": {
          await logger.debug("Handling uninstall request");
          const parsed = UninstallParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(`Invalid uninstall params: ${parsed.error}`);
          result = await handleUninstallServer(parsed.data);
          break;
        }

        case "save_playbook": {
          await logger.debug("Handling save_playbook request");
          const parsed = SavePlaybookParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(`Invalid save_playbook params: ${parsed.error}`);
          if (!clientContext.isInitialized())
            throw new Error(`ToolPlex is not initialized`);
          result = await handleSavePlaybook(parsed.data);
          break;
        }

        case "log_playbook_usage": {
          await logger.debug("Handling log_playbook_usage request");
          const parsed = LogPlaybookUsageParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(
              `Invalid log_playbook_usage params: ${parsed.error}`,
            );
          if (!clientContext.isInitialized())
            throw new Error(`ToolPlex is not initialized`);
          result = await handleLogPlaybookUsage(parsed.data);
          break;
        }

        case "lookup_entity": {
          await logger.debug("Handling lookup_entity request");
          const parsed = LookupEntityParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(`Invalid lookup_entity params: ${parsed.error}`);
          result = await handleLookupEntityTool(parsed.data);
          break;
        }

        case "submit_feedback": {
          await logger.debug("Handling submit_feedback request");
          const parsed = SubmitFeedbackParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(`Invalid submit_feedback params: ${parsed.error}`);
          if (!clientContext.isInitialized())
            throw new Error(`ToolPlex is not initialized`);
          result = await handleSubmitFeedback(parsed.data);
          break;
        }

        // Add get_server_config tool handler
        case "get_server_config": {
          await logger.debug("Handling get_server_config request");
          const parsed = GetServerConfigParamsSchema.safeParse(params);
          if (!parsed.success)
            throw new Error(
              `Invalid get_server_config params: ${parsed.error}`,
            );
          result = await handleGetServerConfig(parsed.data);
          break;
        }

        default:
          await logger.warn(`Unknown tool requested: ${name}`);
          result = {
            role: "system",
            content: [
              {
                type: "text",
                text: PRE_INITIALIZATION_PROMPTS.unknown_tool.replace(
                  "{TOOL_NAME}",
                  name,
                ),
              },
            ],
          };
      }
    } catch (error: unknown) {
      let errorMessage = "Unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      await logger.error(`Error calling ToolPlex: ${errorMessage}`);
      result = {
        isError: true,
        role: "system",
        content: [
          {
            type: "text",
            text: PRE_INITIALIZATION_PROMPTS.unexpected_error.replace(
              "{ERROR}",
              errorMessage,
            ),
          },
        ],
      };
    }

    return result;
  });

  const transport = new StdioServerTransport();
  await logger.info("Connecting server transport");
  await server.connect(transport);
  await logger.info("Server transport connected successfully");

  // Clean up on process exit
  process.on("exit", async () => {
    await logger.info("Process exit - stopping server manager clients");
    await logger.flush();
    Object.values(serverManagerClients).forEach((client) => client.stop());
  });

  process.on("SIGINT", async () => {
    await logger.warn("SIGINT received - stopping server manager clients");
    await logger.flush();
    Object.values(serverManagerClients).forEach((client) => client.stop());
    process.exit();
  });

  process.on("SIGTERM", async () => {
    await logger.warn("SIGTERM received - stopping server manager clients");
    await logger.flush();
    Object.values(serverManagerClients).forEach((client) => client.stop());
    process.exit();
  });
}
