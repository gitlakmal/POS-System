import { eventSchema, type EventResult, type SyncEvent } from "@/server/domain/events";
import { configuredProviders, type ISyncProvider } from "@/server/adapters/syncProvider";
import {
  DomainError,
  PgSyncRepository,
  type ISyncRepository,
  type Snapshot,
} from "@/server/repositories/syncRepository";

function lineTotal(qtyMilli: number, priceCents: number): number {
  return Math.round((qtyMilli * priceCents) / 1000);
}

/** Business rules that must hold before anything touches the ledger. */
export function validateEvent(ev: SyncEvent): void {
  if (ev.type === "sale.create") {
    const { sale, items, ledger } = ev.payload;
    const total = items.reduce((s, i) => s + lineTotal(i.qtyMilli, i.unitPriceCents), 0);
    if (total !== sale.totalCents) throw new DomainError("Bill total does not match its items");
    if (!sale.customerId) {
      if (sale.paidCents !== sale.totalCents) throw new DomainError("Anonymous sale must be fully paid");
      if (ledger.length !== 0) throw new DomainError("Anonymous sale cannot touch the credit book");
      return;
    }
    if (sale.paidCents > sale.totalCents + Math.max(sale.prevBalanceCents, 0)) {
      throw new DomainError("Paid amount exceeds what is owed");
    }
    const saleRows = ledger.filter((l) => l.entryType === "SALE");
    const payRows = ledger.filter((l) => l.entryType === "PAYMENT");
    if (saleRows.length !== 1 || saleRows[0].amountCents !== sale.totalCents) {
      throw new DomainError("Ledger SALE row must equal bill total");
    }
    if (sale.paidCents > 0) {
      if (payRows.length !== 1 || payRows[0].amountCents !== -sale.paidCents) {
        throw new DomainError("Ledger PAYMENT row must equal paid amount");
      }
    } else if (payRows.length !== 0) {
      throw new DomainError("Unexpected PAYMENT row");
    }
  }
  if (ev.type === "ledger.add") {
    const { entryType, amountCents } = ev.payload;
    if (amountCents === 0) throw new DomainError("Amount cannot be zero");
    if (entryType === "PAYMENT" && amountCents > 0) throw new DomainError("Payment must reduce the balance");
  }
}

function describe(e: unknown): string {
  if (e instanceof DomainError) return e.message;
  const code =
    (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  if (code === "23505") return "Conflict: duplicate customer ID, bill number or reversal";
  if (code === "23503") return "Missing related record – sync order problem";
  console.error("[sync] event failed", e);
  return "Could not apply event";
}

export class SyncService {
  constructor(
    private readonly repo: ISyncRepository = new PgSyncRepository(),
    private readonly providers: ISyncProvider[] = configuredProviders(),
  ) {}

  /** Applies events in order. Each event is its own transaction; one bad event never blocks the rest. */
  async applyBatch(shopId: string, shopName: string, raw: unknown[]): Promise<EventResult[]> {
    const results: EventResult[] = [];
    const applied: SyncEvent[] = [];
    for (const item of raw) {
      const parsed = eventSchema.safeParse(item);
      if (!parsed.success) {
        const id = (item as { id?: unknown } | null)?.id;
        results.push({ id: typeof id === "string" ? id : null, status: "rejected", error: "Invalid event format" });
        continue;
      }
      const ev = parsed.data;
      try {
        validateEvent(ev);
        const status = await this.repo.applyEvent(shopId, ev);
        results.push({ id: ev.id, status });
        if (status === "applied") applied.push(ev);
      } catch (e) {
        results.push({ id: ev.id, status: "rejected", error: describe(e) });
      }
    }
    // Mirror to secondary providers; failures must never fail the primary sync.
    for (const p of this.providers) {
      p.push(shopId, shopName, applied).catch((e) => console.error(`[sync] ${p.name} mirror failed`, e));
    }
    return results;
  }

  snapshot(shopId: string): Promise<Snapshot> {
    return this.repo.snapshot(shopId);
  }
}

export const syncService = new SyncService();
