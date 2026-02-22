# Project 0 Agent Skill

Agent skill and landing page for the [Project 0](https://0.xyz) agent skill.

## Repository Structure

```
p0-agent/
├── SKILL.md       # DeFi agent skill document (P0 credit protocol)
└── site/          # Marketing / landing page (Astro static site)
```

### SKILL.md

A self-contained skill document that teaches AI agents how to interact with the
P0 credit protocol. Covers:

- **Read-only data** -- fetching deposit/borrow rates and pre-computed strategies
  via public HTTP APIs (no SDK or wallet required).
- **On-chain operations** -- depositing, withdrawing, borrowing, repaying, and
  looping via the `@0dotxyz/p0-ts-sdk` TypeScript SDK.
- **Health monitoring** -- checking collateral ratios and liquidation risk.

The skill is designed for agentic coding tools (Claude Code, Cursor, Windsurf,
etc.) and can be installed with:

```bash
npx skills add 0dotxyz/skill
```

### site/

A static landing page built with Astro, React, and Tailwind CSS v4. Dark-themed,
single-page marketing site for the agent skill.

**Tech stack:** Astro 5 | React 19 | Tailwind CSS v4 | TypeScript (strict)

## Getting Started

All commands run from `site/`:

```bash
# Install dependencies
pnpm install

# Development server (localhost:4321)
pnpm dev

# Production build (outputs to site/dist/)
pnpm build

# Preview production build
pnpm preview
```

## License

Proprietary.
