import { handleError, rateLimit, requireShop } from "@/server/http";
import { syncService } from "@/server/services/syncService";

export const dynamic = "force-dynamic";

/** Full copy of the shop's data – used to restore a new/broken PC. */
export async function GET(req: Request) {
  try {
    const shop = await requireShop(req);
    rateLimit(`snapshot:${shop.id}`, 10, 60 * 1000);
    return Response.json(await syncService.snapshot(shop.id));
  } catch (e) {
    return handleError(e);
  }
}
