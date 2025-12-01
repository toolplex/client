# ToolPlex Client

[![npm version](https://img.shields.io/npm/v/@toolplex/client)](https://www.npmjs.com/package/@toolplex/client)
[![npm downloads](https://img.shields.io/npm/dw/@toolplex/client)](https://www.npmjs.com/package/@toolplex/client)
[![Visit ToolPlex](https://img.shields.io/badge/ToolPlex.ai-%F0%9F%9A%80-blue?style=flat)](https://toolplex.ai)
[![Discord](https://img.shields.io/badge/Join%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/KpCjj8ay)

This repository contains the official **ToolPlex MCP server** — the npm package that powers agent interaction with the ToolPlex network. It's the core of [ToolPlex Desktop](https://toolplex.ai) and works with any MCP-compatible client.

ToolPlex is a curated tool ecosystem built for AI agents. With ToolPlex, your agent can:
- Discover 4,000+ high quality, open-source MCP tools (and growing)
- Automatically install and debug complex MCP servers — including fetching READMEs and resolving dependencies
- Call any tool across any installed MCP server without loading every schema into context
- Create and run playbooks (multi-step AI workflows) just by chatting
- Learn from collective agent feedback to improve over time

No complex setup. Just add ToolPlex to your AI client and start automating.

## Features

- **Agent Tool Discovery** — Your agent can search a curated index of MCP servers, filtered by code analysis and popularity signals to find tools that actually work  
- **Smooth Install Experience** — Automatically installs even complex tools, with the agent handling tricky build steps, dependencies, and setup flows behind the scenes  
- **Seamless Server Activation** — Install and uninstall MCP servers at any time without restarting your LLM or resetting the session  
- **Workflow Memory** — Successful tasks are saved as playbooks your agent can search, reuse, and adapt later  
- **Quality Signals Built-In** — Agents report tool usage and failure rates to help down-rank unreliable or broken servers automatically  
- **Full Agent Control** — Use the ToolPlex dashboard to manage server access, shell permissions, file visibility, feedback settings, and more  
- **Local-First Execution** — By default, ToolPlex installs and runs tools on your machine for full speed, privacy, and control  

## Quick Setup

**ToolPlex Desktop (recommended)**

Download [ToolPlex Desktop](https://toolplex.ai) — a native app with the ToolPlex client built-in. No configuration needed.

**Claude Desktop or other MCP clients**

1. Sign up for a [ToolPlex AI](https://toolplex.ai) account and create your first API key.
2. Add this to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "toolplex-mcp": {
      "command": "npx",
      "args": ["@toolplex/client"],
      "env": {
        "TOOLPLEX_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

Works with any AI client that [supports MCP](https://github.com/punkpeye/awesome-mcp-clients).

ToolPlex works best as the **only server** in your MCP config, since it handles discovery, installation, and management of all other MCP servers on your behalf.

If you *must* include ToolPlex alongside other servers, be sure to **mention `toolplex` by name** when you want to use it. This helps your agent avoid ambiguity when multiple servers are present.

## ToolPlex Usage Guide

ToolPlex API users aren't humans — they're AI agents.

**You talk to your agent.** Your agent talks to ToolPlex. This allows agents to handle the full lifecycle of tool usage — from discovery and installation to configuration, execution, and playbook use — all without human micromanagement.

Ask your AI to activate ToolPlex:
```
> init toolplex
> start toolplex
> open toolplex
```

After initializing ToolPlex, just talk to your agent naturally:

### Discover Available Tools
```
> what tools are currently installed?
> show me what ToolPlex servers I can use
```

### Run Installed Tools
```
> merge these PDFs using the File Merger tool
> fetch the latest bitcoin price from Yahoo Finance
> find some tools to generate my weekly dinner menu
> extract tables from this Excel file using the Excel MCP
> query our BigQuery sales data for Q2 totals
```

### Install New Tools (via search)
```
> find a tool that can automate browser tests
> is there a server that can visualize data with charts?
> search for a tool that can read and organize research PDFs
```

### Manage Tools
```
> install the google news server
> uninstall the ffmpeg server
> reinstall the Playwright automation server
```

### Use Playbooks
```
> run my weekly KPI dashboard playbook
> save this as a playbook
```

## LLM Compatibility
ToolPlex works best with high-context LLMs that support tool-calling:
* Claude Sonnet 4.5, Opus 4.5, Haiku 4.5
* GPT-5, GPT-5 Mini
* Gemini 2.5 Pro, Gemini 3 Pro
* Kimi K2, Kimi K2 Thinking
* Grok 4

Lighter models like DeepSeek V3 or Qwen3 can handle simpler tasks (like running playbooks), but may struggle with complex freeform ToolPlex usage.
