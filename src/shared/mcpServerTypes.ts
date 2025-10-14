// src/types/types.ts
import { z } from "zod";

export type ClientMode = "standard" | "restricted";
export type LogLevel = "error" | "warn" | "info" | "debug";

/**
 * Paths to bundled dependencies provided by the host application (e.g., Electron).
 * These dependencies are required for MCP server installations and execution.
 */
export interface BundledDependencies {
  node?: string; // Path to Node.js executable
  npx?: string; // Path to npx executable (typically comes with Node)
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
// GetServerConfigParams
// --------------------
export const GetServerConfigParamsSchema = z.object({
  server_id: z.string().optional(),
});

export type GetServerConfigParams = z.infer<typeof GetServerConfigParamsSchema>;

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
  privacy: z.enum(["public", "private"]).optional(),
  source_playbook_id: z.string().optional(),
  fork_reason: z.string().optional(),
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
// SubmitFeedbackParams
// --------------------
export const SubmitFeedbackParamsSchema = z.object({
  target_type: z.enum(["server", "playbook"]),
  target_id: z.string(),
  vote: z.enum(["up", "down"]),
  message: z.string().optional(),
  security_assessment: z
    .object({
      security_flags: z.array(
        z.union([
          z.string(),
          z.object({
            custom_flag: z.string(),
          }),
        ]),
      ),
      risk_assessment: z.string(),
      context_note: z.string().optional(),
    })
    .optional(),
});

export type SubmitFeedbackParams = z.infer<typeof SubmitFeedbackParamsSchema>;
