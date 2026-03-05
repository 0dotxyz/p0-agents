# Project 0 Agent Skill

AI agent skill for the [Project 0](https://www.0.xyz) protocol.

## Repository Structure

```
p0-agents/
├── SKILL.md               # DeFi agent skill document (P0 credit protocol)
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Landing page
│   │   └── api/
│   │       ├── banks/      # Lightweight bank proxy
│   │       └── strategies/ # Strategy proxy
│   ├── components/         # React components (Header, Hero, Features, etc.)
│   └── styles/globals.css  # Tailwind v4 theme + custom styles
└── public/                 # Static assets (fonts, images, lottie)
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

### API Endpoints

| Endpoint              | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `GET /api/banks`      | Proxies upstream bank data, strips to 9 fields, pre-computes `deposit_apy` |
| `GET /api/strategies` | Returns pre-computed rate-arb and loop strategies                          |

Both endpoints are cached (2 min) and rate-limited via Vercel Firewall.

## Getting Started

```bash
pnpm install        # Install dependencies
pnpm dev            # Development server (localhost:3000)
pnpm build          # Production build
pnpm start          # Serve production build
```

**Tech stack:** Next.js 15 | React 19 | Tailwind CSS v4 | TypeScript (strict)

## License

Proprietary.
