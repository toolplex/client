import fetch, { Response as FetchResponse } from "node-fetch";
import { FileLogger } from "../../shared/fileLogger.js";
import {
  CreatePlaybookRequest,
  CreatePlaybookResponse,
  LogPlaybookUsageRequest,
  LogPlaybookUsageResponse,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
  SecurityAssessment,
  FeedbackSummaryResponse,
  LogTelemetryRequest,
  LogTelemetryBatchResponse,
  InitRequest,
  InitResponse,
  SearchResponse,
} from "./types.js";
import os from "os";
import { ClientContext } from "../clientContext.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { PlaybookAction } from "../../shared/mcpServerTypes.js";

const logger = FileLogger;

export class ToolplexApiService {
  private readonly baseUrl: string;
  private readonly clientContext: ClientContext;
  private readonly machineContext: {
    os: string;
    arch: string;
    memory_gb: number;
    cpu_cores: string;
  };

  constructor(clientContext: ClientContext) {
    if (!clientContext.apiKey) {
      throw new Error("API key not set in client context");
    }
    if (!clientContext.clientVersion) {
      throw new Error("Client version not set in client context");
    }

    this.clientContext = clientContext;
    this.baseUrl = this.getBaseUrl(clientContext.dev);

    this.machineContext = {
      os: `${os.platform()} ${os.release()}`,
      arch: os.arch(),
      memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
      cpu_cores: os.cpus().length.toString(),
    };
  }

  private getBaseUrl(dev: boolean): string {
    return dev ? "http://localhost:8080" : "https://api.toolplex.ai";
  }

  private async handleFetchResponse<T>(response: FetchResponse): Promise<T> {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    return response.json() as Promise<T>;
  }

  private getBaseHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": this.clientContext.apiKey,
      "x-client-mode": this.clientContext.clientMode,
      "x-client-name": this.clientContext.clientName,
      "x-client-version": this.clientContext.clientVersion,
      "x-client-platform": os.platform(),
      "x-client-arch": os.arch(),
    };
  }

  private getHeadersWithSession(): Record<string, string> {
    return {
      ...this.getBaseHeaders(),
      "x-session-id": this.clientContext.sessionId,
    };
  }

  public async init(): Promise<InitResponse> {
    try {
      const initRequest: InitRequest = {
        llm_context: this.clientContext.llmContext,
      };

      const response = await fetch(`${this.baseUrl}/init`, {
        method: "POST",
        headers: this.getBaseHeaders(),
        body: JSON.stringify(initRequest),
      });

      return this.handleFetchResponse<InitResponse>(response);
    } catch (err) {
      await logger.error(`Error initializing session: ${err}`);
      throw err;
    }
  }

  public async getTools() {
    try {
      const response = await fetch(`${this.baseUrl}/tools`, {
        method: "POST",
        headers: this.getBaseHeaders(),
        body: JSON.stringify({}),
      });

      return this.handleFetchResponse<{ _version: string; tools: Tool[] }>(
        response,
      );
    } catch (err) {
      await logger.error(`Error fetching tool definitions: ${err}`);
      throw err;
    }
  }

  public async logTelemetryEvents(
    events: Array<{
      eventType: LogTelemetryRequest["event_type"];
      data: Partial<Omit<LogTelemetryRequest, "event_type">>;
    }>,
  ): Promise<LogTelemetryBatchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/telemetry/log/batch`, {
        method: "POST",
        headers: this.getHeadersWithSession(),
        body: JSON.stringify(
          events.map((event) => ({
            event_type: event.eventType,
            ...event.data,
          })),
        ),
      });

      return this.handleFetchResponse<LogTelemetryBatchResponse>(response);
    } catch (err) {
      await logger.error(`Error batch logging telemetry events: ${err}`);
      return { success: false };
    }
  }

  public async lookupEntity(
    entityType: "server" | "playbook" | "feedback",
    entityId: string,
    includeReadme?: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/lookup-entity`, {
        method: "POST",
        headers: this.getHeadersWithSession(),
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          include_readme: includeReadme,
        }),
      });

      return this.handleFetchResponse<unknown>(response);
    } catch (err) {
      await logger.error(`Error looking up entity: ${err}`);
      throw err;
    }
  }

  public async search(
    query: string,
    expandedKeywords: string[] = [],
    filter = "all",
    size = 10,
    scope = "all",
  ): Promise<SearchResponse> {
    const requestBody = {
      query,
      expanded_keywords: expandedKeywords,
      filter,
      size,
      scope,
    };

    await logger.debug(`Searching API at ${this.baseUrl} with query: ${query}`);

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: this.getHeadersWithSession(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return (await response.json()) as SearchResponse;
    } catch (err) {
      await logger.error(`Error during search request: ${err}`);
      throw err;
    }
  }

  public async createPlaybook(
    playbook_name: string,
    description: string,
    actions: Array<PlaybookAction>,
    domain?: string,
    keywords?: string[],
    requirements?: string[],
    privacy?: "public" | "private" | "organization",
    sourcePlaybookId?: string,
    forkReason?: string,
  ): Promise<CreatePlaybookResponse> {
    const requestBody: CreatePlaybookRequest = {
      playbook_name,
      description,
      actions,
      llm_context: this.clientContext.llmContext,
      domain,
      keywords,
      requirements,
      privacy,
      source_playbook_id: sourcePlaybookId,
      fork_reason: forkReason,
    };

    try {
      const response = await fetch(`${this.baseUrl}/playbooks/create`, {
        method: "POST",
        headers: this.getHeadersWithSession(),
        body: JSON.stringify(requestBody),
      });

      return this.handleFetchResponse<CreatePlaybookResponse>(response);
    } catch (err) {
      await logger.error(`Error creating playbook: ${err}`);
      throw err;
    }
  }

  public async logPlaybookUsage(
    playbookId: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<LogPlaybookUsageResponse> {
    const requestBody: LogPlaybookUsageRequest = {
      playbook_id: playbookId,
      success,
      llm_context: this.clientContext.llmContext,
      error_message: errorMessage,
    };

    try {
      const response = await fetch(`${this.baseUrl}/playbooks/log-usage`, {
        method: "POST",
        headers: this.getHeadersWithSession(),
        body: JSON.stringify(requestBody),
      });

      return this.handleFetchResponse<LogPlaybookUsageResponse>(response);
    } catch (err) {
      await logger.error(`Error logging playbook usage: ${err}`);
      throw err;
    }
  }

  public async submitFeedback(
    targetType: "server" | "playbook",
    targetId: string,
    vote: "up" | "down",
    message?: string,
    securityAssessment?: SecurityAssessment,
  ): Promise<SubmitFeedbackResponse> {
    const requestBody: SubmitFeedbackRequest = {
      target_type: targetType,
      target_id: targetId,
      vote,
      message,
      llm_context: this.clientContext.llmContext,
      machine_context: this.machineContext,
      security_assessment: securityAssessment,
    };

    try {
      const response = await fetch(`${this.baseUrl}/feedback/submit`, {
        method: "POST",
        headers: this.getHeadersWithSession(),
        body: JSON.stringify(requestBody),
      });

      return this.handleFetchResponse<SubmitFeedbackResponse>(response);
    } catch (err) {
      await logger.error(`Error submitting feedback: ${err}`);
      throw err;
    }
  }

  public async getFeedbackSummary(): Promise<FeedbackSummaryResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/feedback/summarize`, {
        method: "GET",
        headers: this.getHeadersWithSession(),
      });

      return this.handleFetchResponse<FeedbackSummaryResponse>(response);
    } catch (err) {
      await logger.error(`Error getting feedback summary: ${err}`);
      throw err;
    }
  }
}
