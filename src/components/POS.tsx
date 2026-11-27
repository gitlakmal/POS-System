"use client";

import { useCallback, useMemo, useState } from "react";
import { centsToInput, formatQty, formatRs, lineTotal, toCents, toMilli } from "@/lib/money";
import { useStore } from "@/lib/store";
import type { Sale } from "@/lib/types";
import { parseScanned } from "./QrImage";
import { QrScanner } from "./QrScanner";
import { Receipt } from "./Receipt";
import { Btn, Card, Empty, Field, Notice, PrintModal } from "./ui";

interface CartLine {
  productId: string;
  qty: string;
  price: string;
}

export function POS() {
  const { state, balances, L, checkout } = useStore();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [custQuery, setCustQuery] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paidText, setPaidText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.products.filter((p) => p.isActive && (!q || p.name.toLowerCase().includes(q) || p.barcode === q));
  }, [state.products, search]);

  const customer = customerId ? state.customers.find((c) => c.id === customerId) ?? null : null;
  const prev = customer ? (balances.get(customer.id) ?? 0) : 0;

  const lines = cart.map((l) => {
    const p = state.products.find((x) => x.id === l.productId);
    const qtyMilli = toMilli(l.qty);
    const priceCents = toCents(l.price);
    return { l, p, qtyMilli, priceCents, total: qtyMilli !== null && priceCents !== null ? lineTotal(qtyMilli, priceCents) : 0 };
  });
  const valid = lines.length > 0 && lines.every((x) => x.qtyMilli !== null && x.priceCents !== null);
  const total = lines.reduce((s, x) => s + x.total, 0);
  const paid = customer ? (toCents(paidText) ?? 0) : total;
  const newBalance = prev + total - paid;

  const suggestions = useMemo(() => {
    const q = custQuery.trim().toLowerCase();
    if (!q || customer) return [];
    return state.customers
      .filter((c) => c.isActive && (String(c.code).startsWith(q.replace(/^np-?/, "")) || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)))
      .slice(0, 5);
  }, [custQuery, customer, state.customers]);

  const pickCustomer = useCallback(
    (id: string) => {
      setCustomerId(id);
      setCustQuery("");
      setPaidText("");
      setError(null);
    },
    [],
  );

  const pickByText = useCallback(
    (text: string): boolean => {
      const code = parseScanned(text);
      const c = code ? state.customers.find((x) => x.code === code) : null;
      if (c) {
        pickCustomer(c.id);
        return true;
      }
      return false;
    },
    [pickCustomer, state.customers],
  );

  const onScan = useCallback(
    (text: string) => {
      if (pickByText(text)) setScanning(false);
    },
    [pickByText],
  );

  const addProduct = (id: string) => {
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    setCart((c) => {
      const i = c.findIndex((x) => x.productId === id);
      if (i >= 0) {
        const q = toMilli(c[i].qty) ?? 0;
        return c.map((x, k) => (k === i ? { ...x, qty: formatQty(q + 1000) } : x));
      }
      return [...c, { productId: id, qty: "1", price: centsToInput(p.priceCents) }];
    });
    setError(null);
  };

  const finish = () => {
    const res = checkout({
      customerId,
      paidCents: paid,
      lines: lines.map((x) => ({ productId: x.l.productId, qtyMilli: x.qtyMilli ?? 0, unitPriceCents: x.priceCents ?? 0 })),
    });
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setReceipt(res.sale);
    setCart([]);
    setCustomerId(null);
    setPaidText("");
    setSearch("");
    setError(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      {/* Items */}
      <div className="space-y-3">
        <Field
          placeholder={L("🔍 බඩුවක් සොයන්න...", "🔍 Search an item...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && products.length >= 1) {
              addProduct(products[0].id);
              setSearch("");
            }
          }}
          autoComplete="off"
        />
        {state.products.length === 0 ? (
          <Card>
            <Empty icon="📦" text={L("මුලින් 'බඩු' tab එකෙන් බඩු එකතු කරන්න", "Add items in the 'Items' tab first")} />
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p.id)}
                className="group flex min-h-[92px] flex-col justify-between rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-emerald-400 active:scale-[0.97]"
              >
                <span className="text-[15px] font-semibold leading-snug text-slate-900">{p.name}</span>
                <span className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-emerald-700">{formatRs(p.priceCents)}</span>
                  <span className="text-xs text-slate-400">/{p.unit}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bill */}
      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">🧾 {L("බිල", "Bill")} #{state.nextBillNo}</h2>
            {cart.length > 0 && (
              <button className="text-sm text-rose-600" onClick={() => setCart([])}>
                {L("හිස් කරන්න", "Clear")}
              </button>
            )}
          </div>

          {/* Customer */}
          {customer ? (
            <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <div>
                <div className="font-bold text-slate-900">
                  {customer.name} <span className="font-normal text-slate-500">· ID {customer.code}</span>
                </div>
                <div className="text-sm text-amber-800">
                  {L("පරණ ණය", "Previous credit")}: <b>{formatRs(prev)}</b>
                </div>
              </div>
              <button className="rounded-full p-2 text-slate-500 hover:bg-white" onClick={() => setCustomerId(null)} aria-label="remove">✕</button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-2">
                <Field
                  className="flex-1"
                  placeholder={L("ණය පාරිභෝගිකයා: ID / නම", "Credit customer: ID / name")}
                  value={custQuery}
                  onChange={(e) => setCustQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !pickByText(custQuery) && suggestions[0]) pickCustomer(suggestions[0].id);
                  }}
                  inputMode="search"
                  autoComplete="off"
                />
                <Btn variant="secondary" onClick={() => setScanning(true)} aria-label="scan">📷</Btn>
              </div>
              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
                  {suggestions.map((c) => (
                    <button key={c.id} onClick={() => pickCustomer(c.id)} className="flex w-full justify-between px-3 py-3 text-left hover:bg-emerald-50">
                      <span>
                        {c.name} <span className="text-slate-400">· {c.code}</span>
                      </span>
                      <span className="font-semibold text-amber-700">{formatRs(balances.get(c.id) ?? 0)}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-slate-500">{L("ණය නැති (cash) පාරිභෝගිකයන්ට මෙය හිස්ව තබන්න", "Leave empty for normal cash customers")}</p>
            </div>
          )}

          {/* Lines */}
          {lines.length === 0 ? (
            <Empty icon="🛒" text={L("බඩු තෝරන්න", "Tap items to add")} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lines.map((x) => (
                <li key={x.l.productId} className="py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-medium">{x.p?.name}</span>
                    <button className="text-slate-400 hover:text-rose-600" onClick={() => setCart((c) => c.filter((k) => k.productId !== x.l.productId))} aria-label="remove">✕</button>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={x.l.qty}
                      inputMode="decimal"
                      onChange={(e) => setCart((c) => c.map((k) => (k.productId === x.l.productId ? { ...k, qty: e.target.value } : k)))}
                      className={`w-20 rounded-lg px-2 py-2 text-center ring-1 ${x.qtyMilli === null ? "ring-rose-400" : "ring-slate-300"}`}
                      aria-label="qty"
                    />
                    <span className="text-sm text-slate-500">{x.p?.unit} ×</span>
                    <input
                      value={x.l.price}
                      inputMode="decimal"
                      onChange={(e) => setCart((c) => c.map((k) => (k.productId === x.l.productId ? { ...k, price: e.target.value } : k)))}
                      className={`w-24 rounded-lg px-2 py-2 text-center ring-1 ${x.priceCents === null ? "ring-rose-400" : "ring-slate-300"}`}
                      aria-label="price"
                    />
                    <span className="ml-auto font-bold">{formatRs(x.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Totals */}
          <div className="space-y-1 rounded-xl bg-slate-50 p-3">
            {customer && (
              <div className="flex justify-between text-slate-600">
                <span>{L("පරණ ණය", "Previous credit")}</span>
                <span>{formatRs(prev)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>{L("අද බිල", "Today's bill")}</span>
              <span>{formatRs(total)}</span>
            </div>
            {customer && (
              <>
                <div className="pt-1">
                  <Field
                    label={L("අද ගෙවන මුදල (අතේ මුදල්)", "Paid today (cash in hand)")}
                    value={paidText}
                    onChange={(e) => setPaidText(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Btn variant="secondary" className="!px-3 !py-1.5 !text-sm" onClick={() => setPaidText("")}>
                      {L("සියල්ල ණයට", "All on credit")}
                    </Btn>
                    <Btn variant="secondary" className="!px-3 !py-1.5 !text-sm" onClick={() => setPaidText(centsToInput(total))} disabled={total === 0}>
                      {L("අද බිල ගෙවන්න", "Pay today's bill")}
                    </Btn>
                    {prev > 0 && (
                      <Btn variant="secondary" className="!px-3 !py-1.5 !text-sm" onClick={() => setPaidText(centsToInput(prev + total))}>
                        {L("සියල්ල ගෙවන්න", "Pay everything")}
                      </Btn>
                    )}
                  </div>
                </div>
                <div className={`mt-2 flex justify-between rounded-lg px-3 py-2 text-lg font-bold ${newBalance > 0 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                  <span>{L("ඉතිරි ණය", "Remaining credit")}</span>
                  <span>{formatRs(newBalance)}</span>
                </div>
              </>
            )}
          </div>

          {error && <Notice tone="err">{error}</Notice>}
          <Btn big className="w-full" disabled={!valid || total <= 0} onClick={finish}>
            ✅ {L("බිල සම්පූර්ණ කරන්න", "Complete sale")}
          </Btn>
        </Card>
      </div>

      {scanning && <QrScanner onResult={onScan} onClose={() => setScanning(false)} />}
      {receipt && (
        <PrintModal onClose={() => setReceipt(null)} closeLabel={L("වසන්න", "Close")} printLabel={L("බිල අච්චු කරන්න", "Print receipt")}>
          <Receipt sale={receipt} />
        </PrintModal>
      )}
    </div>
  );
}
