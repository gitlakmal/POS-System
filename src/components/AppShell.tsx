"use client";

import { useEffect, useState } from "react";
import { Customers } from "./Customers";
import { POS } from "./POS";
import { Products } from "./Products";
import { Reports } from "./Reports";
import { SyncPanel } from "./SyncPanel";
import { Btn, Card, Field } from "./ui";
import { StoreProvider, useStore } from "@/lib/store";

type Tab = "pos" | "credit" | "items" | "reports" | "sync";

function Setup() {
  const { L, lang, setLang, setupShop } = useStore();
  const [name, setName] = useState("");
  const [cashier, setCashier] = useState("");
  const [sample, setSample] = useState(true);
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-4">
      <Card className="w-full max-w-md space-y-4 !p-6">
        <div className="text-center">
          <div className="mx-auto mb-2 grid size-16 place-items-center rounded-2xl bg-emerald-100 text-4xl">📒</div>
          <h1 className="text-2xl font-extrabold text-emerald-900">නය පොත · Naya Potha</h1>
          <p className="text-sm text-slate-500">{L("ගම්මානයේ කඩය සඳහා ඩිජිටල් ණය පොත සහ POS", "Digital credit book & POS for village shops")}</p>
        </div>
        <div className="flex justify-center gap-2">
          <Btn variant={lang === "si" ? "primary" : "secondary"} onClick={() => setLang("si")}>සිංහල</Btn>
          <Btn variant={lang === "en" ? "primary" : "secondary"} onClick={() => setLang("en")}>English</Btn>
        </div>
        <Field label={L("කඩයේ නම", "Shop name")} value={name} onChange={(e) => setName(e.target.value)} placeholder={L("උදා: සමන් ස්ටෝර්ස්", "e.g. Saman Stores")} />
        <Field label={L("ඔබේ නම", "Your name")} value={cashier} onChange={(e) => setCashier(e.target.value)} />
        <label className="flex items-center gap-2 text-slate-700">
          <input type="checkbox" className="size-5 accent-emerald-600" checked={sample} onChange={(e) => setSample(e.target.checked)} />
          {L("උදාහරණ බඩු කිහිපයක් දමන්න", "Add some sample items")}
        </label>
        <Btn big className="w-full" disabled={!name.trim() || !cashier.trim()} onClick={() => setupShop(name.trim(), cashier.trim(), sample)}>
          🚀 {L("ආරම්භ කරන්න", "Get started")}
        </Btn>
        <p className="text-center text-xs text-slate-400">{L("අන්තර්ජාලය නැතිවත් වැඩ කරයි", "Works fully offline")}</p>
      </Card>
    </main>
  );
}

function Shell() {
  const { state, L, lang, setLang, online, pending, failed } = useStore();
  const [tab, setTab] = useState<Tab>("pos");

  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  if (!state.shop) return <Setup />;

  const tabs: Array<[Tab, string, string]> = [
    ["pos", "🛒", L("විකුණන්න", "Sell")],
    ["credit", "📒", L("ණය පොත", "Credit book")],
    ["items", "📦", L("බඩු", "Items")],
    ["reports", "📊", L("වාර්තා", "Reports")],
    ["sync", "☁️", L("Sync", "Sync")],
  ];

  return (
    <div id="app-root" className="no-print min-h-screen pb-24 lg:pb-8">
      <header className="sticky top-0 z-30 bg-emerald-800 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <span className="text-2xl">📒</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold leading-tight">{state.shop.name}</div>
            <div className="text-xs text-emerald-200">නය පොත · Naya Potha</div>
          </div>
          <nav className="hidden gap-1 lg:flex">
            {tabs.map(([k, icon, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 font-semibold transition ${tab === k ? "bg-white text-emerald-900" : "text-emerald-100 hover:bg-emerald-700"}`}>
                {icon} {label}
              </button>
            ))}
          </nav>
          <button onClick={() => setTab("sync")} className={`rounded-full px-3 py-1 text-xs font-semibold ${online ? "bg-emerald-600" : "bg-rose-600"}`}>
            {online ? "●" : "○"} {online ? "Online" : "Offline"}
            {pending + failed > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-slate-900">{pending + failed}</span>}
          </button>
          <button onClick={() => setLang(lang === "si" ? "en" : "si")} className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold hover:bg-white/25">
            {lang === "si" ? "EN" : "සිං"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        <div className={tab === "pos" ? "" : "hidden"}><POS /></div>
        <div className={tab === "credit" ? "" : "hidden"}><Customers /></div>
        <div className={tab === "items" ? "" : "hidden"}><Products /></div>
        <div className={tab === "reports" ? "" : "hidden"}><Reports /></div>
        <div className={tab === "sync" ? "" : "hidden"}><SyncPanel /></div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {tabs.map(([k, icon, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${tab === k ? "text-emerald-700" : "text-slate-500"}`}>
            <span className={`text-2xl transition ${tab === k ? "scale-110" : ""}`}>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function AppShell() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
