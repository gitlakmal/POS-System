import { createShop } from "@/server/repositories/syncRepository";
import { clientIp, handleError, hashKey, HttpError, newApiKey, rateLimit } from "@/server/http";
import { registerSchema } from "@/server/domain/events";

export const dynamic = "force-dynamic";

/** Registers a shop (first sync). Returns the device API key exactly once. */
export async function POST(req: Request) {
  try {
    rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
    const body = registerSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Invalid request");

    const required = process.env.SHOP_REGISTRATION_CODE;
    if (required && body.data.registrationCode !== required) {
      throw new HttpError(403, "Invalid registration code");
    }
    const apiKey = newApiKey();
    const created = await createShop(body.data.shopId, body.data.name, hashKey(apiKey));
    if (!created) throw new HttpError(409, "This shop is already registered");
    return Response.json({ apiKey }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
