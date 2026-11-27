import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  creditLedger,
  customers,
  processedEvents,
  products,
  saleItems,
  sales,
  shops,
} from "@/db/schema";
import type { LedgerAddPayload, SaleEventPayload, SyncEvent } from "@/server/domain/events";

export class DomainError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ISyncRepository {
  applyEvent(shopId: string, event: SyncEvent): Promise<"applied" | "duplicate">;
  snapshot(shopId: string): Promise<Snapshot>;
}

export interface Snapshot {
  customers: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  sales: Array<Record<string, unknown>>;
  saleItems: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
}

export async function createShop(id: string, name: string, apiKeyHash: string): Promise<boolean> {
  const rows = await db
    .insert(shops)
    .values({ id, name, apiKeyHash })
    .onConflictDoNothing()
    .returning({ id: shops.id });
  if (rows.length > 0) {
    await db.insert(auditLog).values({ shopId: id, action: "shop.register", entity: "shop", entityId: id });
  }
  return rows.length > 0;
}

export class PgSyncRepository implements ISyncRepository {
  async applyEvent(shopId: string, ev: SyncEvent): Promise<"applied" | "duplicate"> {
    return db.transaction(async (tx) => {
      const claimed = await tx
        .insert(processedEvents)
        .values({ shopId, eventId: ev.id, eventType: ev.type })
        .onConflictDoNothing()
        .returning({ id: processedEvents.eventId });
      if (claimed.length === 0) return "duplicate";

      switch (ev.type) {
        case "customer.upsert":
          await this.upsertCustomer(tx, shopId, ev.payload);
          break;
        case "product.upsert":
          await this.upsertProduct(tx, shopId, ev.payload);
          break;
        case "sale.create":
          await this.createSale(tx, shopId, ev.payload);
          break;
        case "ledger.add":
          await this.addLedger(tx, shopId, ev.payload);
          break;
      }

      await tx.insert(auditLog).values({
        shopId,
        action: ev.type,
        entity: ev.type.split(".")[0],
        entityId: ev.type === "sale.create" ? ev.payload.sale.id : (ev.payload as { id: string }).id,
      });
      return "applied";
    });
  }

  private async upsertCustomer(
    tx: Tx,
    shopId: string,
    p: Extract<SyncEvent, { type: "customer.upsert" }>["payload"],
  ) {
    const rows = await tx
      .insert(customers)
      .values({ ...p, shopId, createdAt: new Date(p.createdAt) })
      .onConflictDoUpdate({
        target: customers.id,
        set: { code: p.code, name: p.name, phone: p.phone, isActive: p.isActive, updatedAt: new Date() },
        setWhere: eq(customers.shopId, shopId),
      })
      .returning({ id: customers.id });
    if (rows.length === 0) throw new DomainError("Customer id belongs to another shop");
  }

  private async upsertProduct(
    tx: Tx,
    shopId: string,
    p: Extract<SyncEvent, { type: "product.upsert" }>["payload"],
  ) {
    const rows = await tx
      .insert(products)
      .values({ ...p, shopId, createdAt: new Date(p.createdAt) })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: p.name,
          unit: p.unit,
          priceCents: p.priceCents,
          costCents: p.costCents,
          barcode: p.barcode,
          isActive: p.isActive,
          updatedAt: new Date(),
        },
        setWhere: eq(products.shopId, shopId),
      })
      .returning({ id: products.id });
    if (rows.length === 0) throw new DomainError("Product id belongs to another shop");
  }

  private async createSale(tx: Tx, shopId: string, p: SaleEventPayload) {
    const { sale, items, ledger } = p;
    if (sale.customerId) {
      const [c] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, sale.customerId), eq(customers.shopId, shopId)));
      if (!c) throw new DomainError("Unknown customer – sync the customer first");
    }
    const productIds = [...new Set(items.map((i) => i.productId))];
    const found = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.shopId, shopId), inArray(products.id, productIds)));
    if (found.length !== productIds.length) throw new DomainError("Unknown product – sync the item first");

    await tx.insert(sales).values({ ...sale, shopId, createdAt: new Date(sale.createdAt) });
    await tx.insert(saleItems).values(items.map((i) => ({ ...i, saleId: sale.id })));
    if (sale.customerId && ledger.length > 0) {
      await tx.insert(creditLedger).values(
        ledger.map((l) => ({
          id: l.id,
          shopId,
          customerId: sale.customerId as string,
          entryType: l.entryType,
          amountCents: l.amountCents,
          saleId: sale.id,
          reversesEntryId: null,
          note: l.note,
          createdBy: sale.cashierName,
          createdAt: new Date(l.createdAt),
        })),
      );
    }
  }

  private async addLedger(tx: Tx, shopId: string, p: LedgerAddPayload) {
    const [c] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, p.customerId), eq(customers.shopId, shopId)));
    if (!c) throw new DomainError("Unknown customer – sync the customer first");

    if (p.entryType === "REVERSAL") {
      if (!p.reversesEntryId) throw new DomainError("Reversal must reference an entry");
      const [orig] = await tx
        .select()
        .from(creditLedger)
        .where(
          and(
            eq(creditLedger.id, p.reversesEntryId),
            eq(creditLedger.shopId, shopId),
            eq(creditLedger.customerId, p.customerId),
          ),
        );
      if (!orig) throw new DomainError("Entry to reverse was not found");
      if (orig.entryType === "REVERSAL") throw new DomainError("A reversal cannot be reversed");
      if (orig.amountCents !== -p.amountCents) throw new DomainError("Reversal amount must mirror the original");
    }
    await tx.insert(creditLedger).values({
      id: p.id,
      shopId,
      customerId: p.customerId,
      entryType: p.entryType,
      amountCents: p.amountCents,
      saleId: null,
      reversesEntryId: p.entryType === "REVERSAL" ? p.reversesEntryId : null,
      note: p.note,
      createdBy: p.createdBy,
      createdAt: new Date(p.createdAt),
    });
  }

  async snapshot(shopId: string): Promise<Snapshot> {
    const strip = <T extends { shopId?: unknown }>(rows: T[]) =>
      rows.map((r) => {
        const { shopId: _omit, ...rest } = r;
        void _omit;
        return rest as Record<string, unknown>;
      });
    const saleRows = await db.select().from(sales).where(eq(sales.shopId, shopId));
    const saleIds = saleRows.map((s) => s.id);
    const itemRows = saleIds.length
      ? await db.select().from(saleItems).where(inArray(saleItems.saleId, saleIds))
      : [];
    return {
      customers: strip(await db.select().from(customers).where(eq(customers.shopId, shopId))),
      products: strip(await db.select().from(products).where(eq(products.shopId, shopId))),
      sales: strip(saleRows),
      saleItems: itemRows as unknown as Array<Record<string, unknown>>,
      ledger: strip(await db.select().from(creditLedger).where(eq(creditLedger.shopId, shopId))),
    };
  }
}
