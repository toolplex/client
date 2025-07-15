# ToolPlex Client

[![Visit ToolPlex](https://img.shields.io/badge/ToolPlex.ai-%F0%9F%9A%80-blue?style=flat)](https://toolplex.ai)  
[![Discord](https://img.shields.io/badge/Join%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/KpCjj8ay)

This repository contains the official **ToolPlex MCP server** — the npm package that enables AI agents to connect to the ToolPlex platform.

ToolPlex is a curated tool ecosystem built for AI agents. With ToolPlex, your agent can:
- 🔍 Discover 2,000+ high quality, open-source MCP tools
- 🛠️ Install and run tools with your permission
- 📚 Save workflows as reusable playbooks
- 🔁 Learn from success — your agent evolves from collective agent feedback

No complex setup. Just add ToolPlex to your AI client and start automating.

## Features

- **Agent Tool Discovery** — Your agent can search a curated index of MCP servers, filtered by code analysis and popularity signals to find tools that actually work  
- **Smooth Install Experience** — Automatically installs even complex tools, with the agent handling tricky build steps, dependencies, and setup flows behind the scenes  
- **Secure Config Handling** — Injects API keys, secrets, and file paths only when needed — always under your control  
- **Seamless Server Activation** — Install and uninstall MCP servers at any time without restarting your LLM or resetting the session  
- **Workflow Memory** — Successful tasks are saved as playbooks your agent can search, reuse, and adapt later  
- **Quality Signals Built-In** — Agents report tool usage and failure rates to help down-rank unreliable or broken servers automatically  
- **Team-Ready** — Share tools, playbooks, and permission sets across your org for faster onboarding and coordinated automation  
- **Full Agent Control** — Use the ToolPlex dashboard to manage server access, shell permissions, file visibility, feedback settings, and more  
- **Local-First Execution** — By default, ToolPlex installs and runs tools on your machine for full speed, privacy, and control  

## Quick Setup

**Claude Desktop (recommended)**  
1. Sign up for a [ToolPlex AI](https://toolplex.ai) account and create your first API key.
2. Install [Claude Desktop](https://claude.ai/download).
3. Add this to your `claude_desktop_config.json`:

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

Or use any AI chat client that [supports MCP](https://github.com/punkpeye/awesome-mcp-clients).

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

## LLM Compatability
ToolPlex works better with generalist, high-context LLMs that support tool-calling, like:
* `claude-sonnet-3.7`
* `claude-sonnet-4`
* `gpt-4o`
* `gpt-4.1`

Weaker reasoning models like `deepseek-chat` or `claude-haiku-3.5` can be used for simpler tasks (like running playbooks), but easily get confused with freeform ToolPlex usage.
