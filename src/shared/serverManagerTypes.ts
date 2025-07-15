import { z } from 'zod';

// --------------------
// initialize
// --------------------
export const InitializeResultSchema = z.object({
  succeeded: z.array(
    z.object({
      server_id: z.string(),
      server_name: z.string(),
      description: z.string(),
    })
  ),
  failures: z.record(
    z.object({
      server_id: z.string(),
      server_name: z.string(),
      error: z.string(),
    })
  ),
});
export type InitializeResult = z.infer<typeof InitializeResultSchema>;

// --------------------
// Install
// --------------------
export const ServerInstallResultSchema = z.object({
  server_id: z.string(),
  server_name: z.string(),
});
export type ServerInstallResult = z.infer<typeof ServerInstallResultSchema>;

// --------------------
// Uninstall
// --------------------
export const ServerUninstallResultSchema = z.object({
  server_id: z.string(),
  server_name: z.string(),
});
export type ServerUninstallResult = z.infer<typeof ServerUninstallResultSchema>;

// --------------------
// list_servers
// --------------------
export const ListServersResultSchema = z.object({
  servers: z.array(
    z.object({
      server_id: z.string(),
      server_name: z.string(),
      description: z.string(),
      tool_count: z.number(),
    })
  ),
});
export type ListServersResult = z.infer<typeof ListServersResultSchema>;

// --------------------
// list_tools
// --------------------
export const ListToolsResultSchema = z.object({
  server_id: z.string(),
  server_name: z.string(),
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      inputSchema: z.any(),
    })
  ),
});
export type ListToolsResult = z.infer<typeof ListToolsResultSchema>;

// --------------------
// list_all_tools
// --------------------
export const ListAllToolsResultSchema = z.object({
  tools: z.record(
    z.array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        inputSchema: z.any(),
      })
    )
  ),
});
export type ListAllToolsResult = z.infer<typeof ListAllToolsResultSchema>;

// --------------------
// call_tool
// --------------------
export const CallToolResultSchema = z.object({
  result: z.any(),
});
export type CallToolResult = z.infer<typeof CallToolResultSchema>;

// --------------------
// cleanup
// --------------------
export const CleanupResultSchema = z.object({});
export type CleanupResult = z.infer<typeof CleanupResultSchema>;
