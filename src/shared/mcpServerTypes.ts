// src/types/types.ts
import { z } from "zod";
import type { AutomationContext } from "../mcp-server/toolplexApi/types.js";

export type ClientMode = "standard" | "restricted" | "automation";
export type LogLevel = "error" | "warn" | "info" | "debug";

/**
 * Paths to bundled dependencies provided by the host application (e.g., Electron).
 * These dependencies are required for MCP server installations and execution.
 *
 * NOTE: On Unix systems, npm/npx paths point to the actual CLI .js files
 * (e.g., lib/node_modules/npm/bin/npx-cli.js) because electron-builder dereferences
 * symlinks during packaging. These must be invoked via `node <script>`.
 */
export interface BundledDependencies {
  node?: string; // Path to Node.js executable
  npm?: string; // Path to npm CLI script (invoke via node)
  npx?: string; // Path to npx CLI script (invoke via node)
  python?: string; // Path to Python executable (python3)
  pip?: string; // Path to pip executable (pip3)
  uv?: string; // Path to uv executable (Python package manager)
  uvx?: string; // Path to uvx executable (Python package runner)
  git?: string; // Path to Git executable
}

export interface ToolplexServerConfig {
  dev: boolean;
  apiKey: string;
  clientMode: ClientMode;
  clientName: string;
  logLevel: LogLevel;
  bundledDependencies?: BundledDependencies;
  sessionResumeHistory?: {
    tool_calls: Array<{ server_id: string; tool_name: string }>;
    installs: Array<{ server_id: string }>;
    uninstalls: Array<{ server_id: string }>;
  };
  /** Optional user ID for system API keys to specify user context (per-user telemetry) */
  userId?: string;
  /** Automation context for HITL support (only set in automation mode) */
  automationContext?: AutomationContext;
}

// --------------------
// Enums
// --------------------
export const TransportTypeSchema = z.enum(["stdio", "sse"]);
export type TransportType = z.infer<typeof TransportTypeSchema>;

export const RuntimeSchema = z.enum(["node", "python", "go", "docker"]);
export type Runtime = z.infer<typeof RuntimeSchema>;

// --------------------
// LLMContext
// --------------------
export const LLMContextSchema = z
  .object({
    model_family: z.string(),
    model_name: z.string().min(1),
    model_version: z.string(),
    chat_client: z.string().optional(),
  })
  .strict();

export type LLMContext = z.infer<typeof LLMContextSchema>;

// --------------------
// ServerConfig
// --------------------
export const ServerConfigSchema = z.object({
  server_name: z.string().optional(),
  description: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  runtime: RuntimeSchema.optional(),
  env: z.record(z.string()).optional(),
  url: z.string().optional(),
  transport: TransportTypeSchema,
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// --------------------
// InitializeToolplexParams
// --------------------
export const InitializeToolplexParamsSchema = z.object({
  llm_context: LLMContextSchema,
});

export type InitializeToolplexParams = z.infer<
  typeof InitializeToolplexParamsSchema
>;

// --------------------
// SearchParams
// --------------------
export const SearchParamsSchema = z.object({
  query: z.string(),
  expanded_keywords: z.array(z.string()).optional(),
  filter: z.enum(["all", "servers_only", "playbooks_only"]).optional(),
  size: z.number().int().min(1).max(25).optional(),
  scope: z.enum(["all", "public_only", "private_only"]).optional(),
});

export type SearchParams = z.infer<typeof SearchParamsSchema>;

// --------------------
// LookupEntityParams
// --------------------
export const LookupEntityParamsSchema = z.object({
  entity_type: z.enum(["server", "playbook", "feedback"]),
  entity_id: z.string(),
  include_readme: z.boolean().optional(),
});

export type LookupEntityParams = z.infer<typeof LookupEntityParamsSchema>;

// --------------------
// InstallParams
// --------------------
export const InstallParamsSchema = z.object({
  server_id: z.string(),
  server_name: z.string(),
  description: z.string(),
  config: ServerConfigSchema,
  timeout_ms: z.number().int().min(10000).max(300000).optional(),
});

export type InstallParams = z.infer<typeof InstallParamsSchema>;

// --------------------
// ListToolsParams
// --------------------
export const ListToolsParamsSchema = z.object({
  server_id: z.string().optional(),
});

export type ListToolplexToolsParams = z.infer<typeof ListToolsParamsSchema>;

// --------------------
// CallToolParams
// --------------------
export const CallToolParamsSchema = z.object({
  server_id: z.string(),
  tool_name: z.string(),
  arguments: z.record(z.any()),
});

export type CallToolParams = z.infer<typeof CallToolParamsSchema>;

// --------------------
// UninstallParams
// --------------------
export const UninstallParamsSchema = z.object({
  server_id: z.string(),
});

export type UninstallParams = z.infer<typeof UninstallParamsSchema>;

// --------------------
// PlaybookAction (shared type for actions)
// --------------------
export const PlaybookActionSchema = z.object({
  do: z.string(),
  call: z.string().optional(),
  args: z
    .record(
      z.object({
        type: z.enum([
          "string",
          "number",
          "boolean",
          "array",
          "object",
          "placeholder",
        ]),
        example: z.any(),
      }),
    )
    .optional(),
});

export type PlaybookAction = z.infer<typeof PlaybookActionSchema>;

// --------------------
// SavePlaybookParams
// --------------------
export const SavePlaybookParamsSchema = z.object({
  playbook_name: z.string(),
  description: z.string(),
  // Requires at least one action to have a "call" property
  actions: z
    .array(PlaybookActionSchema)
    .refine(
      (actions) =>
        actions.some(
          (action) => typeof action.call === "string" && action.call.length > 0,
        ),
      {
        message: 'At least one action must include a "call" property',
        path: ["actions"],
      },
    ),
  domain: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  privacy: z.enum(["public", "private", "organization"]).optional(),
  source_playbook_id: z.string().optional(),
  fork_reason: z.string().optional(),
  // Internal parameter for validation-only mode (not exposed to agent in tool definition)
  // Use coerce to handle both boolean and string "true"/"false" from different LLM clients
  validate_only: z.coerce.boolean().optional(),
});

export type SavePlaybookParams = z.infer<typeof SavePlaybookParamsSchema>;

// --------------------
// LogPlaybookUsageParams
// --------------------
export const LogPlaybookUsageParamsSchema = z.object({
  playbook_id: z.string(),
  success: z.boolean(),
  error_message: z.string().optional(),
});

export type LogPlaybookUsageParams = z.infer<
  typeof LogPlaybookUsageParamsSchema
>;

// --------------------
// WebSearchParams
// --------------------
export const WebSearchParamsSchema = z.object({
  query: z.string(),
  num_results: z.number().int().min(1).max(10).optional(),
  search_type: z.enum(["search", "news"]).optional(),
});

export type WebSearchParams = z.infer<typeof WebSearchParamsSchema>;

// --------------------
// FetchPageParams
// --------------------
export const FetchPageParamsSchema = z.object({
  url: z.string(),
});

export type FetchPageParams = z.infer<typeof FetchPageParamsSchema>;

// --------------------
// NotifyParams (for automation HITL notifications)
// --------------------
export const NotifyParamsSchema = z.object({
  title: z.string().max(100),
  content: z.string(),
  context: z.string().optional(),
  response_type: z.enum(["boolean", "multi_choice", "freeform"]),
  response_options: z.array(z.string()).optional(),
  pause_until_response: z.boolean(),
});

export type NotifyParams = z.infer<typeof NotifyParamsSchema>;
