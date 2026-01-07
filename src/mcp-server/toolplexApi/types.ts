export interface InitRequest {
  llm_context: LlmContext;
}

export interface ClientPermissions {
  use_desktop_commander: boolean;
  enable_read_only_mode: boolean;
  allowed_mcp_servers?: string[];
  custom_prompt?: string;
}

/**
 * Automation context for HITL (Human-in-the-Loop) support.
 * Passed when clientMode is 'automation' to enable tool approval and notifications.
 */
export interface AutomationContext {
  automationId: string;
  runId: string;
  /** Tools that require user approval before execution (format: "server_id.tool_name") */
  toolsRequiringApproval: string[];
  /** Email address for notifications */
  notificationEmail?: string;
  /** Hours before HITL decisions expire (default 24) */
  expirationHours: number;
  /** Notification instructions from automation config */
  notifyInstructions?: string;
}

export interface ClientFlags {
  desktop_commander_server_id: string;
  blocked_mcp_servers: string[];
}

export interface InitResponse {
  session_id: string;
  playbooks: {
    playbooks: Array<{
      id: string;
      description: string;
      times_used: number;
      days_since_last_used: number | null;
    }>;
  };
  is_org_user: boolean;
  prompts: Record<string, string>;
  permissions: ClientPermissions;
  announcement?: string;
  flags: ClientFlags;
}

export type SecurityFlag = string;

export type RiskLevel = string;

export interface CustomSecurityFlag {
  custom_flag: string;
}

export interface SecurityAssessment {
  security_flags: Array<SecurityFlag | CustomSecurityFlag>;
  risk_assessment: RiskLevel;
  context_note?: string;
}

export interface LlmContext {
  model_family: string;
  model_name: string;
  model_version: string;
  chat_client?: string;
}

export interface CreatePlaybookRequest {
  playbook_name: string;
  description: string;
  actions: Array<{ do: string; call?: string }>;
  llm_context: LlmContext;
  domain?: string;
  keywords?: string[];
  requirements?: string[];
  privacy?: "public" | "private" | "organization";
  source_playbook_id?: string;
  fork_reason?: string;
}

export interface CreatePlaybookResponse {
  id: string;
  success: boolean;
}

export interface LogPlaybookUsageRequest {
  playbook_id: string;
  success: boolean;
  llm_context: LlmContext;
  error_message?: string;
}

export interface LogPlaybookUsageResponse {
  success: boolean;
}

export interface SubmitFeedbackRequest {
  target_type: "server" | "playbook";
  target_id: string;
  vote: "up" | "down";
  message?: string;
  llm_context: LlmContext;
  machine_context: {
    os: string;
    arch: string;
    memory_gb: number;
    cpu_cores: string;
  };
  security_assessment?: SecurityAssessment;
}

export interface SubmitFeedbackResponse {
  id: string;
  success: boolean;
}

export interface FeedbackSummaryResponse {
  servers: Array<{
    server_id: string;
    upvotes: number;
    downvotes: number;
    feedback_ids: string[];
  }>;
  playbooks: Array<{
    playbook_id: string;
    upvotes: number;
    downvotes: number;
  }>;
}

export interface LogTelemetryRequest {
  client_version: string;
  event_type: string;
  session_id?: string;
  agent_id?: string;
  agent_type?: "user" | "system" | "external";
  success?: boolean;
  pii_sanitized_error_message?: string;
  log_context?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  latency_ms: number;
  llm_context: {
    model: string;
    provider: string;
  };
}

export interface LogTelemetryBatchResponse {
  success: boolean;
}

export interface SearchResponse {
  // Unified format (v0.1.16+)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entities?: any[];
  // Legacy format (< v0.1.16)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mcp_servers?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playbooks?: any[];
}
