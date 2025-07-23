import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { findServerManagerClient } from "./serverManagerUtils.js";
import { UninstallParams } from "../../shared/mcpServerTypes.js";
import { ServerUninstallResultSchema } from "../../shared/serverManagerTypes.js";
import { FileLogger } from "../../shared/fileLogger.js";
import Registry from "../registry.js";

const logger = FileLogger;

export async function handleUninstallServer(
  params: UninstallParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  const serverManagerClients = Registry.getServerManagerClients();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const serversCache = Registry.getServersCache();
  const clientContext = Registry.getClientContext();
  const policyEnforcer = Registry.getPolicyEnforcer();
  const installObserver = policyEnforcer.getInstallObserver();
  let errorMessage: string | undefined;

  try {
    // Check if the client is in restricted mode
    if (clientContext.clientMode === "restricted") {
      throw new Error(
        "Uninstall functionality is disabled in restricted mode.",
      );
    }

    const server_id = params!.server_id as string;
    await logger.info(`Handling uninstall request for server ${server_id}`);

    const client = await findServerManagerClient(
      server_id,
      serverManagerClients,
    );
    const response = await client.sendRequest("uninstall", { server_id });

    if ("error" in response) {
      errorMessage = `Failed to uninstall server_id: ${server_id}, error message: ${response.error.message}`;
      throw new Error(errorMessage);
    }

    const parsed = ServerUninstallResultSchema.safeParse(response);
    if (!parsed.success) {
      throw new Error(`Invalid uninstall response: ${parsed.error}`);
    }

    // Refresh the servers cache after successful uninstall
    await serversCache.refreshCache(serverManagerClients);

    await logger.info(`Successfully uninstalled server ${server_id}`);

    await telemetryLogger.log("client_uninstall", {
      success: true,
      log_context: {
        server_id: parsed.data.server_id,
      },
      latency_ms: Date.now() - startTime,
    });

    return {
      role: "system",
      content: [
        {
          type: "text",
          text: promptsCache
            .getPrompt("uninstall_success")
            .replace("{SERVER_ID}", parsed.data.server_id)
            .replace("{SERVER_NAME}", parsed.data.server_name),
        },
      ],
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = promptsCache.getPrompt("unexpected_error");
    }
    await logger.error(`Failed to uninstall server: ${errorMessage}`);

    await telemetryLogger.log("client_uninstall", {
      success: false,
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    return {
      role: "system",
      content: [
        {
          type: "text",
          text: promptsCache
            .getPrompt("uninstall_failure")
            .replace("{ERROR}", errorMessage),
        },
      ],
    };
  } finally {
    // Record the uninstall action regardless of success or failure
    installObserver.recordUninstall(params.server_id);
  }
}
