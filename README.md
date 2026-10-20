# Project 0 Agent Skill

An [Agent Skill](https://agentskills.io) that teaches AI coding agents (Claude Code, Cursor, Codex, OpenCode, …) how to use Project 0 on Solana: find yield, deposit, borrow, run leveraged strategies, and manage account health.

It works through the hosted service at [ai.0.xyz](https://ai.0.xyz): MCP at `https://ai.0.xyz/mcp` or REST at `https://ai.0.xyz/v1`. Transactions come back unsigned; the user's wallet signs.

Install:

```bash
npx skills add 0dotxyz/p0-agents
```

Or connect the MCP server directly:

```bash
claude mcp add --transport http project0 https://ai.0.xyz/mcp
```

Docs: https://docs.0.xyz/guides/mcp-server · https://docs.0.xyz/guides/agent-skill
