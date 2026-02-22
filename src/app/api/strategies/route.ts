import { NextResponse } from "next/server";

const UPSTREAM_URL = "https://app.0.xyz/api/strategies";

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
    const strategies = body?.data?.strategies;

    if (!Array.isArray(strategies)) {
      return NextResponse.json(
        { error: "Unexpected upstream format" },
        { status: 502 },
      );
    }

    return NextResponse.json(strategies, {
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
