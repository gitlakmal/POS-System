export type Lang = "si" | "en";

export interface Customer {
  id: string;
  code: number;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  priceCents: number;
  costCents: number;
  barcode: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  name: string; // local-only convenience for receipts
  qtyMilli: number;
  unitPriceCents: number;
  unitCostCents: number;
}

export interface Sale {
  id: string;
  customerId: string | null;
  billNo: number;
  totalCents: number;
  paidCents: number;
  prevBalanceCents: number;
  cashierName: string;
  createdAt: string;
  items: SaleItem[];
}

export type LedgerType = "SALE" | "PAYMENT" | "ADJUSTMENT" | "REVERSAL";

export interface LedgerEntry {
  id: string;
  customerId: string;
  entryType: LedgerType;
  amountCents: number; // + owes more, - paid
  saleId: string | null;
  reversesEntryId: string | null;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface OutboxEvent {
  id: string;
  type: "customer.upsert" | "product.upsert" | "sale.create" | "ledger.add";
  payload: unknown;
  createdAt: string;
  error?: string;
}

export interface ShopInfo {
  id: string;
  name: string;
  cashier: string;
  apiKey?: string;
}

export interface LocalState {
  version: 1;
  shop: ShopInfo | null;
  lang: Lang;
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  ledger: LedgerEntry[];
  outbox: OutboxEvent[];
  nextBillNo: number;
  lastSyncAt: string | null;
}

export const emptyState = (): LocalState => ({
  version: 1,
  shop: null,
  lang: "si",
  customers: [],
  products: [],
  sales: [],
  ledger: [],
  outbox: [],
  nextBillNo: 1,
  lastSyncAt: null,
});
