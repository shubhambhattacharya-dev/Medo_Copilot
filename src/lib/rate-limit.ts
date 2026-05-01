import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

let sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!process.env.DATABASE_URL) return null;
  sql ??= neon(process.env.DATABASE_URL);
  return sql;
}

async function ensureRateLimitTable() {
  const db = getSql();
  if (!db) return null;
  
  await db`
    CREATE TABLE IF NOT EXISTS rate_limits (
      ip text PRIMARY KEY,
      count integer NOT NULL DEFAULT 1,
      reset_time bigint NOT NULL
    )
  `;
  
  return db;
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimitAsync(
  request: NextRequest,
  config: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 5 }
): Promise<{ success: boolean; remaining: number; resetIn: number }> {
  const ip = getClientIP(request);
  const now = Date.now();
  const db = await ensureRateLimitTable();

  if (!db) {
    return { success: true, remaining: config.maxRequests, resetIn: config.windowMs };
  }

  // Atomic upsert: handles race conditions by using INSERT...ON CONFLICT
  const result = await db`
    WITH upsert AS (
      INSERT INTO rate_limits (ip, count, reset_time)
      VALUES (${ip}, 1, ${now + config.windowMs})
      ON CONFLICT (ip) DO UPDATE SET
        count = CASE
          WHEN rate_limits.reset_time < ${now} THEN 1
          ELSE rate_limits.count + 1
        END,
        reset_time = CASE
          WHEN rate_limits.reset_time < ${now} THEN ${now + config.windowMs}
          ELSE rate_limits.reset_time
        END
      RETURNING count, reset_time
    )
    SELECT count, reset_time FROM upsert
  ` as Array<{ count: number; reset_time: bigint }>;

  const row = result[0];
  const resetTime = Number(row.reset_time);

  if (row.count > config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetIn: resetTime - now,
    };
  }

  return {
    success: true,
    remaining: config.maxRequests - row.count,
    resetIn: resetTime - now,
  };
}

export function rateLimitResponse(retryAfter: number): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: "Too many requests. Please slow down.",
      retryAfter: Math.ceil(retryAfter / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(retryAfter / 1000)),
      },
    }
  );
}

export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 5 }
): { success: boolean; remaining: number; resetIn: number } | null {
  return { success: true, remaining: config.maxRequests, resetIn: config.windowMs };
}