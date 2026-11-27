import type { SyncEvent } from "@/server/domain/events";

/**
 * ISyncProvider – an optional secondary destination that receives every APPLIED event.
 * Postgres is the source of truth; Google Sheets is a human-readable mirror for the shop owner.
 * Swap / add adapters (Supabase, Firebase, Excel e-mail...) without touching services.
 */
export interface ISyncProvider {
  readonly name: string;
  push(shopId: string, shopName: string, events: SyncEvent[]): Promise<void>;
}

/**
 * Pushes events to a Google Apps Script Web App (see docs/apps-script.gs).
 * URL and secret come ONLY from environment variables – never from source code.
 * The Spreadsheet id lives inside Apps Script (PropertiesService), not here.
 */
export class GoogleSheetsSyncAdapter implements ISyncProvider {
  readonly name = "google-sheets";

  constructor(
    private readonly url: string,
    private readonly secret: string,
  ) {}

  async push(shopId: string, shopName: string, events: SyncEvent[]): Promise<void> {
    if (events.length === 0) return;
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ secret: this.secret, shopId, shopName, events }),
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Sheets mirror responded ${res.status}`);
  }
}

export function configuredProviders(): ISyncProvider[] {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEETS_SECRET;
  return url && secret ? [new GoogleSheetsSyncAdapter(url, secret)] : [];
}
