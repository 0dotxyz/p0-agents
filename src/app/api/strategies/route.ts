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

    const { data } = await response.json();

    return NextResponse.json(data.strategies, {
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
