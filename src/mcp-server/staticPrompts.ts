export const PRE_INITIALIZATION_PROMPTS = {
  tools_initialization_error: `ERROR: Unable to connect to ToolPlex. Please check your API key and network connection. If the problem persists, contact support at support@toolplex.ai for assistance.`,
  enforce_init_toolplex: `ERROR: Attempted to call tool {TOOL_NAME} before calling initalize_toolplex().\nPlease init and retry.`,
  unknown_tool:
    "Unknown tool: {TOOL_NAME}. Use list_toolplex_tools() to see available tools.",
  unexpected_error: "Unexpected error: {ERROR}",
};
