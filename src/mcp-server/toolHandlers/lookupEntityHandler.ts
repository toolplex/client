import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileLogger } from "../../shared/fileLogger.js";
import { LookupEntityParams } from "../../shared/mcpServerTypes.js";
import Registry from "../registry.js";
import { ServersCache } from "../serversCache.js";
import { annotateInstalledServer } from "../utils/resultAnnotators.js";

const logger = FileLogger;

export async function handleLookupEntityTool(
  params: LookupEntityParams,
): Promise<CallToolResult> {
  const startTime = Date.now();
  await logger.debug(
    `Handling lookup entity request for ${params.entity_type} with ID: ${params.entity_id}`,
  );

  const apiService = Registry.getToolplexApiService();
  const telemetryLogger = Registry.getTelemetryLogger();
  const promptsCache = Registry.getPromptsCache();
  const serversCache: ServersCache = Registry.getServersCache();
  const policyEnforcer = Registry.getPolicyEnforcer();
  const clientContext = Registry.getClientContext();

  try {
    // Check if the client is in restricted mode
    if (clientContext.clientMode === "restricted") {
      throw new Error("Lookup functionality is disabled in restricted mode.");
    }

    // Enforce blocked server policy if looking up a server
    if (params.entity_type === "server") {
      policyEnforcer.enforceUseServerPolicy(params.entity_id);
    }

    const lookupResponse = await apiService.lookupEntity(
      params.entity_type,
      params.entity_id,
      params.include_readme,
    );

    // Annotate installed server using resultAnnotators
    if (
      params.entity_type === "server" &&
      lookupResponse &&
      typeof lookupResponse === "object" &&
      lookupResponse.result &&
      typeof lookupResponse.result === "object"
    ) {
      try {
        lookupResponse.result = annotateInstalledServer(
          lookupResponse.result,
          serversCache,
        );
      } catch (err) {
        await logger.warn(`Error annotating installed server: ${err}`);
        // fallback: do not annotate
      }
    }

    if (!lookupResponse) {
      await logger.debug("No entity found");

      await telemetryLogger.log("client_lookup_entity", {
        success: true,
        log_context: {
          entity_type: params.entity_type,
          entity_id: params.entity_id,
        },
        latency_ms: Date.now() - startTime,
      });

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: promptsCache
              .getPrompt("lookup_entity_not_found")
              .replace("{entity_type}", params.entity_type)
              .replace("{entity_id}", params.entity_id),
          } as { [x: string]: unknown; type: "text"; text: string },
        ],
      };
    }

    await logger.debug(`Found entity: ${JSON.stringify(lookupResponse)}`);

    await logger.debug("Lookup completed successfully");

    await telemetryLogger.log("client_lookup_entity", {
      success: true,
      log_context: {
        entity_type: params.entity_type,
        entity_id: params.entity_id,
      },
      latency_ms: Date.now() - startTime,
    });

    // Return structured data first for easy frontend parsing, then instructions
    const content = [
      // First: Structured JSON for easy parsing
      {
        type: "text",
        text: JSON.stringify({
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          result: lookupResponse,
        }),
      } as { [x: string]: unknown; type: "text"; text: string },
      // Second: Human-readable summary
      {
        type: "text",
        text: `Found ${params.entity_type}: ${lookupResponse.server_name || lookupResponse.description || params.entity_id}`,
      } as { [x: string]: unknown; type: "text"; text: string },
    ];

    // Add installation guidance for server lookups, but not for org users
    // (org users don't have install tools - they use pre-approved tools only)
    if (params.entity_type === "server" && !clientContext.isOrgUser) {
      const installGuidance = promptsCache.getPrompt(
        "lookup_entity_install_guidance",
      );
      if (installGuidance) {
        content.push({
          type: "text",
          text: installGuidance,
          _meta: { role: "system" },
        } as { [x: string]: unknown; type: "text"; text: string });
      }
    }

    return {
      content,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logger.error(`Error looking up entity: ${errorMessage}`);

    await telemetryLogger.log("client_lookup_entity", {
      success: false,
      log_context: {
        entity_type: params.entity_type,
        entity_id: params.entity_id,
      },
      pii_sanitized_error_message: errorMessage,
      latency_ms: Date.now() - startTime,
    });

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: promptsCache
            .getPrompt("lookup_entity_error")
            .replace("{entity_type}", params.entity_type)
            .replace("{ERROR}", errorMessage),
        } as { [x: string]: unknown; type: "text"; text: string },
      ],
    };
  }
}
