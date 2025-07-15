import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolplexApiService } from './toolplexApi/service.js';
import { ClientContext } from './clientContext.js';

export class ToolDefinitionsCache {
  private _tools: Tool[] | null = null;
  private _version: string | null = null;

  constructor() {
    this._tools = null;
    this._version = null;
  }

  /**
   * Initialize tools cache by fetching tools from API
   * Handles errors if fetching fails, but does not rethrow.
   */
  public async init(service: ToolplexApiService, _clientContext: ClientContext): Promise<void> {
    try {
      const toolsResponse = await service.getTools();
      this._tools = toolsResponse.tools;
      this._version = toolsResponse._version;
    } catch {
      this._tools = null;
      this._version = null;
    }
  }

  /**
   * Get all cached tool definitions
   */
  public getTools(): Tool[] {
    if (!this._tools) {
      throw new Error('ToolDefinitionsCache not initialized');
    }
    return this._tools;
  }

  /**
   * Get a specific tool by name from the cache
   */
  public getTool(name: string): Tool {
    if (!this._tools) {
      throw new Error('ToolDefinitionsCache not initialized');
    }

    const tool = this._tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found in cache`);
    }

    return tool;
  }

  /**
   * Get the version of the current tools
   */
  public getVersion(): string {
    if (!this._version) {
      throw new Error('ToolDefinitionsCache not initialized');
    }
    return this._version;
  }

  /**
   * Check if the cache is initialized
   */
  public isInitialized(): boolean {
    return this._tools !== null;
  }

  /**
   * Reset the cache
   */
  public reset(): void {
    this._tools = null;
    this._version = null;
  }
}
