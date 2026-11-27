import { z } from "zod";

/** Wire contract between the offline shop app and the cloud. All money = integer cents. */
const uuid = z.string().uuid();
const iso = z.string().datetime({ offset: true });
const positiveCents = z.number().int().min(1).max(100_000_000_000);
const nonNegCents = z.number().int().min(0).max(100_000_000_000);
const signedCents = z.number().int().min(-100_000_000_000).max(100_000_000_000);
const shortText = (max: number) => z.string().trim().min(1).max(max);

export const customerPayload = z.object({
  id: uuid,
  code: z.number().int().min(1000).max(99_999_999),
  name: shortText(80),
  phone: z.string().trim().max(20).nullable(),
  isActive: z.boolean(),
  createdAt: iso,
});

export const productPayload = z.object({
  id: uuid,
  name: shortText(120),
  unit: shortText(12),
  priceCents: nonNegCents,
  costCents: nonNegCents,
  barcode: z.string().trim().max(40).nullable(),
  isActive: z.boolean(),
  createdAt: iso,
});

export const salePayload = z.object({
  sale: z.object({
    id: uuid,
    customerId: uuid.nullable(),
    billNo: z.number().int().min(1),
    totalCents: positiveCents,
    paidCents: nonNegCents,
    prevBalanceCents: signedCents,
    cashierName: shortText(60),
    createdAt: iso,
  }),
  items: z
    .array(
      z.object({
        id: uuid,
        productId: uuid,
        qtyMilli: z.number().int().min(1).max(10_000_000),
        unitPriceCents: nonNegCents,
        unitCostCents: nonNegCents,
      }),
    )
    .min(1)
    .max(200),
  ledger: z
    .array(
      z.object({
        id: uuid,
        entryType: z.enum(["SALE", "PAYMENT"]),
        amountCents: signedCents,
        note: z.string().max(200),
        createdAt: iso,
      }),
    )
    .max(2),
});

export const ledgerAddPayload = z.object({
  id: uuid,
  customerId: uuid,
  entryType: z.enum(["PAYMENT", "ADJUSTMENT", "REVERSAL"]),
  amountCents: signedCents,
  reversesEntryId: uuid.nullable(),
  note: z.string().trim().max(200),
  createdBy: shortText(60),
  createdAt: iso,
});

export const eventSchema = z.discriminatedUnion("type", [
  z.object({ id: uuid, type: z.literal("customer.upsert"), payload: customerPayload }),
  z.object({ id: uuid, type: z.literal("product.upsert"), payload: productPayload }),
  z.object({ id: uuid, type: z.literal("sale.create"), payload: salePayload }),
  z.object({ id: uuid, type: z.literal("ledger.add"), payload: ledgerAddPayload }),
]);

export type SyncEvent = z.infer<typeof eventSchema>;
export type SaleEventPayload = z.infer<typeof salePayload>;
export type LedgerAddPayload = z.infer<typeof ledgerAddPayload>;

export const syncRequestSchema = z.object({ events: z.array(z.unknown()).max(200) });

export const registerSchema = z.object({
  shopId: uuid,
  name: shortText(80),
  registrationCode: z.string().max(100).optional(),
});

export type EventResult = {
  id: string | null;
  status: "applied" | "duplicate" | "rejected";
  error?: string;
};
