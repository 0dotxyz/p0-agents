import { NextResponse } from "next/server";

const UPSTREAM_URL = "https://app.0.xyz/api/strategies";
const TOP_N = 3;
const EXCLUDED_TYPES = new Set(["directional"]);
const PICKED_FIELDS = [
  "heading",
  "primaryBankAddress",
  "secondaryBankAddress",
  "spread",
  "leverage",
  "apy",
] as const;

interface UpstreamStrategy {
  type?: string;
  heading?: string;
  primaryBankAddress?: string;
  secondaryBankAddress?: string;
  spread?: number;
  leverage?: number;
  apy?: number;
}

export async function GET() {
  try {
    const response = await fetch(UPSTREAM_URL, {
      next: { revalidate: 120 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch strategies" },
        { status: 502 },
      );
    }

    const body = await response.json();
    const strategies: UpstreamStrategy[] = body?.data?.strategies;

    if (!Array.isArray(strategies)) {
      return NextResponse.json(
        { error: "Unexpected upstream format" },
        { status: 502 },
      );
    }

    /* Group by type, exclude directional */
    const byType = new Map<string, UpstreamStrategy[]>();
    for (const s of strategies) {
      const type = s.type ?? "unknown";
      if (EXCLUDED_TYPES.has(type)) continue;
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(s);
    }

    /* Take top N per type by APY, strip to picked fields */
    const result: Record<string, unknown>[] = [];
    for (const items of byType.values()) {
      items.sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0));
      for (const s of items.slice(0, TOP_N)) {
        const picked: Record<string, unknown> = {};
        for (const f of PICKED_FIELDS) {
          picked[f] = s[f] ?? null;
        }
        result.push(picked);
      }
    }

    /* Sort final list by APY descending */
    result.sort((a, b) => ((b.apy as number) ?? 0) - ((a.apy as number) ?? 0));

    return NextResponse.json(result, {
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
