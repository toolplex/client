import { Tool } from '@modelcontextprotocol/sdk/types.js';
import Registry from './registry.js';

export function createToolDefinitions(): Tool[] {
  const toolDefinitionsCache = Registry.getToolDefinitionsCache();
  if (!toolDefinitionsCache.isInitialized()) {
    return [
      {
        name: 'initialize_toolplex',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
    ];
  }
  return toolDefinitionsCache.getTools();
}
