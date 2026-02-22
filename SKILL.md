---
name: p0-credit
version: 1.0.0
description: >
  Permissionless DeFi yield and credit on Solana via the Project 0 (P0) protocol.
  Deposit funds to earn yield across Solana's highest-yielding venues.
  Borrow SOL and stablecoins against cross-venue collateral.
  All operations are on-chain and permissionless -- no API keys, no accounts,
  no approval process. Only a Solana keypair is required.
homepage: https://0.xyz
---

# P0 Credit Skill

## What is Project 0?

P0 is a DeFi lending protocol on Solana. It provides unified margin accounts
that span multiple lending venues (P0 native, Kamino, Drift), giving agents
access to the best yields and deepest liquidity across the Solana ecosystem.

**Why an agent should use P0:**

- **Earn yield** on idle assets instead of leaving them in a wallet.
- **Access liquidity** by borrowing against collateral without selling.
- **Execute rate-arb loops** to amplify returns with controlled leverage.
- **Permissionless** -- no signup, no API keys, no approval process.
- **Non-custodial** -- the agent holds its own keypair.

**Example prompts:**

- "What are the best deposit yields on P0 right now?"
- "Show the top stablecoin rate-arb opportunities on P0."
- "Deposit 0.05 SOL on P0 and return the transaction link."
- "What is the cheapest stablecoin to borrow on P0?"

---

## Read-Only: Fetching Data from P0

Use the public HTTP APIs for read-only tasks. No SDK, no wallet, no RPC needed.

### Banks endpoint

`GET https://app.0.xyz/api/banks/db`

Returns every lending pool (bank) with rates, metadata, and pricing.

```typescript
const res = await fetch("https://app.0.xyz/api/banks/db");
const banks = await res.json();
```

**Key fields per bank:**

| Field              | Description                                         |
| ------------------ | --------------------------------------------------- |
| `symbol`           | Token symbol (SOL, USDC, JitoSOL, ...)              |
| `mint`             | Token mint address                                  |
| `venue`            | Lending venue (P0, Kamino, Drift)                   |
| `asset_tag`        | Venue tag (0=P0 default, 1=SOL, 2=Staked, 3=Kamino, 4=Drift) |
| `risk_tier`        | Collateral or Isolated                              |
| `deposit_rate_pct` | Deposit APY as percentage                           |
| `borrow_rate_pct`  | Borrow APY as percentage                            |
| `mint_avg_apy`     | Underlying token yield (e.g. LST staking rate)      |
| `max_mint_apy`     | Cap on underlying token yield                       |
| `usd_price`        | Oracle price in USD                                 |

**Computing effective deposit APY:**

```
effective_deposit_apy = deposit_rate_pct + min(mint_avg_apy, max_mint_apy)
```

For most tokens `mint_avg_apy` is 0. For LSTs (JitoSOL, mSOL, bSOL) it includes
the staking yield. `max_mint_apy` caps outlier values -- use it when present.

If `*_rate_pct` fields are missing, fall back to `deposit_rate` or `borrow_rate`
(decimals, e.g. 0.05 = 5%) and multiply by 100.

**Finding best deposit yields (top 10):**

Sort banks by `effective_deposit_apy` descending.

**Finding cheapest stablecoin borrows:**

Filter where `symbol` is in `[USDC, USDT, USDG, USDS, HYUSD]`, sort by
`borrow_rate_pct` ascending.

### Strategies endpoint

`GET https://app.0.xyz/api/strategies`

Returns precomputed strategies with APYs and leverage.

```typescript
const res = await fetch("https://app.0.xyz/api/strategies");
const { data } = await res.json();
const strategies = data.strategies || [];
```

**Strategy types:**

| Type          | Description                         |
| ------------- | ----------------------------------- |
| `rate-arb`    | Pure rate arbitrage (deposit vs borrow spread) |
| `campaign`    | Includes emissions or points        |
| `manual`      | Curated loops (e.g. JLP)            |
| `directional` | Long/short strategies               |

**Common filters:**

```typescript
// Stablecoin rate-arb only (no emissions)
const stableArbs = strategies
  .filter((s) => s.type === "rate-arb")
  .filter((s) => s.assetGroups?.includes("stablecoins"))
  .sort((a, b) => (b.apy || 0) - (a.apy || 0));

// SOL/LST arbs
const solArbs = strategies
  .filter((s) => ["rate-arb", "campaign"].includes(s.type))
  .filter((s) => s.assetGroups?.includes("sol-lst"))
  .sort((a, b) => (b.apy || 0) - (a.apy || 0));
```

---

## On-Chain: Interacting with the Protocol

Use the TypeScript SDK for actions that require signing: create account, deposit,
withdraw, borrow, repay, loop. Requires a Solana keypair and user authorization.

### Prerequisites

- Node.js >= 18
- Solana keypair file (JSON array, e.g. `~/.config/solana/id.json`)
  - Generate: `solana-keygen new --outfile ~/.config/solana/id.json`
- Funded wallet (SOL for tx fees + tokens to deposit)
- RPC endpoint (public works; paid RPC like Helius recommended)

### Install

```bash
npm install @0dotxyz/p0-ts-sdk @solana/web3.js
```

`@solana/web3.js` is pinned to **1.98.2** to match the SDK's peer dependency.

### Initialize client

```typescript
import { Connection } from "@solana/web3.js";
import { Project0Client, getConfig } from "@0dotxyz/p0-ts-sdk";

const connection = new Connection("YOUR_RPC_URL", "confirmed");
const config = getConfig("production");
const client = await Project0Client.initialize(connection, config);
```

Reuse the client instance. Do not reinitialize per operation.

The client loads all on-chain state: `client.banks` (Bank[]), `client.bankMap`,
`client.oraclePriceByBank`, `client.mintDataByBank`, `client.addressLookupTables`.

### Create or load account

A P0 account (MarginfiAccount) is an on-chain PDA that holds positions.
One wallet can own multiple accounts via different indices.

```typescript
// Discover existing accounts
const accounts = await client.getAccountAddresses(wallet.publicKey);

let wrappedAccount;
if (accounts.length > 0) {
  // Load existing
  wrappedAccount = await client.fetchAccount(accounts[0]!);
} else {
  // Create new (legacy tx -- set blockhash + feePayer)
  const createTx = await client.createMarginfiAccountTx(wallet.publicKey);
  createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  createTx.feePayer = wallet.publicKey;
  createTx.sign(wallet);
  await connection.sendRawTransaction(createTx.serialize());

  const created = await client.getAccountAddresses(wallet.publicKey);
  wrappedAccount = await client.fetchAccount(created[0]!);
}
```

### Find a bank

Banks are lending pools. Multiple banks can exist for the same token across venues.

```typescript
import { AssetTag } from "@0dotxyz/p0-ts-sdk";

const usdcBanks = client.getBanksByMint(USDC_MINT);                       // all venues
const usdcP0    = client.getBanksByMint(USDC_MINT, AssetTag.DEFAULT)[0];  // P0 native
const solBank   = client.getBanksByMint(SOL_MINT, AssetTag.SOL)[0];       // P0 SOL
const kaminoSol = client.getBanksByMint(SOL_MINT, AssetTag.KAMINO)[0];    // Kamino
```

**AssetTag values:**

| Tag                | Value | Venue / Usage                   |
| ------------------ | ----- | ------------------------------- |
| `AssetTag.DEFAULT` | 0     | P0 native (stablecoins)        |
| `AssetTag.SOL`     | 1     | P0 native (SOL)                |
| `AssetTag.STAKED`  | 2     | P0 native (LSTs)               |
| `AssetTag.KAMINO`  | 3     | Kamino                          |
| `AssetTag.DRIFT`   | 4     | Drift                           |

### Deposit

Returns a legacy transaction. Amounts are human-readable strings.

```typescript
const depositTx = await wrappedAccount.makeDepositTx(bankAddress, "100");
depositTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
depositTx.feePayer = wallet.publicKey;
depositTx.sign(wallet);
await connection.sendRawTransaction(depositTx.serialize());
```

### Withdraw

Returns a versioned transaction bundle. Send each tx sequentially.

```typescript
const withdrawResult = await wrappedAccount.makeWithdrawTx(
  bankAddress,
  "50",
  false, // set true to withdraw all
);
for (const tx of withdrawResult.transactions) {
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
}
```

### Borrow

Returns a versioned transaction bundle (may include oracle crank txs).

```typescript
// Check capacity first
const maxBorrow = wrappedAccount.computeMaxBorrowForBank(bankAddress);

const borrowResult = await wrappedAccount.makeBorrowTx(bankAddress, "50");
for (const tx of borrowResult.transactions) {
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
}
```

### Repay

Returns a legacy transaction.

```typescript
// Repay specific amount
const repayTx = await wrappedAccount.makeRepayTx(bankAddress, "50", false);

// Repay all debt
const repayAllTx = await wrappedAccount.makeRepayTx(bankAddress, "0", true);

repayTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
repayTx.feePayer = wallet.publicKey;
repayTx.sign(wallet);
await connection.sendRawTransaction(repayTx.serialize());
```

### Loop (leveraged position)

Loops deposit into one bank and borrow from another in a single flash-loan-based
operation to amplify yield via rate arbitrage.

```typescript
const loopResult = await wrappedAccount.makeLoopTx(
  depositBankAddress,  // bank to deposit into
  borrowBankAddress,   // bank to borrow from
  "100",               // deposit amount
  "2",                 // target leverage multiplier
);
for (const tx of loopResult.transactions) {
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
}
```

### Health monitoring

```typescript
import { MarginRequirementType } from "@0dotxyz/p0-ts-sdk";

const freeCollateral = wrappedAccount.computeFreeCollateralFromCache();
const maxBorrow = wrappedAccount.computeMaxBorrowForBank(bankAddress);
const maxWithdraw = wrappedAccount.computeMaxWithdrawForBank(bankAddress);

const health = wrappedAccount.computeHealthComponentsFromCache(
  MarginRequirementType.Maintenance,
);
const healthFactor = health.assets.dividedBy(health.liabilities).toNumber();
// > 1.0 = healthy, < 1.0 = liquidatable

const netApy = wrappedAccount.computeNetApy();
```

| Health Factor | Status                                         |
| ------------- | ---------------------------------------------- |
| > 2.0         | Healthy                                        |
| 1.1 - 2.0    | Monitor closely                                |
| 1.0 - 1.1    | Danger -- repay or deposit more                |
| < 1.0         | Liquidatable                                   |

---

## Transaction Patterns

The SDK builds transactions but never signs or sends them.

**Pattern A: Legacy transaction** (deposit, repay, create account)

Returns a single `Transaction`. You must set `recentBlockhash` and `feePayer`:

```typescript
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
tx.feePayer = wallet.publicKey;
tx.sign(wallet);
await connection.sendRawTransaction(tx.serialize());
```

**Pattern B: Versioned transaction bundle** (borrow, withdraw, loop)

Returns `TransactionBuilderResult` with `transactions[]`. Blockhash is embedded.
Send sequentially, confirming each before the next:

```typescript
for (const tx of result.transactions) {
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
}
```

Bundles may contain setup txs (oracle cranks, ATA creation) that must execute
before the main action. Always send in order.

---

## Common Mints

| Token   | Mint Address                                   | AssetTag           |
| ------- | ---------------------------------------------- | ------------------ |
| SOL     | `So11111111111111111111111111111111111111112`  | `AssetTag.SOL`     |
| USDC    | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `AssetTag.DEFAULT` |
| USDT    | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | `AssetTag.DEFAULT` |
| JitoSOL | `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn` | `AssetTag.STAKED`  |
| mSOL    | `mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So`  | `AssetTag.STAKED`  |
| bSOL    | `bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1`  | `AssetTag.STAKED`  |

---

## Error Reference

| Error                          | Cause                                  | Resolution                                              |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| `Bank not found`               | No bank for mint + AssetTag combo      | Try without AssetTag: `getBanksByMint(mint)`             |
| `Insufficient free collateral` | Not enough collateral to borrow        | Deposit more or borrow less                             |
| `Simulation failed`            | Transaction would fail on-chain        | Check logs -- often stale oracle or insufficient balance |
| `Transaction expired`          | Blockhash expired before confirmation  | Retry with fresh blockhash                              |
| `Account not found`            | P0 account address does not exist      | Verify address or create a new account                  |
| `simulateBundle not supported` | RPC lacks bundle simulation            | Use paid RPC (Helius, Triton) or simulate individually  |
