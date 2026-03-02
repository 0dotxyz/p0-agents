import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

let ratelimitInstance: import("@upstash/ratelimit").Ratelimit | null = null;

async function getRatelimit() {
  if (ratelimitInstance) return ratelimitInstance;

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });

  ratelimitInstance = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    analytics: true,
  });

  return ratelimitInstance;
}

export async function middleware(request: NextRequest) {
  /* Only rate-limit API routes */
  if (!request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  /* Skip rate limiting when Redis is not configured (local dev) */
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.next();
  }

  const ratelimit = await getRatelimit();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "127.0.0.1";

  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(reset),
        },
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(reset));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
