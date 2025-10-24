import { getEnhancedPath } from "../../shared/enhancedPath.js";
import which from "which";
import Registry from "../registry.js";
import * as fs from "fs";

const INSTALL_HINTS: Record<string, string> = {
  uvx: "Install uvx: https://docs.astral.sh/uv/getting-started/installation/",
  uv: "Install uv: https://docs.astral.sh/uv/getting-started/installation/",
  python:
    "Install Python: https://www.python.org/downloads/. Or check if you have `python3` installed.",
  python3:
    "Install Python: https://www.python.org/downloads/. Or check if you have `python` installed.",
  node: "Install Node.js: https://nodejs.org/en/download/",
  npx: "Install npx (comes with Node.js): https://nodejs.org/en/download/",
  git: "Install Git: https://git-scm.com/downloads",
};

// Commands that should use bundled dependencies (required)
const BUNDLED_DEPENDENCY_COMMANDS = [
  "node",
  "python",
  "python3",
  "git",
  "npx",
  "uvx",
];

export class RuntimeCheck {
  /**
   * Resolve a dependency path with priority order:
   * 1. Bundled dependencies (if provided by host application like ToolPlex Desktop)
   * 2. System PATH (fallback for standalone @client usage)
   * 3. Error if neither available
   *
   * This allows ToolPlex Desktop to provide reliable bundled dependencies while
   * still supporting standalone users who have system dependencies installed.
   *
   * @param commandName - The command to resolve
   * @returns The full path to the command executable
   * @throws Error if the command is not available in bundled deps or system PATH
   */
  static resolveDependency(commandName: string): string {
    // Check if this is a known bundled dependency type
    const isBundledDep = BUNDLED_DEPENDENCY_COMMANDS.includes(commandName);

    if (isBundledDep) {
      // Priority 1: Try bundled dependency first (preferred for ToolPlex Desktop)
      const bundledPath = Registry.getBundledDependencyPath(
        commandName as "node" | "python" | "git" | "uvx" | "npx",
      );

      if (bundledPath && fs.existsSync(bundledPath)) {
        return bundledPath;
      }

      // Handle python3 -> python mapping for bundled deps
      if (commandName === "python3") {
        const pythonPath = Registry.getBundledDependencyPath("python");
        if (pythonPath && fs.existsSync(pythonPath)) {
          return pythonPath;
        }
      }

      // Priority 2: Fall back to system PATH (for standalone @client usage)
      const enhancedPath = getEnhancedPath();
      const resolved = which.sync(commandName, {
        path: enhancedPath,
        nothrow: true,
      });

      if (resolved) {
        return resolved;
      }

      // Priority 3: Neither bundled nor system available - error
      const hint = INSTALL_HINTS[commandName];
      throw new Error(
        `Missing required command: '${commandName}'.\n` +
          `This command is not available in bundled dependencies or system PATH.\n` +
          (hint ? `👉 ${hint}` : ""),
      );
    }

    // For non-bundled dependencies, only check system PATH
    const enhancedPath = getEnhancedPath();
    const resolved = which.sync(commandName, {
      path: enhancedPath,
      nothrow: true,
    });

    if (!resolved) {
      const hint = INSTALL_HINTS[commandName];
      if (hint) {
        throw new Error(
          `Missing required command: '${commandName}'.\n👉 ${hint}`,
        );
      }
      throw new Error(
        `Command '${commandName}' not found in enhanced PATH. Please install it manually or check your config.`,
      );
    }

    return resolved;
  }

  /**
   * Validate that a command is available (either bundled or in system PATH).
   * Throws an error if the command is not found.
   */
  static validateCommandOrThrow(rawCommand: string): void {
    const command = this.extractCommandName(rawCommand);
    this.resolveDependency(command);
  }

  static extractCommandName(command: string): string {
    const trimmed = command.trim();

    // For absolute paths (starting with / or drive letter like C:\),
    // the entire path is the command - don't split on spaces
    // This handles paths like "/Users/name/Library/Application Support/tool"
    if (trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed)) {
      return trimmed;
    }

    // For relative commands (like "npx", "node --version"),
    // split on whitespace to extract just the command name
    return trimmed.split(/\s+/)[0];
  }
}
