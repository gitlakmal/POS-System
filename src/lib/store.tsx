"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { balanceMap } from "./ledger";
import { loadState, saveState } from "./localdb";
import { lineTotal, uuid } from "./money";
import {
  emptyState,
  type Customer,
  type Lang,
  type LedgerEntry,
  type LedgerType,
  type LocalState,
  type OutboxEvent,
  type Product,
  type Sale,
  type SaleItem,
} from "./types";

export interface SyncStatus {
  busy: boolean;
  message: string | null;
  tone: "ok" | "err" | "info";
}

export interface CheckoutInput {
  customerId: string | null;
  lines: Array<{ productId: string; qtyMilli: number; unitPriceCents: number }>;
  paidCents: number;
}

export interface StoreApi {
  state: LocalState;
  balances: Map<string, number>;
  lang: Lang;
  L: (si: string, en: string) => string;
  online: boolean;
  syncStatus: SyncStatus;
  pending: number;
  failed: number;
  setLang: (l: Lang) => void;
  setupShop: (name: string, cashier: string, sample: boolean) => void;
  saveCustomer: (c: { id?: string; code: number; name: string; phone: string }) => string | null;
  saveProduct: (p: {
    id?: string;
    name: string;
    unit: string;
    priceCents: number;
    costCents: number;
    barcode: string;
    isActive: boolean;
  }) => string | null;
  checkout: (input: CheckoutInput) => { sale: Sale } | { error: string };
  addLedger: (customerId: string, type: Exclude<LedgerType, "SALE" | "REVERSAL">, amountCents: number, note: string) => string | null;
  reverseEntry: (entryId: string) => string | null;
  syncNow: (registrationCode?: string) => Promise<void>;
  restore: () => Promise<void>;
  retryFailed: () => void;
  discardEvent: (id: string) => void;
  exportBackup: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

export function useStore(): StoreApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider missing");
  return v;
}

const SAMPLE: Array<[string, string, number, number]> = [
  ["සහල් - නාඩු (Rice)", "kg", 24000, 21000],
  ["සීනි (Sugar)", "kg", 26000, 23500],
  ["පරිප්පු (Dhal)", "kg", 38000, 34000],
  ["පාන් (Bread)", "unit", 15000, 13000],
  ["තේ කොළ 100g (Tea)", "unit", 22000, 19000],
  ["පොල් තෙල් (Coconut oil)", "l", 55000, 50000],
  ["බිත්තර (Egg)", "unit", 3500, 3000],
  ["සබන් (Soap)", "unit", 12000, 10000],
  ["කිරිපිටි 400g (Milk powder)", "unit", 95000, 88000],
  ["වෙනත් බඩු (Other)", "unit", 0, 0],
];

function enqueue(s: LocalState, type: OutboxEvent["type"], payload: unknown): OutboxEvent[] {
  return [...s.outbox, { id: uuid(), type, payload, createdAt: new Date().toISOString() }];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalState | null>(null);
  const stateRef = useRef<LocalState>(emptyState());
  const busyRef = useRef(false);
  const [online, setOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ busy: false, message: null, tone: "info" });

  const update = useCallback((fn: (s: LocalState) => LocalState) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    loadState().then((s) => {
      const loaded = s ?? emptyState();
      stateRef.current = loaded;
      setState(loaded);
    });
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (state) void saveState(state);
  }, [state]);

  const lang = state?.lang ?? "si";
  const L = useCallback((si: string, en: string) => (lang === "si" ? si : en), [lang]);

  const balances = useMemo(() => balanceMap(state?.ledger ?? []), [state?.ledger]);

  const setLang = useCallback((l: Lang) => update((s) => ({ ...s, lang: l })), [update]);

  const setupShop = useCallback(
    (name: string, cashier: string, sample: boolean) => {
      const now = new Date().toISOString();
      update((s) => {
        let next: LocalState = { ...s, shop: { id: uuid(), name, cashier } };
        if (sample && s.products.length === 0) {
          for (const [pname, unit, price, cost] of SAMPLE) {
            const p: Product = {
              id: uuid(),
              name: pname,
              unit,
              priceCents: price,
              costCents: cost,
              barcode: null,
              isActive: true,
              createdAt: now,
            };
            next = { ...next, products: [...next.products, p], outbox: enqueue(next, "product.upsert", p) };
          }
        }
        return next;
      });
    },
    [update],
  );

  const saveCustomer: StoreApi["saveCustomer"] = useCallback(
    (c) => {
      const s = stateRef.current;
      if (!c.name.trim()) return L("නම ඇතුළත් කරන්න", "Enter a name");
      if (!Number.isInteger(c.code) || c.code < 1000 || c.code > 99_999_999)
        return L("ID අංකය ඉලක්කම් 4ක් හෝ වැඩි විය යුතුයි", "ID must have 4 or more digits");
      if (s.customers.some((x) => x.code === c.code && x.id !== c.id))
        return L("මේ ID අංකය දැනටමත් භාවිතයේ ඇත", "This ID is already used");
      const existing = s.customers.find((x) => x.id === c.id);
      const cust: Customer = {
        id: existing?.id ?? uuid(),
        code: c.code,
        name: c.name.trim(),
        phone: c.phone.trim() || null,
        isActive: existing?.isActive ?? true,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      update((st) => ({
        ...st,
        customers: existing ? st.customers.map((x) => (x.id === cust.id ? cust : x)) : [...st.customers, cust],
        outbox: enqueue(st, "customer.upsert", cust),
      }));
      return null;
    },
    [L, update],
  );

  const saveProduct: StoreApi["saveProduct"] = useCallback(
    (p) => {
      if (!p.name.trim()) return L("බඩුවේ නම ඇතුළත් කරන්න", "Enter the item name");
      const existing = stateRef.current.products.find((x) => x.id === p.id);
      const prod: Product = {
        id: existing?.id ?? uuid(),
        name: p.name.trim(),
        unit: p.unit,
        priceCents: p.priceCents,
        costCents: p.costCents,
        barcode: p.barcode.trim() || null,
        isActive: p.isActive,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      update((st) => ({
        ...st,
        products: existing ? st.products.map((x) => (x.id === prod.id ? prod : x)) : [...st.products, prod],
        outbox: enqueue(st, "product.upsert", prod),
      }));
      return null;
    },
    [L, update],
  );

  const checkout: StoreApi["checkout"] = useCallback(
    (input) => {
      const s = stateRef.current;
      if (!s.shop) return { error: "Shop not set up" };
      if (input.lines.length === 0) return { error: L("බිලට බඩු දාන්න", "Add items to the bill") };
      const now = new Date().toISOString();
      const items: SaleItem[] = input.lines.map((l) => {
        const p = s.products.find((x) => x.id === l.productId);
        return {
          id: uuid(),
          productId: l.productId,
          name: p?.name ?? "?",
          qtyMilli: l.qtyMilli,
          unitPriceCents: l.unitPriceCents,
          unitCostCents: p?.costCents ?? 0,
        };
      });
      const total = items.reduce((sum, i) => sum + lineTotal(i.qtyMilli, i.unitPriceCents), 0);
      if (total <= 0) return { error: L("බිලේ වටිනාකම 0 විය නොහැක", "Bill total cannot be zero") };
      const prev = input.customerId ? (balanceMap(s.ledger).get(input.customerId) ?? 0) : 0;
      const paid = input.customerId ? input.paidCents : total;
      if (paid < 0 || paid > total + Math.max(prev, 0))
        return { error: L("ගෙවූ මුදල ගෙවිය යුතු මුදලට වඩා වැඩියි", "Paid is more than owed") };

      const sale: Sale = {
        id: uuid(),
        customerId: input.customerId,
        billNo: s.nextBillNo,
        totalCents: total,
        paidCents: paid,
        prevBalanceCents: prev,
        cashierName: s.shop.cashier,
        createdAt: now,
        items,
      };
      const entries: LedgerEntry[] = [];
      if (input.customerId) {
        entries.push({
          id: uuid(),
          customerId: input.customerId,
          entryType: "SALE",
          amountCents: total,
          saleId: sale.id,
          reversesEntryId: null,
          note: `Bill #${sale.billNo}`,
          createdBy: sale.cashierName,
          createdAt: now,
        });
        if (paid > 0) {
          entries.push({
            id: uuid(),
            customerId: input.customerId,
            entryType: "PAYMENT",
            amountCents: -paid,
            saleId: sale.id,
            reversesEntryId: null,
            note: `Bill #${sale.billNo}`,
            createdBy: sale.cashierName,
            createdAt: new Date(Date.now() + 1).toISOString(),
          });
        }
      }
      const payload = {
        sale: {
          id: sale.id,
          customerId: sale.customerId,
          billNo: sale.billNo,
          totalCents: sale.totalCents,
          paidCents: sale.paidCents,
          prevBalanceCents: sale.prevBalanceCents,
          cashierName: sale.cashierName,
          createdAt: sale.createdAt,
        },
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          qtyMilli: i.qtyMilli,
          unitPriceCents: i.unitPriceCents,
          unitCostCents: i.unitCostCents,
        })),
        ledger: entries.map((e) => ({
          id: e.id,
          entryType: e.entryType,
          amountCents: e.amountCents,
          note: e.note,
          createdAt: e.createdAt,
        })),
      };
      update((st) => ({
        ...st,
        sales: [...st.sales, sale],
        ledger: [...st.ledger, ...entries],
        nextBillNo: st.nextBillNo + 1,
        outbox: enqueue(st, "sale.create", payload),
      }));
      return { sale };
    },
    [L, update],
  );

  const addLedger: StoreApi["addLedger"] = useCallback(
    (customerId, type, amountCents, note) => {
      const s = stateRef.current;
      if (!s.shop) return "Shop not set up";
      if (amountCents === 0) return L("මුදල ඇතුළත් කරන්න", "Enter an amount");
      if (type === "PAYMENT") {
        const bal = balanceMap(s.ledger).get(customerId) ?? 0;
        if (amountCents > bal) return L("ගෙවූ මුදල ණයට වඩා වැඩියි", "Payment is more than the balance");
      }
      if (type === "ADJUSTMENT" && !note.trim()) return L("හේතුවක් ලියන්න", "Write a reason");
      const entry: LedgerEntry = {
        id: uuid(),
        customerId,
        entryType: type,
        amountCents: type === "PAYMENT" ? -Math.abs(amountCents) : amountCents,
        saleId: null,
        reversesEntryId: null,
        note: note.trim(),
        createdBy: s.shop.cashier,
        createdAt: new Date().toISOString(),
      };
      const payload = {
        id: entry.id,
        customerId,
        entryType: entry.entryType,
        amountCents: entry.amountCents,
        reversesEntryId: null,
        note: entry.note,
        createdBy: entry.createdBy,
        createdAt: entry.createdAt,
      };
      update((st) => ({ ...st, ledger: [...st.ledger, entry], outbox: enqueue(st, "ledger.add", payload) }));
      return null;
    },
    [L, update],
  );

  const reverseEntry: StoreApi["reverseEntry"] = useCallback(
    (entryId) => {
      const s = stateRef.current;
      if (!s.shop) return "Shop not set up";
      const orig = s.ledger.find((e) => e.id === entryId);
      if (!orig || orig.entryType === "REVERSAL") return L("මෙය අහෝසි කළ නොහැක", "Cannot reverse this");
      if (s.ledger.some((e) => e.reversesEntryId === entryId))
        return L("දැනටමත් අහෝසි කර ඇත", "Already reversed");
      const entry: LedgerEntry = {
        id: uuid(),
        customerId: orig.customerId,
        entryType: "REVERSAL",
        amountCents: -orig.amountCents,
        saleId: null,
        reversesEntryId: orig.id,
        note: `Reversal of ${orig.entryType}`,
        createdBy: s.shop.cashier,
        createdAt: new Date().toISOString(),
      };
      const payload = {
        id: entry.id,
        customerId: entry.customerId,
        entryType: "REVERSAL",
        amountCents: entry.amountCents,
        reversesEntryId: orig.id,
        note: entry.note,
        createdBy: entry.createdBy,
        createdAt: entry.createdAt,
      };
      update((st) => ({ ...st, ledger: [...st.ledger, entry], outbox: enqueue(st, "ledger.add", payload) }));
      return null;
    },
    [L, update],
  );

  const syncNow: StoreApi["syncNow"] = useCallback(
    async (registrationCode) => {
      if (busyRef.current) return;
      const first = stateRef.current;
      if (!first.shop) return;
      busyRef.current = true;
      setSyncStatus({ busy: true, message: L("සමමුහූර්ත වෙමින්...", "Syncing..."), tone: "info" });
      try {
        if (!navigator.onLine) throw new Error(L("අන්තර්ජාලය නැත", "No internet connection"));
        let apiKey = first.shop.apiKey;
        if (!apiKey) {
          const r = await fetch("/api/shops", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              shopId: first.shop.id,
              name: first.shop.name,
              registrationCode: registrationCode || undefined,
            }),
          });
          const j = (await r.json().catch(() => ({}))) as { apiKey?: string; error?: string };
          if (!r.ok || !j.apiKey) throw new Error(j.error ?? "Registration failed");
          apiKey = j.apiKey;
          const key = apiKey;
          update((s) => (s.shop ? { ...s, shop: { ...s.shop, apiKey: key } } : s));
        }
        const headers = {
          "content-type": "application/json",
          "x-shop-id": first.shop.id,
          authorization: `Bearer ${apiKey}`,
        };
        let sent = 0;
        for (;;) {
          const pending = stateRef.current.outbox.filter((e) => !e.error).slice(0, 100);
          if (pending.length === 0) break;
          const r = await fetch("/api/sync", {
            method: "POST",
            headers,
            body: JSON.stringify({ events: pending.map(({ id, type, payload }) => ({ id, type, payload })) }),
          });
          const j = (await r.json().catch(() => ({}))) as {
            results?: Array<{ id: string | null; status: string; error?: string }>;
            error?: string;
          };
          if (!r.ok || !j.results) throw new Error(j.error ?? `Server error ${r.status}`);
          const byId = new Map(j.results.filter((x) => x.id).map((x) => [x.id as string, x]));
          let progress = 0;
          update((s) => ({
            ...s,
            outbox: s.outbox.flatMap((e) => {
              const res = byId.get(e.id);
              if (!res) return [e];
              progress += 1;
              if (res.status === "rejected") return [{ ...e, error: res.error ?? "rejected" }];
              sent += 1;
              return [];
            }),
          }));
          if (progress === 0) break;
        }
        update((s) => ({ ...s, lastSyncAt: new Date().toISOString() }));
        const failedNow = stateRef.current.outbox.filter((e) => e.error).length;
        setSyncStatus({
          busy: false,
          tone: failedNow ? "err" : "ok",
          message: failedNow
            ? L(`${sent} යැවුවා. ${failedNow}ක් ප්‍රතික්ෂේප විය`, `${sent} sent. ${failedNow} rejected`)
            : L(`සමමුහූර්ත විය (${sent})`, `Synced (${sent} records)`),
        });
      } catch (e) {
        setSyncStatus({ busy: false, tone: "err", message: e instanceof Error ? e.message : "Sync failed" });
      } finally {
        busyRef.current = false;
      }
    },
    [L, update],
  );

  const restore: StoreApi["restore"] = useCallback(async () => {
    const s = stateRef.current;
    if (!s.shop?.apiKey) {
      setSyncStatus({ busy: false, tone: "err", message: L("මුලින් සමමුහූර්ත කරන්න", "Sync once first") });
      return;
    }
    if (s.outbox.length > 0) {
      setSyncStatus({ busy: false, tone: "err", message: L("යැවීමට ඉතිරි දත්ත ඇත. මුලින් Sync කරන්න", "Unsynced data exists – sync first") });
      return;
    }
    setSyncStatus({ busy: true, tone: "info", message: L("ආපසු ගන්නවා...", "Restoring...") });
    try {
      const r = await fetch("/api/sync/snapshot", {
        headers: { "x-shop-id": s.shop.id, authorization: `Bearer ${s.shop.apiKey}` },
      });
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const snap = (await r.json()) as {
        customers: Customer[];
        products: Product[];
        sales: Array<Omit<Sale, "items">>;
        saleItems: Array<{ id: string; saleId: string; productId: string; qtyMilli: number; unitPriceCents: number; unitCostCents: number }>;
        ledger: LedgerEntry[];
      };
      const iso = (v: unknown) => new Date(v as string).toISOString();
      const products = snap.products.map((p) => ({ ...p, createdAt: iso(p.createdAt) }));
      const names = new Map(products.map((p) => [p.id, p.name]));
      const sales: Sale[] = snap.sales.map((sa) => ({
        ...sa,
        createdAt: iso(sa.createdAt),
        items: snap.saleItems
          .filter((i) => i.saleId === sa.id)
          .map((i) => ({ ...i, name: names.get(i.productId) ?? "?" })),
      }));
      update((st) => ({
        ...st,
        customers: snap.customers.map((c) => ({ ...c, createdAt: iso(c.createdAt) })),
        products,
        sales,
        ledger: snap.ledger.map((e) => ({ ...e, createdAt: iso(e.createdAt) })),
        nextBillNo: sales.reduce((m, x) => Math.max(m, x.billNo), 0) + 1,
      }));
      setSyncStatus({ busy: false, tone: "ok", message: L("දත්ත ආපසු ලැබුණා", "Data restored from cloud") });
    } catch (e) {
      setSyncStatus({ busy: false, tone: "err", message: e instanceof Error ? e.message : "Restore failed" });
    }
  }, [L, update]);

  // Auto-sync: when internet returns, and every 2 minutes while online with pending data.
  const pending = state?.outbox.filter((e) => !e.error).length ?? 0;
  const failed = state?.outbox.filter((e) => e.error).length ?? 0;
  const hasKey = Boolean(state?.shop?.apiKey);
  useEffect(() => {
    if (!hasKey) return;
    const tick = () => {
      if (navigator.onLine && stateRef.current.outbox.some((e) => !e.error)) void syncNow();
    };
    window.addEventListener("online", tick);
    const t = setInterval(tick, 120_000);
    tick();
    return () => {
      window.removeEventListener("online", tick);
      clearInterval(t);
    };
  }, [hasKey, syncNow]);

  const retryFailed = useCallback(
    () => update((s) => ({ ...s, outbox: s.outbox.map(({ error, ...e }) => { void error; return e; }) })),
    [update],
  );
  const discardEvent = useCallback(
    (id: string) => update((s) => ({ ...s, outbox: s.outbox.filter((e) => e.id !== id) })),
    [update],
  );

  const exportBackup = useCallback(() => {
    const s = stateRef.current;
    const safe = { ...s, shop: s.shop ? { ...s.shop, apiKey: undefined } : null };
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `naya-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const api = useMemo<StoreApi | null>(
    () =>
      state
        ? {
            state, balances, lang, L, online, syncStatus, pending, failed,
            setLang, setupShop, saveCustomer, saveProduct, checkout, addLedger, reverseEntry,
            syncNow, restore, retryFailed, discardEvent, exportBackup,
          }
        : null,
    [state, balances, lang, L, online, syncStatus, pending, failed, setLang, setupShop, saveCustomer, saveProduct, checkout, addLedger, reverseEntry, syncNow, restore, retryFailed, discardEvent, exportBackup],
  );

  if (!api) {
    return (
      <div className="grid min-h-screen place-items-center text-emerald-800">
        <div className="animate-pulse text-lg">⏳</div>
      </div>
    );
  }
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
