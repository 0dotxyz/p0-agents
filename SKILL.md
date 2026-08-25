---
name: project0
description: Use for Project 0 (P0), the DeFi prime broker on Solana. Yield discovery, deposits, borrows, repayments, withdrawals, leveraged loops (strategies), and account health, through the hosted MCP server at ai.0.xyz or its REST API. Transactions are returned unsigned; the user's wallet signs.
metadata:
  version: "0.2.0"
---

# Project 0 Skill

Project 0 is a permissionless DeFi prime broker on Solana: one margin account
across P0 native, Kamino, Drift and Jupiter Lend banks. Agents talk to it
through the hosted service at `https://ai.0.xyz`, which has two doors:

- **MCP** at `https://ai.0.xyz/mcp` (preferred when your runtime supports MCP)
- **REST** at `https://ai.0.xyz/v1` (same capabilities as plain HTTP; OpenAPI at
  `https://ai.0.xyz/v1/openapi.json`)

Every state-changing call returns **unsigned** transactions. You sign them with
the user's wallet and send them. The service never holds keys and cannot move
funds. No CLI or SDK is needed.

Docs: `https://docs.0.xyz/guides/mcp-server` (the MCP tools can also search
and read the docs: `p0_search_docs`, `p0_get_doc`).

## Operating model

1. Read with the MCP tools (or `GET /v1/*`) to plan.
2. Present a concrete plan with numbers. Wait for the user's approval before
   any state-changing action.
3. Build the transaction(s) with a builder tool (or `POST /v1/tx/*`).
4. Sign with the user's wallet and submit according to the response's
   `submit` field.
5. Re-read positions and report signatures as `https://solscan.io/tx/<signature>`.

## Connecting

If MCP is available, connect once:

```bash
claude mcp add --transport http project0 https://ai.0.xyz/mcp
```

Other clients: point them at `https://ai.0.xyz/mcp` (stateless Streamable HTTP,
no API key). If MCP is not available, use REST with `curl` or `fetch`.

## Tools (MCP) and routes (REST)

| MCP tool | REST | Purpose |
| --- | --- | --- |
| `p0_get_banks` | `GET /v1/banks` | Banks with rates, sizes, weights, e-mode. Filters: `symbol`, `venue`, `mint` |
| `p0_get_strategies` | `GET /v1/strategies` | Ranked loop / rate-arbitrage strategies |
| `p0_get_wallet` | `GET /v1/wallet/{address}` | Token holdings with USD values |
| `p0_get_positions` | `GET /v1/account/{address}` | Accounts, positions, health, capacity (fresh on-chain compute) |
| `p0_get_health` | `GET /v1/health/{account}` | Light health check |
| `p0_get_activity` | `GET /v1/activity/{authority}` | Recent actions |
| `p0_create_account` | `POST /v1/tx/create-account` | New marginfi account |
| `p0_deposit` / `p0_withdraw` | `POST /v1/tx/deposit` / `withdraw` | Deposit (auto-creates an account for first-timers) / withdraw |
| `p0_borrow` / `p0_repay` | `POST /v1/tx/borrow` / `repay` | Borrow (capped by guardrails) / repay |
| `p0_loop` | `POST /v1/tx/loop` | Open or increase a leveraged position in one flash-loan tx |
| `p0_close_position` | `POST /v1/tx/close-position` | Unwind a position: repay debt with collateral in one flash-loan tx |
| | `POST /v1/tx/simulate` | Re-simulate a bundle and get post-action health |

Amounts everywhere are UI token units (`1.5` = 1.5 tokens). Addresses are
base58. REST bodies use the same field names as the MCP tool inputs.

## Workflow

### 1. Resolve the wallet

Get the wallet address from the user or the environment (`WALLET_ADDRESS`, or
derive it from `WALLET_KEYPAIR`). Never guess an address.

`p0_get_wallet` / `GET /v1/wallet/{address}` returns `tokens[]` with `mint`,
`symbol`, `amount_ui`, `price_usd`, `value_usd`, `is_native_sol`. Match token
`mint` to bank `mint`.

### 2. Read protocol data

- `p0_get_banks`: each bank has `address`, `symbol`, `mint`, `venue`
  (`P0` | `Kamino` | `Drift` | `JupLend`), `price_usd`, `operational_state`,
  `rates.total_deposit_apy_pct`, `rates.total_borrow_apy_pct`,
  `size.available_liquidity_usd`, `size.deposit_capacity_remaining_usd`,
  `size.borrow_capacity_remaining_usd`, `weights.*`.
- `p0_get_strategies`: each strategy has `supply { bank, symbol, mint, venue }`,
  `borrow { bank, symbol, mint, venue }`, `rates.net_apy_base_pct`,
  `rates.net_apy_at_max_leverage_pct`, `max_leverage`,
  `available_strategy_size_usd`, `emode_applied`. Ranked by capacity-adjusted
  score; the list is already flat.
- `p0_get_positions`: `accounts[]` with `address`, `health { status,
  health_factor, free_collateral_usd, ... }`, `net_apy_pct`, `positions[]`
  (`bank`, `symbol`, `venue`, `side` = `lend` | `borrow`, `amount_ui`,
  `amount_usd`, `apy_pct`, `max_withdraw_ui`), `max_borrow`.

### 3. Recommend a plan

- Best deposit: sort banks by `rates.total_deposit_apy_pct` descending among
  mints the wallet holds; check `size.deposit_capacity_remaining_usd`.
- Cheapest stablecoin borrow: `venue === "P0"`, symbol in
  `[USDC, USDT, USDG, USDS, hyUSD]`, sort by `rates.total_borrow_apy_pct`
  ascending, check `size.available_liquidity_usd`.
- Strategy: pick by `rates.net_apy_at_max_leverage_pct` (headline) or
  `rates.net_apy_base_pct` (unlevered spread); size below
  `available_strategy_size_usd`; leverage at or below `max_leverage`.
- Rules: only `P0` banks can be borrowed from. Kamino, Drift and JupLend banks
  are deposit-only. Unsupported tokens must be swapped elsewhere first.

State the plan with specific amounts, banks, rates and the expected health
after the action. Wait for approval.

### 4. Build

Single leg (deposit / borrow / withdraw / repay):

```json
{ "authority": "<wallet>", "bank": "<bank address>", "amount": 100 }
```

Add `"account": "<address>"` when the wallet owns several accounts (the
service returns `ACCOUNT_AMBIGUOUS` with the list otherwise). `withdraw` and
`repay` accept `withdraw_all` / `repay_all` instead of `amount`.

Strategy (leveraged loop):

```json
{
  "authority": "<wallet>",
  "create_new_account": true,
  "deposit_bank": "<strategy.supply.bank>",
  "borrow_bank": "<strategy.borrow.bank>",
  "amount": 0.5,
  "leverage": 2
}
```

`amount` is principal already in the wallet, in deposit-token units.
`create_new_account: true` isolates the position in a fresh account (what the
app does); pass `account` instead to add to an existing one. Unwind with
`p0_close_position` `{ authority, account, deposit_bank, borrow_bank,
repay_all: true }` (or `amount` for a partial repay; max 250,000 USD of debt
per call).

Every builder returns:

```json
{
  "account": "<marginfi account, save it>",
  "transactions": [ { "base64": "<unsigned v0 tx>", "type": "CRANK" }, { "base64": "…", "type": "DEPOSIT" } ],
  "action_tx_index": 1,
  "submit": "sequential",
  "blockhash": { "value": "…", "last_valid_block_height": 0 },
  "simulation": { "success": true, "post_health": { "status": "healthy", "health_factor": 0.61 }, "warnings": [] }
}
```

The transactions were simulated before being returned. Show
`simulation.post_health` and any `warnings` to the user before signing. The
blockhash expires in about a minute; if it does, build again.

### 5. Sign and submit

Sign every transaction with the user's keypair and submit according to `submit`:

- `sequential`: send in array order, waiting for each confirmation.
- `bundle`: sign all with the returned blockhash and submit them together as
  ONE atomic Jito bundle. Never send them one by one.

A landed signature with a non-null `err` is a failed transaction.

Minimal Node recipe (`@solana/web3.js`, `bs58`). Write it to a file and run it;
do not paste keys into chat.

```js
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import bs58 from "bs58";

const rpc = new Connection(process.env.RPC_URL, "confirmed");
const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.WALLET_KEYPAIR, "utf8"))));
const env = JSON.parse(readFileSync(process.argv[2], "utf8")); // the builder response

const txs = env.transactions.map((t) => {
  const tx = VersionedTransaction.deserialize(Buffer.from(t.base64, "base64"));
  tx.sign([wallet]);
  return tx;
});

if (env.submit === "bundle") {
  const res = await fetch("https://mainnet.block-engine.jito.wtf/api/v1/bundles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendBundle", params: [txs.map((tx) => bs58.encode(tx.serialize()))] }),
  });
  console.log("bundle", (await res.json()).result);
} else {
  for (const tx of txs) {
    const sig = await rpc.sendTransaction(tx, { maxRetries: 3 });
    const conf = await rpc.confirmTransaction({ signature: sig, blockhash: env.blockhash.value, lastValidBlockHeight: env.blockhash.last_valid_block_height }, "confirmed");
    if (conf.value.err) throw new Error(`tx ${sig} failed: ${JSON.stringify(conf.value.err)}`);
    console.log("https://solscan.io/tx/" + sig);
  }
}
```

Environment the recipe needs: `RPC_URL` (Solana RPC), `WALLET_KEYPAIR` (path
to the keypair JSON). Ask the user for both if they are not set. Never invent
them, never print the secret key.

### 6. Verify

Re-read `p0_get_positions` for the account and report the new positions,
health status and health factor, plus the Solscan links.

## Safety rules

- Never sign without the user's explicit approval of the exact action.
- Keep at least 0.01 SOL in the wallet for fees (the service enforces this on
  SOL deposits).
- Do not borrow to the limit; leave a buffer. The service caps borrows and
  leverage and returns the cap in the error (`BORROW_LIMIT_EXCEEDED.details.max_borrow`,
  `LEVERAGE_EXCEEDED.details.max_leverage`); retry with a smaller amount.
- If a build fails with `SIMULATION_FAILED`, read `details` and do not blindly
  retry. If a send fails, retry at most once with a fresh build.
- Loops route swaps through Jupiter and Titan with the service's keys. To use
  the user's own keys, send them as HTTP headers `x-jupiter-api-key` /
  `x-titan-api-key` on the MCP connection or REST request. Never put keys in
  tool arguments or chat.

## Errors

Responses are `{ "error": "<what to change>", "code": "<CODE>", "details": {} }`.
The message is prescriptive; follow it.

| Code | What to do |
| --- | --- |
| `ACCOUNT_AMBIGUOUS` | Pass `account` from `details.accounts` |
| `ACCOUNT_NOT_FOUND` | Deposit first (auto-creates) or `p0_create_account` |
| `BANK_NOT_FOUND` | Use a bank `address` from `p0_get_banks`; only `P0` banks are borrowable |
| `BORROW_LIMIT_EXCEEDED` / `LEVERAGE_EXCEEDED` | Retry at or below the cap in `details` |
| `INSUFFICIENT_COLLATERAL` | No such position, or SOL gas reserve; check positions |
| `SWAP_ROUTE_UNAVAILABLE` / `TX_TOO_LARGE` | Reduce the amount or pick a more liquid pair |
| `SIMULATION_FAILED` | The tx would fail on-chain; `details.cause` says why |
| `RATE_LIMITED` | Wait `Retry-After` seconds |

## Health reference

`health.status` is `healthy` | `moderate` | `warning` | `critical`;
`health_factor` is `1 - liabilities_usd_maint / assets_usd_maint` (1 = no debt,
0 = liquidation boundary). Use `free_collateral_usd` for how much more can be
borrowed. Risk engine docs: `https://docs.0.xyz/protocol-overview/risk-engine`.
