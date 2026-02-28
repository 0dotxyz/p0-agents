import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

const UPSTREAM_BASE = "https://app.0.xyz/api/user/wallet";
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface UpstreamItem {
  address: string;
  decimals: number;
  price: number;
  balance: string;
  amount: number;
  network: string;
  name: string;
  symbol: string;
  logo_uri: string;
  value: string;
}

interface UpstreamResponse {
  success: boolean;
  data: {
    wallet_address: string;
    total_value: string;
    items: UpstreamItem[];
  };
}

interface AgentToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  usd_price: number;
  usd_value: number;
}

function transformItem(item: UpstreamItem): AgentToken {
  return {
    address: item.address,
    symbol: item.symbol,
    name: item.name,
    decimals: item.decimals,
    balance: item.amount,
    usd_price: item.price,
    usd_value: parseFloat(item.value) || 0,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params;

    if (!address || !BASE58_RE.test(address)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 },
      );
    }

    const response = await fetch(`${UPSTREAM_BASE}/${address}`, {
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch wallet data" },
        { status: 502 },
      );
    }

    const body: UpstreamResponse = await response.json();

    if (!body.success || !body.data?.items) {
      return NextResponse.json(
        { error: "Unexpected upstream format" },
        { status: 502 },
      );
    }

    const tokens = body.data.items
      .filter((item) => item.amount > 0)
      .map(transformItem);

    return NextResponse.json(
      {
        wallet: body.data.wallet_address,
        total_usd_value: parseFloat(body.data.total_value) || 0,
        tokens,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
