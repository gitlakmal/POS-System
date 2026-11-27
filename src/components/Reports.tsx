"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { daysOverdue } from "@/lib/ledger";
import { formatQty, formatRs, lineTotal } from "@/lib/money";
import { useStore } from "@/lib/store";
import { Btn, Card, Empty } from "./ui";

type Range = 1 | 7 | 30;

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-2xl p-4 text-white shadow-lg ${tone}`}>
      <div className="text-sm opacity-90">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

export function Reports() {
  const { state, balances, L } = useStore();
  const [range, setRange] = useState<Range>(1);

  const data = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (range - 1));
    const from = start.getTime();
    const inRange = (iso: string) => new Date(iso).getTime() >= from;

    const sales = state.sales.filter((s) => inRange(s.createdAt));
    const salesTotal = sales.reduce((s, x) => s + x.totalCents, 0);
    const cashAtSale = sales.reduce((s, x) => s + x.paidCents, 0);
    const creditGiven = sales.reduce((s, x) => (x.customerId ? s + Math.max(0, x.totalCents - x.paidCents) : s), 0);
    // payments taken outside a bill, minus reversed ones
    const collected = state.ledger
      .filter((e) => !e.saleId && inRange(e.createdAt))
      .reduce((s, e) => {
        if (e.entryType === "PAYMENT") return s - e.amountCents;
        if (e.entryType === "REVERSAL" && e.note.includes("PAYMENT")) return s - e.amountCents;
        return s;
      }, 0);
    let profit = 0;
    const top = new Map<string, { name: string; qty: number; amount: number }>();
    for (const s of sales)
      for (const i of s.items) {
        const amount = lineTotal(i.qtyMilli, i.unitPriceCents);
        profit += amount - lineTotal(i.qtyMilli, i.unitCostCents);
        const t = top.get(i.productId) ?? { name: i.name, qty: 0, amount: 0 };
        t.qty += i.qtyMilli;
        t.amount += amount;
        top.set(i.productId, t);
      }
    return { sales, salesTotal, cashIn: cashAtSale + collected, creditGiven, collected, profit, top: [...top.values()].sort((a, b) => b.amount - a.amount).slice(0, 6) };
  }, [state.sales, state.ledger, range]);

  const debtors = state.customers
    .map((c) => ({ c, bal: balances.get(c.id) ?? 0 }))
    .filter((x) => x.bal > 0)
    .sort((a, b) => b.bal - a.bal)
    .slice(0, 6);

  const exportSales = () =>
    downloadCsv("sales.csv", [
      ["Bill", "Date", "Customer", "Total (Rs)", "Paid (Rs)", "Cashier"],
      ...state.sales.map((s) => [s.billNo, new Date(s.createdAt).toLocaleString(), state.customers.find((c) => c.id === s.customerId)?.name ?? "Cash", s.totalCents / 100, s.paidCents / 100, s.cashierName]),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([[1, L("අද", "Today")], [7, L("දින 7", "7 days")], [30, L("දින 30", "30 days")]] as Array<[Range, string]>).map(([r, label]) => (
          <button key={r} onClick={() => setRange(r)} className={`rounded-full px-4 py-2 font-medium ${range === r ? "bg-emerald-600 text-white" : "bg-white ring-1 ring-slate-300"}`}>{label}</button>
        ))}
        <Btn variant="secondary" className="ml-auto" onClick={exportSales}>📤 {L("විකුණුම් Excel", "Sales Excel")}</Btn>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={L("මුළු විකුණුම්", "Total sales")} value={formatRs(data.salesTotal)} tone="bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-600/20" />
        <Stat label={L("අතට ආපු මුදල්", "Cash received")} value={formatRs(data.cashIn)} tone="bg-gradient-to-br from-sky-500 to-sky-700 shadow-sky-600/20" />
        <Stat label={L("ණයට දුන්නේ", "Given on credit")} value={formatRs(data.creditGiven)} tone="bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-600/20" />
        <Stat label={L("ඇස්තමේන්තුගත ලාභය", "Estimated profit")} value={formatRs(data.profit)} tone="bg-gradient-to-br from-violet-500 to-violet-700 shadow-violet-600/20" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-bold">🏆 {L("වැඩියෙන්ම විකිණුණු බඩු", "Best sellers")}</h3>
          {data.top.length === 0 ? <Empty icon="📊" text={L("දත්ත නැත", "No sales in this period")} /> : (
            <ul className="divide-y divide-slate-100">
              {data.top.map((t, i) => (
                <li key={t.name + i} className="flex justify-between py-2">
                  <span>{i + 1}. {t.name} <span className="text-sm text-slate-400">× {formatQty(t.qty)}</span></span>
                  <b>{formatRs(t.amount)}</b>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="mb-2 font-bold">📒 {L("වැඩිම ණය ඇති අය", "Top debtors")}</h3>
          {debtors.length === 0 ? <Empty icon="🎉" text={L("ණය නැත", "Nobody owes anything")} /> : (
            <ul className="divide-y divide-slate-100">
              {debtors.map(({ c, bal }) => {
                const d = daysOverdue(state.ledger, c.id, bal);
                return (
                  <li key={c.id} className="flex justify-between py-2">
                    <span>{c.name} {d >= 30 && <span className="text-xs text-rose-600">⚠ {L(`දින ${d}`, `${d} d`)}</span>}</span>
                    <b className="text-amber-700">{formatRs(bal)}</b>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <p className="text-xs text-slate-400">{L("ලාභය ගණනය වන්නේ බඩුවේ 'ගත් මිල' ඇතුළත් කර ඇත්නම් පමණි.", "Profit is only accurate when each item has a cost price.")}</p>
    </div>
  );
}
