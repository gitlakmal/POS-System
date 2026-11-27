import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Naya Potha – cloud side schema (Third Normal Form).
 *  - Every money column is INTEGER CENTS (bigint). Never floats.
 *  - Primary keys are client generated UUIDs so the shop PC can create rows offline.
 *  - credit_ledger is APPEND-ONLY. Mistakes are fixed with ADJUSTMENT / REVERSAL rows.
 *  - processed_events stores idempotency keys so a re-sent sync batch can never double count.
 */
const cents = (name: string) => bigint(name, { mode: "number" });
const stamp = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const ledgerEntryType = pgEnum("ledger_entry_type", [
  "SALE",
  "PAYMENT",
  "ADJUSTMENT",
  "REVERSAL",
]);

export const shops = pgTable("shops", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  apiKeyHash: text("api_key_hash").notNull(), // sha256 of device key – raw key is never stored
  createdAt: stamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey(),
    shopId: uuid("shop_id").notNull().references(() => shops.id),
    code: integer("code").notNull(), // 4+ digit customer ID printed on the QR card
    name: text("name").notNull(),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: stamp("created_at").notNull(),
    updatedAt: stamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("customers_shop_code_uq").on(t.shopId, t.code)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey(),
    shopId: uuid("shop_id").notNull().references(() => shops.id),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    priceCents: cents("price_cents").notNull(),
    costCents: cents("cost_cents").notNull(),
    barcode: text("barcode"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: stamp("created_at").notNull(),
    updatedAt: stamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("products_shop_idx").on(t.shopId)],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey(),
    shopId: uuid("shop_id").notNull().references(() => shops.id),
    customerId: uuid("customer_id").references(() => customers.id), // null = anonymous cash sale
    billNo: integer("bill_no").notNull(),
    totalCents: cents("total_cents").notNull(),
    paidCents: cents("paid_cents").notNull(),
    prevBalanceCents: cents("prev_balance_cents").notNull(), // receipt snapshot
    cashierName: text("cashier_name").notNull(),
    createdAt: stamp("created_at").notNull(), // device clock
    receivedAt: stamp("received_at").notNull().defaultNow(), // server clock (tamper evidence)
  },
  (t) => [
    unique("sales_shop_bill_uq").on(t.shopId, t.billNo),
    index("sales_customer_idx").on(t.customerId),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey(),
    saleId: uuid("sale_id").notNull().references(() => sales.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    qtyMilli: integer("qty_milli").notNull(), // 1000 = 1 unit, allows 0.250 kg
    unitPriceCents: cents("unit_price_cents").notNull(), // price at time of sale
    unitCostCents: cents("unit_cost_cents").notNull(),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId)],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey(),
    shopId: uuid("shop_id").notNull().references(() => shops.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    entryType: ledgerEntryType("entry_type").notNull(),
    amountCents: cents("amount_cents").notNull(), // signed: + customer owes more, - customer paid
    saleId: uuid("sale_id").references(() => sales.id),
    reversesEntryId: uuid("reverses_entry_id"),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: stamp("created_at").notNull(),
    receivedAt: stamp("received_at").notNull().defaultNow(),
  },
  (t) => [
    index("ledger_customer_idx").on(t.customerId, t.createdAt),
    unique("ledger_reverses_uq").on(t.reversesEntryId), // an entry can be reversed only once
  ],
);

export const processedEvents = pgTable(
  "processed_events",
  {
    shopId: uuid("shop_id").notNull().references(() => shops.id),
    eventId: uuid("event_id").notNull(),
    eventType: text("event_type").notNull(),
    receivedAt: stamp("received_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.eventId] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    shopId: uuid("shop_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    detail: jsonb("detail"),
    createdAt: stamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_shop_idx").on(t.shopId, t.createdAt)],
);
