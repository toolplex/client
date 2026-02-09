export class PromptsCache {
  private _prompts: Record<string, string> | null = null;
  private _version: string | null = null;

  constructor() {
    this._prompts = null;
    this._version = null;
  }

  /**
   * Initialize prompts cache with prompts from init response
   */
  public init(prompts: Record<string, string>): void {
    // Allow re-init.
    this._prompts = prompts;
    this._version = prompts._version;
  }

  /**
   * Get a specific prompt by key from the cache
   */
  public getPrompt(key: string): string {
    if (!this._prompts) {
      throw new Error("PromptsCache not initialized");
    }

    const prompt = this._prompts[key];
    if (prompt === undefined) {
      throw new Error(`Prompt "${key}" not found in cache`);
    }

    return prompt;
  }

  /**
   * Get the version of the current prompts
   */
  public getVersion(): string {
    if (!this._version) {
      throw new Error("PromptsCache not initialized");
    }
    return this._version;
  }

  /**
   * Check if the cache is initialized
   */
  public isInitialized(): boolean {
    return this._prompts !== null;
  }

  /**
   * Reset the cache
   */
  public reset(): void {
    this._prompts = null;
    this._version = null;
  }
}
