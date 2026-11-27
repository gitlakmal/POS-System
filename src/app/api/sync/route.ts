import { handleError, HttpError, rateLimit, requireShop } from "@/server/http";
import { syncRequestSchema } from "@/server/domain/events";
import { syncService } from "@/server/services/syncService";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const shop = await requireShop(req);
    rateLimit(`sync:${shop.id}`, 60, 60 * 1000);
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > 2_000_000) throw new HttpError(413, "Batch too large");
    const body = syncRequestSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Invalid request");
    const results = await syncService.applyBatch(shop.id, shop.name, body.data.events);
    return Response.json({ results });
  } catch (e) {
    return handleError(e);
  }
}
