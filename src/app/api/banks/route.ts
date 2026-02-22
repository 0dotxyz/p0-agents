import { NextResponse } from "next/server";

const UPSTREAM_URL = "https://app.0.xyz/api/banks/db";
const RISK_TIER_COLLATERAL = 0;

interface UpstreamBank {
  bank_address: string;
  symbol: string;
  mint: string;
  mint_decimals: number;
  venue: string;
  risk_tier: number;
  deposit_rate_pct: number;
  borrow_rate_pct: number;
  usd_price: number;
  token_program_address: string;
  max_mint_apy: number | null;
}

interface AgentBank {
  bank_address: string;
  symbol: string;
  mint: string;
  mint_decimals: number;
  venue: string;
  deposit_apy: number;
  borrow_apy: number;
  usd_price: number;
  token_program: string;
}

function computeDepositApy(bank: UpstreamBank): number {
  const baseRate = bank.deposit_rate_pct ?? 0;
  const mintApy = bank.max_mint_apy ?? 0;
  return baseRate + mintApy * 100;
}

function transformBank(bank: UpstreamBank): AgentBank {
  return {
    bank_address: bank.bank_address,
    symbol: bank.symbol,
    mint: bank.mint,
    mint_decimals: bank.mint_decimals,
    venue: bank.venue,
    deposit_apy: Math.round(computeDepositApy(bank) * 1000) / 1000,
    borrow_apy: Math.round((bank.borrow_rate_pct ?? 0) * 1000) / 1000,
    usd_price: bank.usd_price,
    token_program: bank.token_program_address,
  };
}

export async function GET() {
  try {
    const response = await fetch(UPSTREAM_URL, {
      next: { revalidate: 120 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch bank data" },
        { status: 502 },
      );
    }

    const body = await response.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Unexpected upstream format" },
        { status: 502 },
      );
    }

    const agentBanks = (body as UpstreamBank[])
      .filter((b) => b.risk_tier === RISK_TIER_COLLATERAL)
      .map(transformBank);

    return NextResponse.json(agentBanks, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
