import { getEnhancedPath } from '../../shared/enhancedPath.js';
import which from 'which';

const INSTALL_HINTS: Record<string, string> = {
  uvx: 'Install uvx: https://docs.astral.sh/uv/getting-started/installation/',
  uv: 'Install uv: https://docs.astral.sh/uv/getting-started/installation/',
  python:
    'Install Python: https://www.python.org/downloads/. Or check if you have `python3` installed.',
  python3:
    'Install Python: https://www.python.org/downloads/. Or check if you have `python` installed.',
  node: 'Install Node.js: https://nodejs.org/en/download/',
  npx: 'Install npx (comes with Node.js): https://nodejs.org/en/download/',
};

export class RuntimeCheck {
  static validateCommandOrThrow(rawCommand: string): void {
    const command = this.extractCommandName(rawCommand);

    const enhancedPath = getEnhancedPath();

    const resolved = which.sync(command, {
      path: enhancedPath,
      nothrow: true,
    });

    if (!resolved) {
      const hint = INSTALL_HINTS[command];
      if (hint) {
        throw new Error(`Missing required command: '${command}'.\n👉 ${hint}`);
      }
      throw new Error(
        `Command '${command}' not found in enhanced PATH. Please install it manually or check your config.`
      );
    }
  }

  static extractCommandName(command: string): string {
    return command.trim().split(/\s+/)[0];
  }
}
