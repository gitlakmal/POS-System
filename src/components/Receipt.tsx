"use client";

import { useStore } from "@/lib/store";
import { formatQty, formatRs, lineTotal } from "@/lib/money";
import type { Sale } from "@/lib/types";

/** Thermal-style (80mm) receipt. For credit customers it shows the full running-balance story. */
export function Receipt({ sale }: { sale: Sale }) {
  const { state, L } = useStore();
  const customer = sale.customerId ? state.customers.find((c) => c.id === sale.customerId) : null;
  const newBalance = sale.prevBalanceCents + sale.totalCents - sale.paidCents;
  const row = "flex justify-between gap-2";
  return (
    <div className="print-card mx-auto w-[302px] bg-white p-4 font-mono text-[13px] leading-5 text-black shadow-xl">
      <div className="text-center">
        <div className="text-base font-bold">{state.shop?.name}</div>
        <div>{new Date(sale.createdAt).toLocaleString()}</div>
        <div>
          {L("බිල්පත", "Bill")} #{sale.billNo}
        </div>
        {customer && (
          <div className="mt-1 font-bold">
            {customer.name} (ID {customer.code})
          </div>
        )}
      </div>
      <hr className="my-2 border-dashed border-black" />
      {sale.items.map((i) => (
        <div key={i.id} className="mb-1">
          <div>{i.name}</div>
          <div className={row}>
            <span>
              {formatQty(i.qtyMilli)} × {formatRs(i.unitPriceCents)}
            </span>
            <span>{formatRs(lineTotal(i.qtyMilli, i.unitPriceCents))}</span>
          </div>
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      {customer ? (
        <div className="space-y-0.5">
          <div className={row}>
            <span>{L("පරණ ණය", "Previous credit")}</span>
            <span>{formatRs(sale.prevBalanceCents)}</span>
          </div>
          <div className={row}>
            <span>{L("අද බිල", "Today's bill")}</span>
            <span>{formatRs(sale.totalCents)}</span>
          </div>
          <div className={row}>
            <span>{L("ගෙවූ මුදල", "Paid today")}</span>
            <span>- {formatRs(sale.paidCents)}</span>
          </div>
          <hr className="border-black" />
          <div className={`${row} text-base font-bold`}>
            <span>{L("ඉතිරි ණය", "Remaining credit")}</span>
            <span>{formatRs(newBalance)}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5">
          <div className={`${row} text-base font-bold`}>
            <span>{L("මුළු මුදල", "Total")}</span>
            <span>{formatRs(sale.totalCents)}</span>
          </div>
          <div className="text-center">{L("මුදල් ගෙවා ඇත", "Paid in cash")}</div>
        </div>
      )}
      <hr className="my-2 border-dashed border-black" />
      <div className="text-center">{L("ස්තූතියි! නැවත එන්න 🙏", "Thank you! Come again 🙏")}</div>
    </div>
  );
}
