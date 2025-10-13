import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import os from "os";
import { InitializeToolplexParams } from "../../shared/mcpServerTypes.js";
import { initServerManagersOnly } from "../utils/initServerManagers.js";
import Registry from "../registry.js";
import envPaths from "env-paths";
import which from "which";
import { getEnhancedPath } from "../../shared/enhancedPath.js";
import * as fs from "fs";

const logger = FileLogger;

/**
 * Helper to resolve dependency path with fallback:
 * 1. Bundled dependency (if available)
 * 2. System PATH (fallback)
 * 3. "not available" if neither exists
 *
 * Exported for testing purposes.
 */
export function resolveDependencyForInit(
  bundledPath: string | undefined,
  commandName: string,
): string {
  // Check bundled first
  if (bundledPath && fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Fall back to system PATH
  try {
    const enhancedPath = getEnhancedPath();
    const systemPath = which.sync(commandName, {
      path: enhancedPath,
      nothrow: true,
    });
    if (systemPath) {
      return `${systemPath} (system)`;
    }
  } catch {
    // Ignore errors, will return "not available"
  }

  return "not available";
}

export async function handleInitialize(
  params: InitializeToolplexParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  await logger.info("Initializing ToolPlex");
  await logger.debug(`Initialization params: ${JSON.stringify(params)}`);

  const clientContext = Registry.getClientContext();
  const apiService = Registry.getToolplexApiService();
  const serverManagerClients = Registry.getServerManagerClients();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const serversCache = Registry.getServersCache();
  const policyEnforcer = Registry.getPolicyEnforcer();

  await logger.debug(
    `Server manager clients: ${Object.keys(serverManagerClients).join(", ")}`,
  );

  const platform = os.platform();
  const osName =
    platform === "darwin"
      ? "macOS"
      : platform === "win32"
        ? "Windows"
        : platform.charAt(0).toUpperCase() + platform.slice(1);

  const paths = envPaths("ToolPlex", { suffix: "" });

  // Get bundled dependency information
  const bundledDeps = Registry.getBundledDependencies();

  const systemInfo = {
    os: `${osName} ${os.release()}`,
    arch: os.arch(),
    memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
    cpuCores: os.cpus().length,
    workDir: paths.data,
    date: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    // Resolve dependency paths with bundled > system > not available priority
    nodePath: resolveDependencyForInit(bundledDeps.node, "node"),
    pythonPath: resolveDependencyForInit(
      bundledDeps.python,
      platform === "win32" ? "python" : "python3",
    ),
    gitPath: resolveDependencyForInit(bundledDeps.git, "git"),
    uvxPath: resolveDependencyForInit(bundledDeps.uvx, "uvx"),
    npxPath: resolveDependencyForInit(bundledDeps.npx, "npx"),
  };

  await logger.debug("Initializing server managers and API service");
  const [serverManagerInitResults, toolplexApiInitResponse] = await Promise.all(
    [
      initServerManagersOnly(serverManagerClients).catch((err) => {
        logger.warn(`Server manager init failed: ${err}`);
        return { succeeded: [], failures: {} };
      }),
      apiService.init(),
    ],
  );

  clientContext.isOrgUser = toolplexApiInitResponse.is_org_user;
  clientContext.sessionId = toolplexApiInitResponse.session_id;
  clientContext.permissions = toolplexApiInitResponse.permissions;
  clientContext.flags = toolplexApiInitResponse.flags;

  // Replace {ARGS.workDir} in all prompts before initializing the cache
  const processedPrompts = { ...toolplexApiInitResponse.prompts };
  for (const [key, prompt] of Object.entries(processedPrompts)) {
    if (typeof prompt === "string") {
      processedPrompts[key] = prompt.replace(/\{ARGS\.workDir\}/g, paths.data);
    }
  }
  promptsCache.init(processedPrompts);

  // Init PolicyEnforce after setting permissions and flags
  policyEnforcer.init(clientContext);

  const allSucceeded = serverManagerInitResults.succeeded;
  const allFailures = serverManagerInitResults.failures;

  // Initialize the serversCache with the succeeded servers
  serversCache.init(allSucceeded);

  await logger.debug(
    `Total successes: ${allSucceeded.length}, Total failures: ${Object.keys(allFailures).length}`,
  );
  await logger.debug("Building initialization response");

  // Safe to use prompts after init.
  const result: CallToolResult = {
    content: [
      {
        type: "text",
        text: promptsCache
          .getPrompt("initialization")
          .replace("{ARGS.os}", systemInfo.os)
          .replace("{ARGS.arch}", systemInfo.arch)
          .replace("{ARGS.memory}", systemInfo.memory)
          .replace("{ARGS.cpuCores}", systemInfo.cpuCores.toString())
          .replace("{ARGS.workDir}", systemInfo.workDir)
          .replace("{ARGS.date}", systemInfo.date)
          .replace("{ARGS.nodePath}", systemInfo.nodePath)
          .replace("{ARGS.pythonPath}", systemInfo.pythonPath)
          .replace("{ARGS.gitPath}", systemInfo.gitPath)
          .replace("{ARGS.uvxPath}", systemInfo.uvxPath)
          .replace("{ARGS.npxPath}", systemInfo.npxPath),
      },
    ],
  };

  result.content.push({
    type: "text",
    text: promptsCache
      .getPrompt("initialization_results")
      .replace(
        "{SUCCEEDED}",
        allSucceeded
          .map((s) => `${s.server_id} (${s.server_name})`)
          .join(", ") || "none",
      )
      .replace(
        "{FAILURES}",
        Object.entries(allFailures)
          .map(
            ([serverId, failure]) =>
              `${serverId} (${failure.server_name}): ${failure.error}`,
          )
          .join(", ") || "none",
      )
      .replace(
        "{FAILURE_NOTE}",
        Object.keys(allFailures).length > 0
          ? "Please note there were failures installing some servers. Inform the user."
          : "",
      ),
  });

  if (
    clientContext.permissions.allowed_mcp_servers &&
    clientContext.permissions.allowed_mcp_servers.length > 0
  ) {
    result.content.push({
      type: "text",
      text: promptsCache
        .getPrompt("allowed_mcp_servers")
        .replace(
          "{ALLOWED_MCP_SERVERS}",
          clientContext.permissions.allowed_mcp_servers.join(", "),
        ),
    });
  }

  result.content.push({
    type: "text",
    text:
      "Your Most Recently Used Playbooks:\n" +
      toolplexApiInitResponse.playbooks.playbooks
        .map(
          (p) =>
            `- ${p.id}: ${p.description}\n` +
            `  Used ${p.times_used} times` +
            (p.days_since_last_used !== null
              ? `, last use: ${p.days_since_last_used} ${p.days_since_last_used === 1 ? "day" : "days"} ago`
              : ""),
        )
        .join("\n") +
      "\n\nMore playbooks are available through the search tool.",
  });

  if (toolplexApiInitResponse.announcement) {
    result.content.push({
      type: "text",
      text: `\nToolPlex Platform Announcements: ${toolplexApiInitResponse.announcement}`,
    });
  }

  await telemetryLogger.log("client_initialize_toolplex", {
    session_id: toolplexApiInitResponse.session_id,
    success: Object.keys(allFailures).length === 0,
    log_context: {
      os_platform: platform,
      os_arch: systemInfo.arch,
      cpu_cores: systemInfo.cpuCores,
      total_memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
      num_succeeded_servers: allSucceeded.length,
      num_failed_servers: Object.keys(allFailures).length,
      num_recent_playbooks: toolplexApiInitResponse.playbooks.playbooks.length,
    },
    latency_ms: Date.now() - startTime,
  });

  await logger.info("ToolPlex initialization completed");
  return result;
}
