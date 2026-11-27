"use client";

import { useMemo, useState } from "react";
import { centsToInput, formatRs, toCents } from "@/lib/money";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { Btn, Card, Empty, Field, Modal, Notice } from "./ui";

const UNITS = ["unit", "kg", "g", "l", "pack"];

export function Products() {
  const { state, L } = useStore();
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<{ product?: Product } | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.barcode === q);
  }, [state.products, query]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Field className="flex-1" placeholder={L("🔍 බඩු සොයන්න", "🔍 Search items")} value={query} onChange={(e) => setQuery(e.target.value)} />
        <Btn onClick={() => setEdit({})}>➕ {L("අලුත් බඩුවක්", "New item")}</Btn>
      </div>
      {list.length === 0 ? (
        <Card><Empty icon="📦" text={L("බඩු නැත", "No items")} /></Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <button key={p.id} onClick={() => setEdit({ product: p })} className={`rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-emerald-400 ${p.isActive ? "" : "opacity-50"}`}>
              <div className="font-semibold">{p.name}</div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="font-bold text-emerald-700">{formatRs(p.priceCents)} / {p.unit}</span>
                <span className="text-slate-500">{L("ගත් මිල", "Cost")} {formatRs(p.costCents)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {edit && <ProductForm product={edit.product} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const { L, saveProduct } = useStore();
  const [name, setName] = useState(product?.name ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "unit");
  const [price, setPrice] = useState(product ? centsToInput(product.priceCents) : "");
  const [cost, setCost] = useState(product ? centsToInput(product.costCents) : "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [active, setActive] = useState(product?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const priceCents = toCents(price);
    const costCents = cost.trim() ? toCents(cost) : 0;
    if (priceCents === null || costCents === null) return setError(L("මිල වලංගු නැත", "Invalid price"));
    const err = saveProduct({ id: product?.id, name, unit, priceCents, costCents, barcode, isActive: active });
    if (err) return setError(err);
    onClose();
  };

  return (
    <Modal title={product ? L("බඩුව වෙනස් කරන්න", "Edit item") : L("අලුත් බඩුවක්", "New item")} onClose={onClose}>
      <div className="space-y-3">
        <Field label={L("නම", "Name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600">{L("ඒකකය", "Unit")}</span>
          <div className="flex flex-wrap gap-2">
            {UNITS.map((u) => (
              <button key={u} onClick={() => setUnit(u)} className={`rounded-full px-4 py-2 ${unit === u ? "bg-emerald-600 text-white" : "bg-white ring-1 ring-slate-300"}`}>{u}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={L("විකුණුම් මිල", "Selling price")} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          <Field label={L("ගත් මිල (ලාභය සඳහා)", "Cost (for profit)")} value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" />
        </div>
        <Field label={L("Barcode (අවශ්‍ය නම්)", "Barcode (optional)")} value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-emerald-600" />
          {L("විකිණීමට ඇත", "Available for sale")}
        </label>
        {error && <Notice tone="err">{error}</Notice>}
        <Btn big className="w-full" onClick={submit}>💾 {L("සුරකින්න", "Save")}</Btn>
      </div>
    </Modal>
  );
}
