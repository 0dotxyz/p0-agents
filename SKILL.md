---
name: p0-credit
version: 1.2.0
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
- "Find the best stablecoin rate-arb and execute a 2x loop."

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

| Field                  | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `bank_address`         | On-chain bank address (use with SDK `client.getBank()`) |
| `symbol`               | Token symbol (SOL, USDC, JitoSOL, ...)              |
| `mint`                 | Token mint address                                  |
| `mint_decimals`        | Token decimal places (9 for SOL, 6 for USDC)        |
| `venue`                | Lending venue (P0, Kamino, Drift)                   |
| `asset_tag`            | Venue tag (0=P0 default, 1=SOL, 2=Staked, 3=Kamino, 4=Drift) |
| `risk_tier`            | Collateral or Isolated                              |
| `deposit_rate_pct`     | Deposit APY as percentage                           |
| `borrow_rate_pct`      | Borrow APY as percentage                            |
| `mint_avg_apy`         | Underlying token yield (e.g. LST staking rate)      |
| `max_mint_apy`         | Cap on underlying token yield                       |
| `usd_price`            | Oracle price in USD                                 |
| `token_program_address`| Token program (TOKEN_PROGRAM_ID or TOKEN_2022)      |

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

**Connecting strategies to banks:** Use `primaryBankAddress` and
`secondaryBankAddress` from a strategy to look up bank details from the
banks API:

```typescript
const banksRes = await fetch("https://app.0.xyz/api/banks/db");
const banksData = await banksRes.json();
const banksByAddress = Object.fromEntries(banksData.map((b) => [b.bank_address, b]));

const depositBankInfo = banksByAddress[strategy.primaryBankAddress];
const borrowBankInfo = banksByAddress[strategy.secondaryBankAddress];
// depositBankInfo.symbol, depositBankInfo.mint, depositBankInfo.deposit_rate_pct, etc.
```

---

## On-Chain: Interacting with the Protocol

Use the TypeScript SDK for actions that require signing: create account, deposit,
withdraw, borrow, repay, loop. Requires a Solana keypair and user authorization.

### Prerequisites

- Node.js >= 18
- Solana keypair (JSON byte array)
- Funded wallet (SOL for tx fees + tokens to deposit)
- **Paid RPC endpoint** (required for reliable usage)

### RPC setup

The public Solana RPC (`https://api.mainnet-beta.solana.com`) has aggressive rate
limits and does not support `simulateBundle`. P0 operations (especially loops)
send multiple transactions and will fail on the public RPC.

Use a paid RPC provider:

- **Helius** -- https://www.helius.dev (free tier available, sign up for an API key)
- **Triton** -- https://triton.one
- **Quicknode** -- https://www.quicknode.com

Once you have an API key, your RPC URL will look like:
```
https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

Always use a paid RPC when interacting with P0 on-chain.

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

// Use a paid RPC -- public RPC will rate-limit and fail on multi-tx operations
const connection = new Connection(
  "https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY",
  "confirmed",
);
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
  createTx.feePayer = wallet.publicKey;
  createTx.sign(wallet);
  await connection.sendRawTransaction(createTx.serialize());

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
const banksRes = await fetch("https://app.0.xyz/api/banks/db");
const banksData = await banksRes.json();

// Find a specific bank (e.g. highest-yield SOL bank)
const solBanks = banksData
  .filter((b) => b.symbol === "SOL")
  .sort((a, b) => b.deposit_rate_pct - a.deposit_rate_pct);
const bestSolBank = solBanks[0];

// Get the SDK Bank object for on-chain operations
const bankObject = client.getBank(new PublicKey(bestSolBank.bank_address));
```

**AssetTag values (from the `asset_tag` field):**

| Tag | Value | Venue / Usage                   |
| --- | ----- | ------------------------------- |
| 0   | DEFAULT | P0 native (stablecoins)       |
| 1   | SOL     | P0 native (SOL)              |
| 2   | STAKED  | P0 native (LSTs)             |
| 3   | KAMINO  | Kamino                        |
| 4   | DRIFT   | Drift                         |

**Comingling rules (critical):**

A single P0 account cannot mix all asset types. The on-chain program enforces:

| Account contains | Can also hold       | Cannot hold |
| ---------------- | ------------------- | ----------- |
| DEFAULT only     | DEFAULT, SOL        | STAKED      |
| STAKED only      | STAKED, SOL         | DEFAULT     |
| SOL only         | DEFAULT or STAKED (not both) | --  |
| DEFAULT + SOL    | DEFAULT, SOL        | STAKED      |
| STAKED + SOL     | STAKED, SOL         | DEFAULT     |

SOL acts as a bridge -- it can coexist with either DEFAULT or STAKED, but once
an account holds both SOL and DEFAULT positions, STAKED is locked out (and vice
versa). KAMINO and DRIFT banks route through separate instruction sets and are
implicitly isolated.

Violating these rules produces on-chain error `6047` (`assetTagMismatch`).
If you need positions from both DEFAULT and STAKED groups, create separate
accounts using different `accountIndex` values.

### Deposit

Returns a legacy transaction. Amounts are human-readable strings (UI units).

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

**Do NOT deposit first then loop.** The loop handles the deposit internally via
flash loan. Depositing first and then looping will double-count your principal.
Just call `makeLoopTx` with your tokens in the wallet -- it does everything in
one atomic operation.

**The SDK handles Jupiter swaps internally.** If the deposit and borrow banks
have different mints (e.g. SOL deposit, JitoSOL borrow), the SDK automatically
calls Jupiter to swap between them. You only provide slippage settings. If the
mints are the same (e.g. USDC P0 and USDC Kamino), no swap is needed and
Jupiter is skipped entirely.

**You only need the deposit token in your wallet.** The loop flash-borrows,
swaps if needed, and deposits -- all atomically.

`makeLoopTx` takes a params object. The wrapper auto-injects `program`,
`marginfiAccount`, `bankMap`, `oraclePrices`, `bankMetadataMap`, and
`addressLookupTableAccounts`. You must provide:

- `connection` -- your RPC connection
- `assetShareValueMultiplierByBank` -- from `client.assetShareValueMultiplierByBank`
- `depositOpts.inputDepositAmount` -- principal in UI units (e.g. `100` for 100 USDC)
- `depositOpts.depositBank` -- the Bank object from `client.getBank(address)`
- `depositOpts.tokenProgram` -- from `client.mintDataByBank`
- `depositOpts.loopMode` -- `"DEPOSIT"` (adds your principal to the loop)
- `borrowOpts.borrowAmount` -- how much to flash-borrow in UI units
- `borrowOpts.borrowBank` -- the Bank object from `client.getBank(address)`
- `borrowOpts.tokenProgram` -- from `client.mintDataByBank`
- `swapOpts.jupiterOptions` -- slippage config (SDK calls Jupiter for you)

```typescript
// Get Bank objects using bank addresses (e.g. from strategies API)
const depositBank = client.getBank(new PublicKey(depositBankAddress))!;
const borrowBank = client.getBank(new PublicKey(borrowBankAddress))!;

// Get token programs from mintDataByBank (NOT from the bank object)
const depositMintData = client.mintDataByBank.get(depositBank.address.toBase58())!;
const borrowMintData = client.mintDataByBank.get(borrowBank.address.toBase58())!;

const loopResult = await wrappedAccount.makeLoopTx({
  connection,
  assetShareValueMultiplierByBank: client.assetShareValueMultiplierByBank,
  depositOpts: {
    inputDepositAmount: 100,       // principal deposit in UI units
    depositBank,                   // Bank object, not a PublicKey
    tokenProgram: depositMintData.tokenProgram,
    loopMode: "DEPOSIT",           // include principal in the loop
  },
  borrowOpts: {
    borrowAmount: 100,             // flash-borrow amount in UI units
    borrowBank,                    // Bank object, not a PublicKey
    tokenProgram: borrowMintData.tokenProgram,
  },
  swapOpts: {
    jupiterOptions: {
      slippageMode: "DYNAMIC",
      slippageBps: 50,
      platformFeeBps: 0,
    },
  },
});

for (const tx of loopResult.transactions) {
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
}
```

### Additional operations

The wrapper provides these methods for advanced use cases:

| Method                       | Description                                   | Returns               |
| ---------------------------- | --------------------------------------------- | --------------------- |
| `makeRepayWithCollatTx()`    | Repay debt using collateral (withdraw + swap) | Versioned tx bundle   |
| `makeSwapCollateralTx()`     | Swap one collateral asset for another         | Versioned tx bundle   |
| `makeSwapDebtTx()`           | Swap one debt for another                     | Versioned tx bundle   |
| `makeFlashLoanTx()`          | Execute a flash loan with custom instructions | Versioned tx          |
| `makeKaminoDepositTx()`      | Deposit into Kamino-tagged banks              | Legacy tx             |
| `makeKaminoWithdrawTx()`     | Withdraw from Kamino-tagged banks             | Versioned tx bundle   |
| `makeDriftDepositTx()`       | Deposit into Drift-tagged banks               | Legacy tx             |
| `makeDriftWithdrawTx()`      | Withdraw from Drift-tagged banks              | Versioned tx bundle   |

The swap/repay/loop methods take a params object with `connection`,
`assetShareValueMultiplierByBank`, operation-specific opts, and `swapOpts`
(Jupiter configuration). Always get `tokenProgram` from
`client.mintDataByBank.get(bank.address.toBase58())` -- it is not on the bank
object itself. See the loop example above for the pattern.

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

### Checking portfolio positions

```typescript
// Fetch bank metadata for human-readable output
const banksRes = await fetch("https://app.0.xyz/api/banks/db");
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
before the main action. Always send in order. The result includes
`actionTxIndex` indicating which transaction contains the main operation.

**Simulating before sending:**

Use `simulateBundle` to dry-run a multi-tx bundle before spending gas:

```typescript
import { simulateBundle } from "@0dotxyz/p0-ts-sdk";

const results = await simulateBundle(
  connection.rpcEndpoint,
  result.transactions,
);
// Check results for errors before signing and sending
```

Requires an RPC that supports `simulateBundle` (Helius, Triton). Public RPCs
may not support this.

---

## Common Mints

| Token   | Mint Address                                   | Decimals |
| ------- | ---------------------------------------------- | -------- |
| SOL     | `So11111111111111111111111111111111111111112`  | 9        |
| USDC    | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6     |
| USDT    | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | 6     |
| JitoSOL | `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn` | 9     |
| mSOL    | `mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So`  | 9     |
| bSOL    | `bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1`  | 9     |

---

## Swapping Tokens via Jupiter

If the agent's wallet holds a different token than what a strategy requires (e.g.
holds SOL but wants to deposit JitoSOL), use Jupiter to swap first. This is
independent of the P0 SDK -- it uses the Jupiter Swap API directly.

**Note:** You only need Jupiter for wallet-level swaps before entering a position.
The P0 SDK handles Jupiter internally for loops -- you never call Jupiter yourself
when using `makeLoopTx`.

### Get a quote

```typescript
const inputMint = "So11111111111111111111111111111111111111112";   // SOL
const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
const amount = 100000000; // 0.1 SOL in lamports (raw integer units)

const quoteResponse = await (
  await fetch(
    `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}` +
    `&outputMint=${outputMint}` +
    `&amount=${amount}` +
    `&slippageBps=50` +
    `&restrictIntermediateTokens=true`
  )
).json();
```

`amount` is in raw integer units (lamports for SOL, smallest unit for SPL
tokens). For example, 1 USDC = 1000000 (6 decimals), 1 SOL = 1000000000
(9 decimals).

### Build, sign, and send the swap transaction

```typescript
import { VersionedTransaction } from "@solana/web3.js";

const swapResponse = await (
  await fetch("https://api.jup.ag/swap/v1/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

// Deserialize, sign, and send
const swapTx = VersionedTransaction.deserialize(
  Buffer.from(swapResponse.swapTransaction, "base64")
);
swapTx.sign([wallet]);
const sig = await connection.sendRawTransaction(swapTx.serialize());
await connection.confirmTransaction(sig, "confirmed");
console.log(`swap: https://solscan.io/tx/${sig}`);
```

---

## End-to-End Examples

These examples assume the wallet and RPC connection are already set up (see
Wallet setup and RPC setup sections above).

### Example A: Simple deposit to earn yield

Check the wallet balance, find the best yield, and deposit.

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Project0Client, getConfig, MarginRequirementType } from "@0dotxyz/p0-ts-sdk";

// --- 1. Check wallet balance ---
const solBalance = await connection.getBalance(wallet.publicKey);
console.log(`SOL balance: ${solBalance / 1e9}`);

// --- 2. Find the best deposit yield ---
const banksRes = await fetch("https://app.0.xyz/api/banks/db");
const banksData = await banksRes.json();

// Best SOL deposit yield
const solBanks = banksData
  .filter((b) => b.symbol === "SOL")
  .sort((a, b) => b.deposit_rate_pct - a.deposit_rate_pct);
const bestSolBank = solBanks[0];
console.log(`Best SOL yield: ${bestSolBank.deposit_rate_pct.toFixed(2)}% on ${bestSolBank.venue}`);

// --- 3. Initialize P0 client and load/create account ---
const client = await Project0Client.initialize(connection, getConfig("production"));
const addrs = await client.getAccountAddresses(wallet.publicKey);
let wrappedAccount;
if (addrs.length > 0) {
  wrappedAccount = await client.fetchAccount(addrs[0]!);
} else {
  const createTx = await client.createMarginfiAccountTx(wallet.publicKey, 0);
  createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  createTx.feePayer = wallet.publicKey;
  createTx.sign(wallet);
  await connection.sendRawTransaction(createTx.serialize());
  const created = await client.getAccountAddresses(wallet.publicKey);
  wrappedAccount = await client.fetchAccount(created[0]!);
}

// --- 4. Deposit SOL (leave some for tx fees) ---
const depositAmount = ((solBalance / 1e9) - 0.01).toFixed(4); // keep 0.01 SOL for fees
const bankAddress = new PublicKey(bestSolBank.bank_address);

const depositTx = await wrappedAccount.makeDepositTx(bankAddress, depositAmount);
depositTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
depositTx.feePayer = wallet.publicKey;
depositTx.sign(wallet);
const sig = await connection.sendRawTransaction(depositTx.serialize());
await connection.confirmTransaction(sig, "confirmed");
console.log(`Deposited ${depositAmount} SOL: https://solscan.io/tx/${sig}`);
```

### Example B: SOL/LST rate-arb loop (for SOL holders)

Find the best SOL/LST strategy, swap SOL into the deposit token if needed,
then execute a leveraged loop. You only need the deposit token in your wallet.

```typescript
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Project0Client, getConfig, MarginRequirementType } from "@0dotxyz/p0-ts-sdk";

// --- 1. Check wallet balance ---
const solBalance = await connection.getBalance(wallet.publicKey);
console.log(`SOL balance: ${solBalance / 1e9}`);

// --- 2. Find the best SOL/LST strategy ---
const [strategiesRes, banksRes] = await Promise.all([
  fetch("https://app.0.xyz/api/strategies"),
  fetch("https://app.0.xyz/api/banks/db"),
]);
const { data } = await strategiesRes.json();
const strategies = data.strategies || [];
const banksData = await banksRes.json();
const bankInfoByAddress = Object.fromEntries(
  banksData.map((b) => [b.bank_address, b])
);

const solLstArbs = strategies
  .filter((s) => s.type === "rate-arb")
  .filter((s) => s.assetGroups?.includes("sol-lst"))
  .sort((a, b) => (b.apy || 0) - (a.apy || 0));

const best = solLstArbs[0];
const depositInfo = bankInfoByAddress[best.primaryBankAddress];
const borrowInfo = bankInfoByAddress[best.secondaryBankAddress];
console.log(`Strategy: ${best.heading} at ${(best.apy * 100).toFixed(2)}% APY`);
console.log(`Deposit: ${depositInfo.symbol} (${depositInfo.venue})`);
console.log(`Borrow: ${borrowInfo.symbol} (${borrowInfo.venue})`);

// --- 3. Swap SOL into the deposit token if needed ---
// You only need the deposit token in your wallet. If the strategy deposits
// e.g. JitoSOL, swap your SOL into JitoSOL first.
if (depositInfo.mint !== "So11111111111111111111111111111111111111112") {
  const swapAmountLamports = Math.floor((solBalance - 10000000) * 0.9); // keep SOL for fees
  const quoteResponse = await (
    await fetch(
      `https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112` +
      `&outputMint=${depositInfo.mint}` +
      `&amount=${swapAmountLamports}` +
      `&slippageBps=50` +
      `&restrictIntermediateTokens=true`
    )
  ).json();

  const swapResponse = await (
    await fetch("https://api.jup.ag/swap/v1/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const swapTx = VersionedTransaction.deserialize(
    Buffer.from(swapResponse.swapTransaction, "base64")
  );
  swapTx.sign([wallet]);
  const sig = await connection.sendRawTransaction(swapTx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`Swapped SOL -> ${depositInfo.symbol}: https://solscan.io/tx/${sig}`);
}

// --- 4. Initialize P0 client and load account ---
const client = await Project0Client.initialize(connection, getConfig("production"));
const addrs = await client.getAccountAddresses(wallet.publicKey);
let wrappedAccount;
if (addrs.length > 0) {
  wrappedAccount = await client.fetchAccount(addrs[0]!);
} else {
  const createTx = await client.createMarginfiAccountTx(wallet.publicKey, 0);
  createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  createTx.feePayer = wallet.publicKey;
  createTx.sign(wallet);
  await connection.sendRawTransaction(createTx.serialize());
  const created = await client.getAccountAddresses(wallet.publicKey);
  wrappedAccount = await client.fetchAccount(created[0]!);
}

// --- 5. Execute the loop ---
// Do NOT deposit first. The loop handles deposit internally via flash loan.
const depositBank = client.getBank(new PublicKey(best.primaryBankAddress))!;
const borrowBank = client.getBank(new PublicKey(best.secondaryBankAddress))!;
const depositMintData = client.mintDataByBank.get(depositBank.address.toBase58())!;
const borrowMintData = client.mintDataByBank.get(borrowBank.address.toBase58())!;

// Determine how much of the deposit token is in the wallet
let depositAmount: number;
if (depositInfo.mint === "So11111111111111111111111111111111111111112") {
  const currentSol = await connection.getBalance(wallet.publicKey);
  depositAmount = (currentSol / 1e9) - 0.01; // keep some for fees
} else {
  const ata = PublicKey.findProgramAddressSync(
    [
      wallet.publicKey.toBytes(),
      new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBytes(),
      new PublicKey(depositInfo.mint).toBytes(),
    ],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  )[0];
  const tokenBalance = await connection.getTokenAccountBalance(ata);
  depositAmount = Number(tokenBalance.value.uiAmount);
}

// Borrow amount determines leverage (borrowAmount ~= depositAmount for 2x)
const borrowAmount = depositAmount;

const loopResult = await wrappedAccount.makeLoopTx({
  connection,
  assetShareValueMultiplierByBank: client.assetShareValueMultiplierByBank,
  depositOpts: {
    inputDepositAmount: depositAmount,
    depositBank,
    tokenProgram: depositMintData.tokenProgram,
    loopMode: "DEPOSIT",
  },
  borrowOpts: {
    borrowAmount,
    borrowBank,
    tokenProgram: borrowMintData.tokenProgram,
  },
  swapOpts: {
    jupiterOptions: {
      slippageMode: "DYNAMIC",
      slippageBps: 50,
      platformFeeBps: 0,
    },
  },
});

for (const tx of loopResult.transactions) {
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`Loop tx: https://solscan.io/tx/${sig}`);
}

// --- 6. Check portfolio and account health ---
wrappedAccount = await client.fetchAccount(addrs[0]!);

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

const accountValue = wrappedAccount.computeAccountValue();
const health = wrappedAccount.computeHealthComponentsFromCache(
  MarginRequirementType.Maintenance,
);
const healthFactor = health.assets.dividedBy(health.liabilities).toNumber();
const netApy = wrappedAccount.computeNetApy();
console.log(`Account value: $${accountValue.toFixed(2)}`);
console.log(`Health factor: ${healthFactor.toFixed(2)}`);
console.log(`Net APY: ${(netApy * 100).toFixed(2)}%`);
```

### Example C: Stablecoin rate-arb loop (for USDC/USDT holders)

Same pattern but for stablecoin holders. Stablecoin-to-stablecoin loops often
have the same mint on both sides, so no Jupiter swap is needed.

```typescript
// --- 1. Find the best stablecoin strategy ---
const stableArbs = strategies
  .filter((s) => s.type === "rate-arb")
  .filter((s) => s.assetGroups?.includes("stablecoins"))
  .sort((a, b) => (b.apy || 0) - (a.apy || 0));

const best = stableArbs[0];
const depositInfo = bankInfoByAddress[best.primaryBankAddress];
const borrowInfo = bankInfoByAddress[best.secondaryBankAddress];
console.log(`Strategy: ${best.heading} at ${(best.apy * 100).toFixed(2)}% APY`);
// e.g. "USDC (P0) / USDC (Kamino)" -- same mint, no Jupiter needed

// --- 2. Swap into the deposit token if wallet holds the wrong stablecoin ---
// If you hold USDT but the strategy needs USDC, swap first via Jupiter
// (see Swapping Tokens via Jupiter section). If you already hold the right
// token, skip this step.

// --- 3. Execute the loop (same pattern as Example B step 5) ---
const depositBank = client.getBank(new PublicKey(best.primaryBankAddress))!;
const borrowBank = client.getBank(new PublicKey(best.secondaryBankAddress))!;
const depositMintData = client.mintDataByBank.get(depositBank.address.toBase58())!;
const borrowMintData = client.mintDataByBank.get(borrowBank.address.toBase58())!;

const depositAmount = 100; // 100 USDC
const borrowAmount = 100;  // 2x leverage

const loopResult = await wrappedAccount.makeLoopTx({
  connection,
  assetShareValueMultiplierByBank: client.assetShareValueMultiplierByBank,
  depositOpts: {
    inputDepositAmount: depositAmount,
    depositBank,
    tokenProgram: depositMintData.tokenProgram,
    loopMode: "DEPOSIT",
  },
  borrowOpts: {
    borrowAmount,
    borrowBank,
    tokenProgram: borrowMintData.tokenProgram,
  },
  swapOpts: {
    jupiterOptions: {
      slippageMode: "DYNAMIC",
      slippageBps: 50,
      platformFeeBps: 0,
    },
  },
});

for (const tx of loopResult.transactions) {
  tx.sign([wallet]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`Loop tx: https://solscan.io/tx/${sig}`);
}

// --- 4. Check portfolio (same as Example B step 6) ---
```

---

## Error Reference

| Error                          | Cause                                  | Resolution                                              |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| `Bank not found`               | No bank for the given address          | Verify bank address from banks API                      |
| `Insufficient free collateral` | Not enough collateral to borrow        | Deposit more or borrow less                             |
| `assetTagMismatch` (6047)      | Incompatible asset types in account    | Use separate accounts for DEFAULT vs STAKED positions   |
| `Simulation failed`            | Transaction would fail on-chain        | Check logs -- often stale oracle or insufficient balance |
| `Transaction expired`          | Blockhash expired before confirmation  | Retry with fresh blockhash                              |
| `Account not found`            | P0 account address does not exist      | Verify address or create a new account                  |
| `simulateBundle not supported` | RPC lacks bundle simulation            | Use paid RPC (Helius, Triton) or simulate individually  |
