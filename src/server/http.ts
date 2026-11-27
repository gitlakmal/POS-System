import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shops } from "@/db/schema";

/** Small HTTP + security helpers shared by route handlers (the "controller" layer). */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function newApiKey(): string {
  return randomBytes(32).toString("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

const hits = new Map<string, { n: number; reset: number }>();

/** Minimal in-memory fixed-window limiter. Swap for Redis when running >1 instance. */
export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }
    return;
  }
  cur.n += 1;
  if (cur.n > limit) throw new HttpError(429, "Too many requests, try again later");
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Authenticates `x-shop-id` + `Authorization: Bearer <deviceKey>`; returns the shop id. */
export async function requireShop(req: Request): Promise<{ id: string; name: string }> {
  const shopId = req.headers.get("x-shop-id") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!/^[0-9a-f-]{36}$/i.test(shopId) || key.length < 32) throw new HttpError(401, "Unauthorized");
  const [shop] = await db
    .select({ hash: shops.apiKeyHash, name: shops.name })
    .from(shops)
    .where(eq(shops.id, shopId));
  if (!shop || !safeEqualHex(shop.hash, hashKey(key))) throw new HttpError(401, "Unauthorized");
  return { id: shopId, name: shop.name };
}

export function handleError(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error("[api] unexpected error", e);
  return Response.json({ error: "Server error" }, { status: 500 });
}
