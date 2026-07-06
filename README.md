# Core Mockup

Live-edit HTML/CSS mockups using an LLM agent. Describe what you want, and the agent iterates on the mockup in real time — reading, searching, editing, and rewriting code on the fly.

## Quick Start

```sh
# Start Postgres
docker compose up -d postgres

# Start the app (backend :3101, frontend :3102)
npm run dev
```

Open **http://localhost:3102**. Say "Hi" to the agent to get started.

## How It Works

A chat panel on the left lets you talk to an LLM agent. The rest of the screen is a live preview of the mockup. The agent can:

| Tool | What it does |
|------|-------------|
| `read_mockup` | Returns the current HTML with line numbers |
| `search_code` | Finds matching lines with surrounding context |
| `edit_mockup` | Replaces lines by number (small, precise changes) |
| `write_mockup` | Replaces the entire HTML (full rewrites) |
| `respond` | Ends the turn with a structured message |

The agent loops freely — it can call tools, reason, and generate text until it calls `respond`. You see everything stream in: text, reasoning, tool calls, and even the code being generated.

## Features

- **Live preview** — generated HTML renders in a sandboxed iframe
- **Streaming** — text, reasoning, and code appear as the LLM generates them
- **Iteration** — small changes via `edit_mockup` by line number, big changes via `write_mockup`
- **Screenshots** — download a PNG of the current mockup (bottom-right button)
- **MCP support** — attach design-system MCP servers (stdio or HTTP/SSE)
- **Multiple LLM providers** — OpenAI, Anthropic, or any OpenAI-compatible endpoint (LiteLLM)
- **Reasoning visibility** — collapsible reasoning blocks, auto-expanded during streaming
- **Panel controls** — settings toggle, hide/show the entire chat panel

## Architecture

```
frontend/     Next.js (pages router), port 3102
backend/      Express server, port 3101
  agent.js    LLM agent loop with tool definitions
  mcp.js      MCP client manager (stdio + SSE)
  db/         Drizzle ORM schema + migrations + Postgres
docker-compose.yml   Postgres 17 on port 5433
```

Settings (LLM provider, API keys, MCP servers, system prompt) are persisted in Postgres via Drizzle.

## Configuration

### LLM Provider

Open the settings panel (gear icon in the chat header) and choose:

- **Mock** — no API key needed, returns a placeholder response
- **OpenAI** — set `OPENAI_API_KEY`, model, optional base URL
- **Anthropic** — set `ANTHROPIC_API_KEY`, model, optional base URL
- **LiteLLM** — set the LiteLLM proxy URL and model

### Environment

Copy `.env.example` to `.env`:

```
PORT=3101
LLM_PROVIDER=mock
DATABASE_URL=postgres://core_mockup:core_mockup_dev@localhost:5433/core_mockup
```

### MCP Servers

In the MCP tab of settings, add servers by name:

- **stdio** — command + args (for local MCP servers)
- **SSE (HTTP)** — URL (for remote HTTP-based MCP servers)

The agent discovers their tools and can call them alongside the built-in tools.

## Stack

- **Frontend**: Next.js 16, React 19, `react-markdown`, `html2canvas`
- **Backend**: Express 5, OpenAI SDK, Anthropic SDK, `@modelcontextprotocol/sdk`
- **Database**: PostgreSQL 17, Drizzle ORM
- **Font**: Inter via Google Fonts
- **Colors**: Material Design brand scheme (`#6c5ce7` primary)
