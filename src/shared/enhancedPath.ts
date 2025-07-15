import * as path from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { glob } from 'glob';

/**
 * Returns an enhanced PATH string by prepending common binary directories
 * across platforms (Linux, macOS, Windows).
 *
 * Ensures no duplicates and checks for existence.
 */
export function getEnhancedPath(): string {
  const home = homedir();

  const basePaths = (process.env.PATH || '').split(path.delimiter);
  const extraPaths = getDefaultExtraPaths(home);

  const seen = new Set(basePaths);
  const allPaths: string[] = [...basePaths];

  for (const extraPath of extraPaths) {
    if (extraPath.includes('*')) {
      const matches = glob.sync(extraPath);
      for (const match of matches) {
        if (existsSync(match) && !seen.has(match)) {
          seen.add(match);
          allPaths.unshift(match);
        }
      }
    } else {
      if (existsSync(extraPath) && !seen.has(extraPath)) {
        seen.add(extraPath);
        allPaths.unshift(extraPath);
      }
    }
  }

  return allPaths.join(path.delimiter);
}

/**
 * Returns platform-specific extra binary paths.
 */
function getDefaultExtraPaths(home: string): string[] {
  const isWindows = process.platform === 'win32';

  return isWindows
    ? [
        path.join(home, 'AppData/Local/Programs/Python/Python3*/Scripts'),
        path.join(home, 'AppData/Roaming/npm'),
      ]
    : [
        path.join(home, '.local/bin'),
        path.join(home, '.cargo/bin'),
        '/usr/local/bin',
        '/opt/homebrew/bin',
      ];
}
