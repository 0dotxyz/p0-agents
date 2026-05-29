---
name: project0
description: Use for Project 0 (P0) defi native prime broker protocol on Solana, including yield discovery, deposits, borrows, repayments, withdrawals, and account health checks.
metadata:
  version: "0.1.0"
---

# Project 0 Skill

Project 0 is a permissionless DeFi prime broker on Solana. It exposes unified
margin accounts across P0 native, Kamino, and Drift venues.

This skill has two jobs:

1. Teach the agent to use the `ai.0.xyz` APIs for read-only discovery,
   market data, strategy inspection, and wallet matching.
2. Teach the agent to use `mfi` for installation, profile configuration,
   account selection, and protocol execution.

Operating model:

- `ai.0.xyz` APIs for discovery, pricing, strategy data, and wallet matching
- `mfi` for installation, configuration, and all protocol interactions

Do not use the TypeScript SDK for normal execution.

References:

- `mfi` README: `https://github.com/0dotxyz/marginfi-v2/tree/main/clients/rust/marginfi-cli`
- `mfi` Installation Guide: `https://github.com/0dotxyz/marginfi-v2/tree/main/clients/rust/marginfi-cli#install`
- Risk Engine: `https://docs.0.xyz/protocol-overview/risk-engine`
- Managing Your Account: `https://docs.0.xyz/guides/managing-your-account`
- use built-in help as the source of truth: `mfi -h`, `mfi <command> -h`,
  `mfi <command> <subcommand> -h`

## Workflow

When a user asks to earn yield, deposit, borrow, repay, withdraw, monitor
health, or run a strategy on P0, follow this sequence.

### 1. Resolve wallet and balances

For read-only planning, resolve the wallet address from the active CLI context or
user-provided context. If you cannot determine the wallet address safely, ask the
user.

Fetch holdings from:

- `GET https://ai.0.xyz/api/wallet/{address}`

Match each token's `address` field to bank `mint` values.

### 2. Fetch protocol data

Fetch:

- `GET https://ai.0.xyz/api/banks`
- `GET https://ai.0.xyz/api/strategies`

### 3. Recommend a plan before executing

Use the APIs to build the plan.

- For best deposit opportunities, sort banks by `deposit_apy` descending.
- For cheapest stablecoin borrows, filter to `venue === "P0"` and symbols in
  `[USDC, USDT, USDG, USDS, HYUSD]`, then sort by `borrow_apy` ascending.
- For wallet matching, match wallet token `address` to bank `mint`.
- For strategies, use `supplyBank` as the deposit bank and `borrowBank` as the
  borrow bank.
- Read strategy groups directly. The API is not a flat ranked list anymore.

Rules:

- Kamino, Drift, and JupLend banks are deposit-only.
- Borrowing is only available from banks where `venue === "P0"`.
- If the wallet holds unsupported tokens, say they must swap separately into a
  supported token before using this skill for protocol interaction.
- If multiple supported tokens are held, consider multiple deposits, not just one.

Always present a concrete plan with specific numbers before any state-changing
action.

### 4. Install and verify `mfi`

Before any state-changing action, verify:

- `mfi` is installed and available on `PATH`
- the active `mfi` profile is the intended profile
- the profile has the intended RPC URL and wallet/keypair
- the correct marginfi account is selected, or can be selected

If `mfi` is not on `PATH`, prefer installing a published release binary yourself
with the platform-specific `curl` download flow from the marginfi CLI README:
`https://github.com/0dotxyz/marginfi-v2/tree/main/clients/rust/marginfi-cli#install`.
Use a user-local install path when possible, verify with `mfi --version` or
`mfi -h`, then continue. Only ask the user if installation needs approval,
fails, or they prefer managing it themselves.

Do not default to `gh release download`. Prefer the README's direct `curl`
install flow because it does not require GitHub auth and is the intended
end-user install path.

Use the README install section to determine the latest published version, then
use the matching release-binary `curl` command for the current platform. Do not
hardcode an old version if the README shows a newer one.

Release install pattern:

```bash
MFI_VERSION=<latest-published-version>
```

Linux x86_64:

```bash
curl --proto '=https' --tlsv1.2 -sSfL -o mfi.tar.gz https://github.com/0dotxyz/marginfi-v2/releases/download/mfi-v${MFI_VERSION}/mfi-${MFI_VERSION}-x86_64-unknown-linux-gnu.tar.gz
tar -xzf mfi.tar.gz
mkdir -p ~/.local/bin
mv ./mfi ~/.local/bin/
~/.local/bin/mfi --version
```

macOS Apple Silicon:

```bash
curl --proto '=https' --tlsv1.2 -sSfL -o mfi.tar.gz https://github.com/0dotxyz/marginfi-v2/releases/download/mfi-v${MFI_VERSION}/mfi-${MFI_VERSION}-aarch64-apple-darwin.tar.gz
tar -xzf mfi.tar.gz
xattr -c ./mfi
mkdir -p ~/.local/bin
mv ./mfi ~/.local/bin/
~/.local/bin/mfi --version
```

macOS Intel:

```bash
curl --proto '=https' --tlsv1.2 -sSfL -o mfi.tar.gz https://github.com/0dotxyz/marginfi-v2/releases/download/mfi-v${MFI_VERSION}/mfi-${MFI_VERSION}-x86_64-apple-darwin.tar.gz
tar -xzf mfi.tar.gz
xattr -c ./mfi
mkdir -p ~/.local/bin
mv ./mfi ~/.local/bin/
~/.local/bin/mfi --version
```

On Windows, follow the PowerShell release install in the `mfi` README.

Install hierarchy:

1. Use `mfi` from `PATH` if already installed.
2. Otherwise install the published release binary for the current platform with
   the README's `curl` command.
3. Only fall back to a local source build if release install is unavailable or
   the user explicitly wants that.

Unix install pattern:

```bash
mkdir -p ~/.local/bin
mv ./mfi ~/.local/bin/
```

Make sure `~/.local/bin` is on `PATH`.

Fallback source build:

- ask for the local `marginfi-v2` repo path only if needed
- build with `cargo build -p marginfi-v2-cli`
- use the built binary from that checkout, for example `<repo>/target/debug/mfi`

Use:

```bash
mfi -h
mfi profile -h
mfi account -h
mfi bank -h
mfi profile show
mfi account list
```

Account rules:

- If no account exists, create one.
- If one account exists, use it.
- If multiple accounts exist, inspect them and ask the user which one to use if
  the right account is not obvious.
- Once chosen, set it explicitly with `mfi account use <ACCOUNT_PUBKEY>` before
  multi-step workflows.

### 5. Create or confirm the active profile

The agent should treat the active `mfi` profile as the execution context.

Inspect first:

```bash
mfi profile show
mfi profile list
```

If no suitable profile exists, create one:

```bash
mfi profile create --name mainnet --cluster mainnet --keypair-path <KEYPAIR_PATH> --rpc-url <RPC_URL>
mfi profile set mainnet
```

To create the profile, the agent needs these real values:

- `--rpc-url`: ask the user for their Solana RPC URL if it is not already in an
  existing profile
- `--keypair-path`: ask the user for the local path to their Solana keypair file
  if it is not already in an existing profile
- `--name`: use `mainnet` by default unless the user prefers another name

Do not invent RPC URLs or keypair paths.

### 6. Execute

Execute only after the user approves the plan.

- Execute protocol actions with `mfi`
- After mutation, inspect the resulting account state
- Report signatures with Solscan links: `https://solscan.io/tx/<signature>`

---

## Read-Only APIs

Use the APIs for planning. No wallet, SDK, or RPC is required.

### Banks

`GET https://ai.0.xyz/api/banks`

Fields used most often:

| Field | Meaning |
| --- | --- |
| `bank_address` | On-chain bank address; pass this directly to `mfi` |
| `symbol` | Token symbol |
| `mint` | Token mint address |
| `mint_decimals` | Token decimals |
| `venue` | `P0`, `Kamino`, `Drift`, or `JupLend` |
| `asset_weight_init` | Initial asset weight |
| `asset_weight_maint` | Maintenance asset weight |
| `liability_weight_init` | Initial liability weight |
| `liability_weight_maint` | Maintenance liability weight |
| `deposit_apy` | Effective deposit APY percentage |
| `borrow_apy` | Borrow APY percentage |
| `usd_price` | Oracle price in USD |

Notes:

- `deposit_apy` is already precomputed.
- Use `bank_address` directly in CLI commands.
- Use the weight fields plus `usd_price` to calculate account health.
- Do not recommend borrows from non-`P0` venues.

### Strategies

`GET https://ai.0.xyz/api/strategies`

Top-level shape:

- `asOf`: ISO timestamp for the snapshot.
- `sortBy`: current upstream ranking key.
- `nativeMaxAgeSec`: freshness limit for native yield inputs.
- `strategies`: grouped non-directional strategies.
- `directional`: grouped directional strategies.

`strategies` is an object keyed by category. Common categories include:

- `stablecoins`
- `solLst`

Each category contains an array of strategy objects. Fields used most often:

| Field | Meaning |
| --- | --- |
| `supplyMint` | Mint deposited into the strategy |
| `supplySymbol` | Deposited asset symbol |
| `borrowMint` | Mint borrowed for the strategy |
| `borrowSymbol` | Borrowed asset symbol |
| `supplyBank` | Deposit bank address; pass this to `mfi` for deposits |
| `borrowBank` | Borrow bank address; pass this to `mfi` for borrows |
| `supplyVenue` | Lending venue for the supplied asset |
| `borrowVenue` | Borrow venue for the borrowed asset |
| `lendApy` | Base supply APY percentage before leverage |
| `borrowApy` | Base borrow APY percentage before leverage |
| `nativeYield.supply.apy` | Native asset yield on the supply side, if any |
| `emissions.supply.apy` | Emissions APY on the supply side, if any |
| `netApyBase` | Unlevered net APY percentage |
| `maxLeverage` | Maximum leverage multiplier |
| `netApyAtMaxLeverage` | Projected APY percentage at max leverage |
| `availableStrategySizeUsd` | Estimated remaining capacity in USD |
| `bindingConstraint` | What currently limits strategy size |
| `emodeApplied` | Whether e-mode assumptions are applied |

`directional` is an object keyed by asset, for example `sol`, `btc`, `eth`, or
`jlp`. Each asset may contain `long` and/or `short` strategy objects using the
same field shape as above.

Practical usage:

- For looping strategies, use `supplyBank` as the deposit bank and `borrowBank`
  as the borrow bank.
- Treat each group independently. Do not assume the API has already flattened or
  truncated the result for you.
- Prefer `netApyAtMaxLeverage` when comparing headline leveraged opportunities.
- Prefer `netApyBase` when comparing the unlevered spread.
- Check `availableStrategySizeUsd` before recommending size.
- Respect `supplyVenue` and `borrowVenue`; only `P0` banks are valid for borrows
  through `mfi`.

### Wallet

`GET https://ai.0.xyz/api/wallet/{address}`

Returns:

- `wallet`
- `total_usd_value`
- `tokens[]`

Per token:

| Field | Meaning |
| --- | --- |
| `address` | Mint address; matches bank `mint` |
| `symbol` | Token symbol |
| `decimals` | Token decimals |
| `balance` | Human-readable amount |
| `usd_price` | Price per token |
| `usd_value` | Total USD value |

---

## `mfi` Overview

Use `mfi` for installation verification, profile configuration, account
selection, and all P0 protocol actions.

### Setup

Use built-in help as the source of truth for exact flags and newer subcommands:

```bash
mfi -h
mfi profile -h
mfi account -h
mfi bank -h
```

Install and profile setup are described in the workflow above. Core commands:

```bash
mfi --version
mfi profile show
mfi profile list
mfi account list
```

### Account selection

Use:

```bash
mfi account -h
mfi account list
mfi account get <ACCOUNT_PUBKEY>
mfi account use <ACCOUNT_PUBKEY>
mfi account create
```

Guidance:

- Keep one explicit account selected for the whole workflow.
- Do not rediscover accounts mid-flow and assume the first result is correct.

### Core actions

Amounts are UI amounts.

For exact flags and newer subcommands, use:

```bash
mfi account deposit -h
mfi account withdraw -h
mfi account borrow -h
mfi account repay -h
mfi account pulse-health -h
```

Deposit:

```bash
mfi account deposit <BANK_PUBKEY> <UI_AMOUNT>
```

Withdraw specific amount:

```bash
mfi account withdraw <BANK_PUBKEY> <UI_AMOUNT>
```

Withdraw all:

```bash
mfi account withdraw <BANK_PUBKEY> 0 --all
```

Borrow:

```bash
mfi account borrow <BANK_PUBKEY> <UI_AMOUNT>
```

Repay specific amount:

```bash
mfi account repay <BANK_PUBKEY> <UI_AMOUNT>
```

Repay all:

```bash
mfi account repay <BANK_PUBKEY> 0 --all
```

Health check:

```bash
mfi account get
mfi account pulse-health
```

Preferred health workflow:

```bash
mfi account pulse-health -y
mfi account get
mfi account get --json
```

Health reporting rules:

- Use `mfi account pulse-health` as the authoritative on-chain health refresh.
- Then use `mfi account get` or `mfi account get --json` to report exact current
  deposits and borrows.
- For exact health math, use the protocol definition from the Risk Engine docs:
  `Health = Sum(Asset Value * Asset Weight) - Sum(Liability Value * Liability Weight)`.
- For liquidation risk, use Maintenance weights.
- Exact calculation inputs should come from:
  - `mfi account get --json` for exact positions and sides
  - `GET https://ai.0.xyz/api/banks` for `usd_price`, `asset_weight_maint`, and
    `liability_weight_maint`
- Match each position's `bank` value from `mfi account get --json` to the banks
  API `bank_address`.
- For each deposit position, contribution is `amount * usd_price * asset_weight_maint`.
- For each borrow position, contribution is `amount * usd_price * liability_weight_maint`.
- Maintenance health is total weighted deposits minus total weighted borrows.
- Use Initial weights only if the user asks about borrowing power for new
  borrows or withdrawals.
- Do not invent ad hoc "coverage" ratios from wallet balances.
- Health semantics: positive health is safe, zero is the boundary, negative
  health is liquidatable.

### Execution rules

- `mfi` mutating commands simulate first, then sign and send on success.
- `mfi` may prompt for confirmation on state-changing commands.
- Only use `-y` / `--skip-confirmation` after the user has already approved the
  exact action in chat.
- After any mutation, inspect account state again.

### Safety rules

- When depositing SOL, keep at least `0.01 SOL` in the wallet for fees.
- Before borrowing, inspect the selected account and ensure it has collateral.
- Leave a safety buffer; do not try to borrow to the absolute limit.
- If an execution step fails, do not blindly retry more than once.

---

## Gotchas

- `mfi` bank inputs are bank pubkeys, not token symbols.
- Use API `bank_address` values directly with `mfi`.
- The active `mfi` profile can silently change which account or group is used.
- `mfi account use` changes defaults for later commands.
- If `mfi` is not on `PATH`, prefer self-installing the release binary first;
  only fall back to an explicit binary path or local checkout if needed.
- This skill does not execute swaps. If a swap is required, handle it separately
  before continuing with P0 actions.
- Recommendation logic should stay API-driven even if execution is CLI-driven.

## Health Reference

Use the protocol health score semantics from the Risk Engine docs:

| Health | Status |
| --- | --- |
| `> 0` | Healthy |
| `= 0` | At the boundary |
| `< 0` | Liquidatable |
