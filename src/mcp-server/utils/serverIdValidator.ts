/**
 * Server ID validation utilities
 */

// Server ID format: sv_[12 hex chars]
const SERVER_ID_REGEX = /^sv_[a-f0-9]{12}$/;

/**
 * Validates if a server ID matches the expected format
 */
export function isValidServerId(serverId: string): boolean {
  return SERVER_ID_REGEX.test(serverId);
}

/**
 * Validates a server ID and throws an error if invalid
 */
export function validateServerIdOrThrow(serverId: string): void {
  if (!isValidServerId(serverId)) {
    throw new Error(
      `Invalid server ID format: ${serverId}. Expected format: sv_[12 hex chars]`,
    );
  }
}

/**
 * Sanitizes a server ID for logging - returns the ID if valid, otherwise returns "invalid_format"
 */
export function sanitizeServerIdForLogging(serverId: string): string {
  return isValidServerId(serverId) ? serverId : "invalid_format";
}
