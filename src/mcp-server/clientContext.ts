import { LLMContext } from "../shared/mcpServerTypes.js";
import { ClientPermissions, ClientFlags } from "./toolplexApi/types.js";

/**
 * Maintains client context for the ToolPlex server
 */
export class ClientContext {
  private _sessionId: string | null = null;
  private _dev: boolean | null = null;
  private _apiKey: string | null = null;
  private _clientMode: "standard" | "restricted" | null = null;
  private _llmContext: LLMContext | null = null;
  private _clientVersion: string | null = null;
  private _permissions: ClientPermissions | null = null;
  private _flags: ClientFlags | null = null;
  private _isOrgUser: boolean | null = null;
  private _clientName: string | null = null;
  private _userId: string | null = null; // For system keys to specify user context

  public get sessionId(): string {
    if (!this._sessionId) {
      throw new Error("Session ID not set - ToolPlex not initialized");
    }
    return this._sessionId;
  }

  public set sessionId(id: string) {
    this._sessionId = id;
  }

  public get dev(): boolean {
    if (this._dev === null) {
      throw new Error("Dev mode not set - ToolPlex not initialized");
    }
    return this._dev;
  }

  public set dev(isDev: boolean) {
    this._dev = isDev;
  }

  public get apiKey(): string {
    if (!this._apiKey) {
      throw new Error("API key not set - ToolPlex not initialized");
    }
    return this._apiKey;
  }

  public set apiKey(key: string) {
    this._apiKey = key;
  }

  public get clientMode(): "standard" | "restricted" {
    if (!this._clientMode) {
      throw new Error("Client mode not set - ToolPlex not initialized");
    }
    return this._clientMode;
  }

  public set clientMode(mode: "standard" | "restricted") {
    this._clientMode = mode;
  }

  public get clientName(): string {
    if (!this._clientName) {
      throw new Error("Client name not set - ToolPlex not initialized");
    }
    return this._clientName;
  }

  public set clientName(name: string) {
    this._clientName = name;
  }

  public get llmContext(): LLMContext {
    if (!this._llmContext) {
      throw new Error("LLM context not set - ToolPlex not initialized");
    }
    return this._llmContext;
  }

  public set llmContext(context: LLMContext) {
    this._llmContext = context;
  }

  public get clientVersion(): string {
    if (!this._clientVersion) {
      throw new Error("Client version not set - ToolPlex not initialized");
    }
    return this._clientVersion;
  }

  public set clientVersion(version: string) {
    this._clientVersion = version;
  }

  public get permissions(): ClientPermissions {
    if (!this._permissions) {
      throw new Error("Permissions not set - ToolPlex not initialized");
    }
    return this._permissions;
  }

  public set permissions(perms: ClientPermissions) {
    this._permissions = perms;
  }

  public get flags(): ClientFlags {
    if (!this._flags) {
      throw new Error("Consts not set - ToolPlex not initialized");
    }
    return this._flags;
  }

  public set flags(consts: ClientFlags) {
    this._flags = consts;
  }

  public get isOrgUser(): boolean {
    if (this._isOrgUser === null) {
      throw new Error(
        "Organization user status not set - ToolPlex not initialized",
      );
    }
    return this._isOrgUser;
  }

  public set isOrgUser(isOrgUser: boolean) {
    this._isOrgUser = isOrgUser;
  }

  /**
   * Optional user ID for system API keys to specify user context.
   * Used for per-user telemetry tracking in cloud sessions.
   * Returns null if not set (which is fine for regular client usage).
   */
  public get userId(): string | null {
    return this._userId;
  }

  public set userId(id: string | null) {
    this._userId = id;
  }

  public isInitialized(): boolean {
    return !!(
      this._sessionId &&
      this._apiKey &&
      this._clientMode &&
      this._llmContext &&
      this._clientVersion &&
      this._permissions &&
      this._flags &&
      this._isOrgUser !== null &&
      this._clientName
    );
  }
}
