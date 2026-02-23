---
name: p0-credit
version: 2.0.0
description: >
  Permissionless DeFi yield and credit on Solana via the Project 0 (P0) protocol.
  Deposit funds to earn yield across Solana's highest-yielding venues.
  Borrow SOL and stablecoins against cross-venue collateral.
  All operations are on-chain and permissionless -- no accounts, no approval
  process. Requires a Solana keypair and a paid RPC endpoint.
homepage: https://0.xyz
---

# P0 Credit Skill

## Agent Workflow

When a user asks to earn yield, deposit, borrow, or put funds to work on P0,
follow these steps in order. Do NOT skip ahead to writing code.

### Step 1: Check ALL wallet balances

Check the wallet's native SOL balance AND enumerate every SPL token account.
Do NOT only check SOL -- the wallet may hold LSTs (JitoSOL, bbSOL, mSOL),
stablecoins (USDC, USDT), or other tokens that earn higher yields on P0.

```typescript
import { PublicKey } from "@solana/web3.js";

// Native SOL
const solBalance = await connection.getBalance(wallet.publicKey);

// All SPL token accounts (Token Program)
const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
  wallet.publicKey,
  { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") },
);

// Also check Token-2022 accounts
const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
  wallet.publicKey,
  { programId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") },
);
```

List every token with a non-zero balance. Include mint address, symbol (if
known), and UI amount.

### Step 2: Fetch P0 data

Fetch banks and strategies from the P0 APIs (see Read-Only section below).

### Step 3: Recommend optimal action

Match wallet holdings to available bank yields. For each token the wallet
holds, find the best deposit APY from the banks data. Compare across all
holdings to find the highest overall yield.

If swapping to a different token would yield significantly more, recommend the
swap and explain the tradeoff.

**Present the plan to the user with specific numbers before executing.**

Example response: *"Your wallet holds 0.09 bbSOL and 0.10 SOL. bbSOL earns
15.2% APY on P0 vs SOL at 4.9%. I recommend depositing your bbSOL for the
higher yield, and swapping your spare SOL into more bbSOL. Shall I proceed?"*

### Step 4: Collect credentials

Ask the user for what is needed based on the plan from step 3. Do not assume
values. Do not use placeholders. Prompt and wait for real values.

- **Always needed:** *"I need a paid Solana RPC URL to interact with P0.
  Do you have one? (Helius has a free tier at https://www.helius.dev)"*

- **Only if swapping tokens:** *"I need a Jupiter API key for the token swap.
  You can get a free one at https://portal.jup.ag (60 req/min)"*

If the user only needs to deposit tokens already in their wallet, skip the
Jupiter API key -- it is not needed for deposits, withdrawals, borrows, or
repays.

### Step 5: Execute

Execute the plan from step 3. Swap first if needed (see Swapping Tokens
section), then deposit, borrow, etc. Report results with Solscan transaction
links: `https://solscan.io/tx/${signature}`

---

## What is Project 0?

P0 is a DeFi lending protocol on Solana. It provides unified margin accounts
that span multiple lending venues (P0 native, Kamino, Drift), giving agents
access to the best yields and deepest liquidity across the Solana ecosystem.

**Why an agent should use P0:**

- **Earn yield** on idle assets instead of leaving them in a wallet.
- **Access liquidity** by borrowing against collateral without selling.
- **Permissionless** -- no signup, no approval process.
- **Non-custodial** -- the agent holds its own keypair.

**Example prompts:**

- "What are the best deposit yields on P0 right now?"
- "Deposit 0.05 SOL on P0 and return the transaction link."
- "What is the cheapest stablecoin to borrow on P0?"
- "Put my funds to work on P0 for the best yield."

---

## Read-Only: Fetching Data from P0

Use the public HTTP APIs for read-only tasks. No SDK, no wallet, no RPC needed.

### Banks endpoint

`GET https://p0-agents.vercel.app/api/banks`

Returns every lending pool (bank) with rates, metadata, and pricing. Only
collateral-tier banks are included (isolated banks are filtered out). The
response is a lightweight projection (9 fields per bank) with deposit APY
pre-computed.

```typescript
const res = await fetch("https://p0-agents.vercel.app/api/banks");
const banks = await res.json();
```

**Fields per bank:**

| Field           | Description                                              |
| --------------- | -------------------------------------------------------- |
| `bank_address`  | On-chain bank address (use with SDK `client.getBank()`)  |
| `symbol`        | Token symbol (SOL, USDC, JitoSOL, ...)                   |
| `mint`          | Token mint address                                       |
| `mint_decimals` | Token decimal places (9 for SOL, 6 for USDC)             |
| `venue`         | Lending venue (P0, Kamino, Drift)                        |
| `deposit_apy`   | Effective deposit APY as percentage (pre-computed, includes underlying yield) |
| `borrow_apy`    | Borrow APY as percentage                                 |
| `usd_price`     | Oracle price in USD                                      |
| `token_program` | Token program (TOKEN_PROGRAM_ID or TOKEN_2022)           |

The `deposit_apy` field already includes underlying token yield (e.g. LST staking
rates). No manual computation needed -- just sort by `deposit_apy` descending.

**Borrowing is only available on P0 venue banks.** Kamino and Drift banks are
deposit-only -- you can earn yield on them but cannot borrow from them. When
looking for borrow opportunities, filter to `venue === "P0"`.

**Finding best deposit yields:**

Sort banks by `deposit_apy` descending.

**Finding cheapest stablecoin borrows:**

Filter where `venue` is `"P0"` and `symbol` is in `[USDC, USDT, USDG, USDS, HYUSD]`,
sort by `borrow_apy` ascending.

**Matching wallet holdings to banks:** Use the `mint` field to match tokens in
the wallet to available banks. A wallet token account's mint address corresponds
to a bank's `mint` field.

### Strategies endpoint

`GET https://p0-agents.vercel.app/api/strategies`

Returns precomputed strategies showing the best deposit/borrow combinations
with projected APYs. Useful for finding which token to deposit and which to
borrow for the best spread.

```typescript
const res = await fetch("https://p0-agents.vercel.app/api/strategies");
const strategies = await res.json();
```

**Key fields per strategy:**

| Field                  | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `type`                 | Strategy type (see table below)                     |
| `heading`              | Human-readable name                                 |
| `apy`                  | Projected APY (decimal, e.g. 0.085 = 8.5%)          |
| `leverage`             | Leverage multiplier                                 |
| `spread`               | Rate spread between deposit and borrow              |
| `primaryBankAddress`   | Bank to deposit into                                |
| `secondaryBankAddress` | Bank to borrow from                                 |
| `assetGroups`          | Categories: `stablecoins`, `sol-lst`, `blue-chip`   |

**Strategy types:**

| Type          | Description                         |
| ------------- | ----------------------------------- |
| `rate-arb`    | Pure rate arbitrage (deposit vs borrow spread) |
| `campaign`    | Includes emissions or points        |
| `manual`      | Curated strategies (e.g. JLP)       |
| `directional` | Long/short strategies               |

**Using strategies to plan deposits and borrows:**

Strategies show which deposit/borrow pairs have the best spread. The agent can
execute these as separate deposit + borrow operations:

```typescript
// Find the best stablecoin strategy
const stableArbs = strategies
  .filter((s) => s.type === "rate-arb")
  .filter((s) => s.assetGroups?.includes("stablecoins"))
  .sort((a, b) => (b.apy || 0) - (a.apy || 0));

const best = stableArbs[0];
// best.primaryBankAddress = bank to deposit into
// best.secondaryBankAddress = bank to borrow from
// Execute as: deposit into primaryBank, then borrow from secondaryBank
```

**Connecting strategies to banks:** Use `primaryBankAddress` and
`secondaryBankAddress` from a strategy to look up bank details from the
banks API:

```typescript
const banksRes = await fetch("https://p0-agents.vercel.app/api/banks");
const banksData = await banksRes.json();
const banksByAddress = Object.fromEntries(banksData.map((b) => [b.bank_address, b]));

const depositBankInfo = banksByAddress[strategy.primaryBankAddress];
const borrowBankInfo = banksByAddress[strategy.secondaryBankAddress];
// depositBankInfo.symbol, depositBankInfo.mint, depositBankInfo.deposit_apy, etc.
```

---

## On-Chain: Interacting with the Protocol

Use the TypeScript SDK for actions that require signing: create account, deposit,
withdraw, borrow, repay. Requires a Solana keypair and user authorization.

### Prerequisites

- Node.js >= 18
- Solana keypair (JSON byte array)
- Funded wallet (SOL for tx fees + tokens to deposit)
- **Paid RPC endpoint** (ask user -- see Agent Workflow step 4)
- **Jupiter API key** (ask user only if swapping -- see Agent Workflow step 4)

### RPC setup

The public Solana RPC (`https://api.mainnet-beta.solana.com`) has aggressive rate
limits. P0 operations that involve multiple transactions will fail on the public
RPC.

Use a paid RPC provider:

- **Helius** -- https://www.helius.dev (free tier available, sign up for an API key)
- **Triton** -- https://triton.one
- **Quicknode** -- https://www.quicknode.com

### Wallet setup

Generate a keypair if one does not exist:

```bash
solana-keygen new --outfile ~/.config/solana/id.json
```

Load the keypair in code:

```typescript
import { Keypair, Connection } from "@solana/web3.js";
import fs from "fs";

const wallet = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync("~/.config/solana/id.json", "utf-8"))
  )
);
```

### Install

```bash
npm install @0dotxyz/p0-ts-sdk
```

`@solana/web3.js` (1.98.4) is bundled as a direct dependency -- no need to
install it separately.

### Initialize client

```typescript
import { Connection } from "@solana/web3.js";
import { Project0Client, getConfig } from "@0dotxyz/p0-ts-sdk";

// RPC_URL must be provided by the user (paid RPC required)
const connection = new Connection(RPC_URL, "confirmed");
const config = getConfig("production");
const client = await Project0Client.initialize(connection, config);
```

Reuse the client instance. Do not reinitialize per operation.

The client loads all on-chain state: `client.banks` (Bank[]), `client.bankMap`,
`client.oraclePriceByBank`, `client.mintDataByBank`,
`client.assetShareValueMultiplierByBank`, `client.addressLookupTables`.

### Create or load account

A P0 account (MarginfiAccount) is an on-chain PDA that holds positions.
One wallet can own multiple accounts via different `accountIndex` values.

```typescript
// Discover existing accounts
const accounts = await client.getAccountAddresses(wallet.publicKey);

let wrappedAccount;
if (accounts.length > 0) {
  // Load existing
  wrappedAccount = await client.fetchAccount(accounts[0]!);
} else {
  // Create new (accountIndex defaults to 0)
  const createTx = await client.createMarginfiAccountTx(
    wallet.publicKey,
    0, // accountIndex -- use different values to create multiple accounts
  );
  createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  createTx.sign(wallet);
  const createSig = await connection.sendRawTransaction(createTx.serialize());
  await connection.confirmTransaction(createSig, "confirmed");

  const created = await client.getAccountAddresses(wallet.publicKey);
  wrappedAccount = await client.fetchAccount(created[0]!);
}
```

### Find a bank

Banks are lending pools. Use the banks API to discover banks, then
`client.getBank()` to get the SDK Bank object for transactions.

```typescript
import { PublicKey } from "@solana/web3.js";

// Fetch bank metadata from the API
const banksRes = await fetch("https://p0-agents.vercel.app/api/banks");
const banksData = await banksRes.json();

// Find a specific bank (e.g. highest-yield SOL bank)
const solBanks = banksData
  .filter((b) => b.symbol === "SOL")
  .sort((a, b) => b.deposit_apy - a.deposit_apy);
const bestSolBank = solBanks[0];

// Get the SDK Bank object for on-chain operations
const bankObject = client.getBank(new PublicKey(bestSolBank.bank_address));
```

---

## Core Operations

### Deposit

Returns a legacy transaction. Amounts are in UI units (human-readable numbers).

```typescript
const depositTx = await wrappedAccount.makeDepositTx(bankAddress, 100);
depositTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
depositTx.sign(wallet);
const sig = await connection.sendRawTransaction(depositTx.serialize());
await connection.confirmTransaction(sig, "confirmed");
```

### Withdraw

Returns a versioned transaction bundle. Send each tx sequentially.

```typescript
const withdrawResult = await wrappedAccount.makeWithdrawTx(
  bankAddress,
  50,
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

const borrowResult = await wrappedAccount.makeBorrowTx(bankAddress, 50);
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
const repayTx = await wrappedAccount.makeRepayTx(bankAddress, 50, false);

// Repay all debt
const repayAllTx = await wrappedAccount.makeRepayTx(bankAddress, 0, true);

repayTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
repayTx.sign(wallet);
const sig = await connection.sendRawTransaction(repayTx.serialize());
await connection.confirmTransaction(sig, "confirmed");
```

---

## Swapping Tokens via Jupiter

If the wallet holds a different token than what a strategy requires (e.g.
holds SOL but the best yield is for bbSOL), swap first using the Jupiter API.

**Jupiter requires an API key.** The free tier (60 req/min) is sufficient.
Ask the user: *"I need a Jupiter API key for the token swap. Get a free one
at https://portal.jup.ag"*

### Get a quote and execute swap

```typescript
import { VersionedTransaction } from "@solana/web3.js";

// JUP_API_KEY must be provided by the user
const inputMint = "So11111111111111111111111111111111111111112";   // SOL
const outputMint = "Bybit2vBJGhPF52GBdNaQfUJ6ZpThSgHBobjWZpLPb4B"; // bbSOL
const amount = 100000000; // raw integer units (0.1 SOL = 100000000 lamports)

// 1. Get quote
const quoteResponse = await (
  await fetch(
    `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}` +
    `&outputMint=${outputMint}` +
    `&amount=${amount}` +
    `&slippageBps=50` +
    `&restrictIntermediateTokens=true`,
    { headers: { "x-api-key": JUP_API_KEY } },
  )
).json();

// 2. Build swap transaction
const swapResponse = await (
  await fetch("https://api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": JUP_API_KEY,
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: wallet.publicKey.toBase58(),
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 1000000,
          priorityLevel: "veryHigh",
        },
      },
    }),
  })
).json();

// 3. Sign and send
const swapTx = VersionedTransaction.deserialize(
  Buffer.from(swapResponse.swapTransaction, "base64")
);
swapTx.sign([wallet]);
const sig = await connection.sendRawTransaction(swapTx.serialize());
await connection.confirmTransaction(sig, "confirmed");
console.log(`Swap: https://solscan.io/tx/${sig}`);
```

`amount` is in raw integer units (lamports for SOL, smallest unit for SPL
tokens). For example, 1 USDC = 1000000 (6 decimals), 1 SOL = 1000000000
(9 decimals). Use the `mint_decimals` field from the banks API to convert.

---

## Health Monitoring & Portfolio

### Checking portfolio positions

```typescript
import { MarginRequirementType } from "@0dotxyz/p0-ts-sdk";

// Fetch bank metadata for human-readable output
const banksRes = await fetch("https://p0-agents.vercel.app/api/banks");
const banksData = await banksRes.json();
const bankInfoByAddress = Object.fromEntries(
  banksData.map((b) => [b.bank_address, b])
);

// List all active positions
for (const balance of wrappedAccount.activeBalances) {
  const bankAddr = balance.bankPk.toBase58();
  const bank = client.getBank(balance.bankPk);
  if (!bank) continue;
  const multiplier = client.assetShareValueMultiplierByBank.get(bankAddr);
  const qty = balance.computeQuantityUi(bank, multiplier);
  const info = bankInfoByAddress[bankAddr];
  const label = info ? `${info.symbol} (${info.venue})` : bankAddr;
  if (qty.assets.gt(0)) console.log(`Deposit: ${qty.assets.toFixed(4)} ${label}`);
  if (qty.liabilities.gt(0)) console.log(`Borrow:  ${qty.liabilities.toFixed(4)} ${label}`);
}

// Account-level metrics
const accountValue = wrappedAccount.computeAccountValue();
const health = wrappedAccount.computeHealthComponentsFromCache(
  MarginRequirementType.Maintenance,
);
const healthFactor = health.assets.dividedBy(health.liabilities).toNumber();
const freeCollateral = wrappedAccount.computeFreeCollateralFromCache();
const netApy = wrappedAccount.computeNetApy();

console.log(`Account value: $${accountValue.toFixed(2)}`);
console.log(`Health factor: ${healthFactor.toFixed(2)}`);
console.log(`Free collateral: $${freeCollateral.toFixed(2)}`);
console.log(`Net APY: ${(netApy * 100).toFixed(2)}%`);
```

### Health factor reference

| Health Factor | Status                                         |
| ------------- | ---------------------------------------------- |
| > 2.0         | Healthy                                        |
| 1.1 - 2.0    | Monitor closely                                |
| 1.0 - 1.1    | Danger -- repay or deposit more                |
| < 1.0         | Liquidatable                                   |

### Health computation methods

```typescript
const freeCollateral = wrappedAccount.computeFreeCollateralFromCache();
const maxBorrow = wrappedAccount.computeMaxBorrowForBank(bankAddress);
const maxWithdraw = wrappedAccount.computeMaxWithdrawForBank(bankAddress);
const netApy = wrappedAccount.computeNetApy();
```

---

## Transaction Patterns

The SDK builds transactions but never signs or sends them.

**Pattern A: Legacy transaction** (deposit, repay, create account)

Returns a single `Transaction`. The SDK sets `feePayer` automatically. You must
set `recentBlockhash`, sign, send, and confirm:

```typescript
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
tx.sign(wallet);
const sig = await connection.sendRawTransaction(tx.serialize());
await connection.confirmTransaction(sig, "confirmed");
```

**Pattern B: Versioned transaction bundle** (borrow, withdraw)

Returns a result with `transactions[]` (typed `ExtendedV0Transaction[]`).
Blockhash is embedded. Send sequentially, confirming each before the next:

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

## End-to-End Examples

These examples assume `RPC_URL` and the wallet are already set up with values
provided by the user (see Agent Workflow step 4). `JUP_API_KEY` is only needed
if swapping tokens.

### Example A: Find best yield across all holdings and deposit

Check all wallet balances, match to P0 bank yields, deposit the highest-yielding
asset. If swapping would yield more, swap first.

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Project0Client, getConfig, MarginRequirementType } from "@0dotxyz/p0-ts-sdk";

// --- 1. Check ALL wallet balances ---
const solBalance = await connection.getBalance(wallet.publicKey);
console.log(`SOL: ${solBalance / 1e9}`);

const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
  wallet.publicKey,
  { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") },
);

const holdings: { mint: string; amount: number; decimals: number }[] = [];

// Add SOL
if (solBalance > 0) {
  holdings.push({
    mint: "So11111111111111111111111111111111111111112",
    amount: solBalance / 1e9,
    decimals: 9,
  });
}

// Add all SPL tokens with non-zero balance
for (const account of tokenAccounts.value) {
  const parsed = account.account.data.parsed.info;
  const uiAmount = parsed.tokenAmount.uiAmount;
  if (uiAmount > 0) {
    holdings.push({
      mint: parsed.mint,
      amount: uiAmount,
      decimals: parsed.tokenAmount.decimals,
    });
    console.log(`${parsed.mint}: ${uiAmount}`);
  }
}

// --- 2. Fetch P0 bank data ---
const banksRes = await fetch("https://p0-agents.vercel.app/api/banks");
const banksData = await banksRes.json();

// --- 3. Match holdings to best yields ---
const opportunities = [];
for (const holding of holdings) {
  const matchingBanks = banksData
    .filter((b) => b.mint === holding.mint)
    .sort((a, b) => b.deposit_apy - a.deposit_apy);
  if (matchingBanks.length > 0) {
    const best = matchingBanks[0];
    opportunities.push({
      ...holding,
      symbol: best.symbol,
      bank: best,
      depositApy: best.deposit_apy,
      usdValue: holding.amount * best.usd_price,
    });
  }
}

// Sort by APY descending
opportunities.sort((a, b) => b.depositApy - a.depositApy);

console.log("\nDeposit opportunities:");
for (const opp of opportunities) {
  console.log(`  ${opp.symbol}: ${opp.amount.toFixed(4)} (~$${opp.usdValue.toFixed(2)}) at ${opp.depositApy.toFixed(2)}% APY on ${opp.bank.venue}`);
}

// --- 4. Deposit the best opportunity ---
const best = opportunities[0];
console.log(`\nDepositing ${best.amount.toFixed(4)} ${best.symbol} at ${best.depositApy.toFixed(2)}% APY`);

const client = await Project0Client.initialize(connection, getConfig("production"));
const addrs = await client.getAccountAddresses(wallet.publicKey);
let wrappedAccount;
if (addrs.length > 0) {
  wrappedAccount = await client.fetchAccount(addrs[0]!);
} else {
  const createTx = await client.createMarginfiAccountTx(wallet.publicKey, 0);
  createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  createTx.sign(wallet);
  const createSig = await connection.sendRawTransaction(createTx.serialize());
  await connection.confirmTransaction(createSig, "confirmed");
  const created = await client.getAccountAddresses(wallet.publicKey);
  wrappedAccount = await client.fetchAccount(created[0]!);
}

const bankAddress = new PublicKey(best.bank.bank_address);

// For SOL, keep some for tx fees
const depositAmount = best.mint === "So11111111111111111111111111111111111111112"
  ? Math.floor((best.amount - 0.01) * 10000) / 10000
  : best.amount;

const depositTx = await wrappedAccount.makeDepositTx(bankAddress, depositAmount);
depositTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
depositTx.sign(wallet);
const sig = await connection.sendRawTransaction(depositTx.serialize());
await connection.confirmTransaction(sig, "confirmed");
console.log(`Deposited: https://solscan.io/tx/${sig}`);
```

### Example B: Deposit collateral then borrow stablecoins

Deposit an asset as collateral, then borrow stablecoins against it.

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Project0Client, getConfig, MarginRequirementType } from "@0dotxyz/p0-ts-sdk";

// --- 1. Setup (assumes client and wrappedAccount are initialized) ---
const banksRes = await fetch("https://p0-agents.vercel.app/api/banks");
const banksData = await banksRes.json();
const banksByAddress = Object.fromEntries(banksData.map((b) => [b.bank_address, b]));

// --- 2. Deposit collateral (e.g. SOL) ---
const solBank = banksData
  .filter((b) => b.symbol === "SOL" && b.venue === "P0")
  .sort((a, b) => b.deposit_apy - a.deposit_apy)[0];

const depositBankAddress = new PublicKey(solBank.bank_address);
const solBalance = await connection.getBalance(wallet.publicKey);
const depositAmount = Math.floor(((solBalance / 1e9) - 0.02) * 10000) / 10000;

const depositTx = await wrappedAccount.makeDepositTx(depositBankAddress, depositAmount);
depositTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
depositTx.sign(wallet);
const depositSig = await connection.sendRawTransaction(depositTx.serialize());
await connection.confirmTransaction(depositSig, "confirmed");
console.log(`Deposited ${depositAmount} SOL: https://solscan.io/tx/${depositSig}`);

// --- 3. Check borrowing capacity ---
// Refresh account state after deposit
wrappedAccount = await client.fetchAccount(
  (await client.getAccountAddresses(wallet.publicKey))[0]!
);

const usdcBank = banksData
  .filter((b) => b.symbol === "USDC" && b.venue === "P0")[0];
const borrowBankAddress = new PublicKey(usdcBank.bank_address);

const maxBorrow = wrappedAccount.computeMaxBorrowForBank(borrowBankAddress);
console.log(`Max USDC borrow: ${maxBorrow.toFixed(2)}`);

// Borrow conservatively (50% of max to maintain healthy margin)
const borrowAmount = Math.floor(maxBorrow.toNumber() * 0.5 * 100) / 100;
console.log(`Borrowing ${borrowAmount} USDC (50% of max)`);

// --- 4. Borrow ---
const borrowResult = await wrappedAccount.makeBorrowTx(borrowBankAddress, borrowAmount);
for (const tx of borrowResult.transactions) {
  tx.sign([wallet]);
  const borrowSig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(borrowSig, "confirmed");
  console.log(`Borrow tx: https://solscan.io/tx/${borrowSig}`);
}

// --- 5. Check health ---
wrappedAccount = await client.fetchAccount(
  (await client.getAccountAddresses(wallet.publicKey))[0]!
);
const health = wrappedAccount.computeHealthComponentsFromCache(
  MarginRequirementType.Maintenance,
);
const healthFactor = health.assets.dividedBy(health.liabilities).toNumber();
const netApy = wrappedAccount.computeNetApy();
console.log(`Health factor: ${healthFactor.toFixed(2)}`);
console.log(`Net APY: ${(netApy * 100).toFixed(2)}%`);
```

---

## Error Reference

| Error                          | Cause                                  | Resolution                                              |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| `Bank not found`               | No bank for the given address          | Verify bank address from banks API                      |
| `Insufficient free collateral` | Not enough collateral to borrow        | Deposit more or borrow less                             |
| `Simulation failed`            | Transaction would fail on-chain        | Check logs -- often stale oracle or insufficient balance |
| `Transaction expired`          | Blockhash expired before confirmation  | Retry with fresh blockhash                              |
| `Account not found`            | P0 account address does not exist      | Verify address or create a new account                  |
| `429 Too Many Requests`        | RPC rate limited                       | Use a paid RPC provider                                 |
