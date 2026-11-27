"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Btn, Card, Field, Notice } from "./ui";

export function SyncPanel() {
  const { state, L, online, syncStatus, pending, failed, syncNow, restore, retryFailed, discardEvent, exportBackup } = useStore();
  const [code, setCode] = useState("");
  const registered = Boolean(state.shop?.apiKey);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={`size-3 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`} />
          <h2 className="text-lg font-bold">{online ? L("අන්තර්ජාලය ඇත", "Internet connected") : L("අන්තර්ජාලය නැත – ගැටළුවක් නැත, සියල්ල කොම්පියුටරයේ save වේ", "Offline – no problem, everything is saved on this PC")}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-bold text-amber-600">{pending}</div><div className="text-xs text-slate-500">{L("යැවීමට ඇති", "Waiting")}</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-bold text-rose-600">{failed}</div><div className="text-xs text-slate-500">{L("ප්‍රතික්ෂේප", "Rejected")}</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-sm font-bold text-slate-700">{state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : "—"}</div><div className="text-xs text-slate-500">{L("අන්තිම sync", "Last sync")}</div></div>
        </div>
        {!registered && (
          <Field label={L("ලියාපදිංචි කේතය (තිබේ නම්)", "Registration code (if you were given one)")} value={code} onChange={(e) => setCode(e.target.value)} />
        )}
        <Btn big className="w-full" disabled={syncStatus.busy || !online} onClick={() => syncNow(code)}>
          ☁️ {syncStatus.busy ? L("සමමුහූර්ත වෙමින්...", "Syncing...") : L("දැන් Sync කරන්න", "Sync now")}
        </Btn>
        {syncStatus.message && <Notice tone={syncStatus.tone}>{syncStatus.message}</Notice>}
        <p className="text-sm text-slate-500">{L("අන්තර්ජාලය ආපු විට ස්වයංක්‍රීයව ද sync වේ. දවසකට එක් වරක් වුවත් ප්‍රමාණවත්.", "Sync also runs automatically when internet returns. Once a day is enough.")}</p>
      </Card>

      {failed > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-rose-700">⚠ {L("ප්‍රතික්ෂේප වූ දත්ත", "Rejected records")}</h3>
            <Btn variant="secondary" onClick={retryFailed}>🔁 {L("නැවත උත්සාහ", "Retry all")}</Btn>
          </div>
          {state.outbox.filter((e) => e.error).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-rose-50 p-2 text-sm">
              <span><b>{e.type}</b> – {e.error}</span>
              <button className="text-rose-700 underline" onClick={() => confirm(L("මෙය ඉවත් කරන්නද?", "Discard this record?")) && discardEvent(e.id)}>{L("ඉවත් කරන්න", "Discard")}</button>
            </div>
          ))}
        </Card>
      )}

      <Card className="space-y-3">
        <h3 className="font-bold">💾 {L("Backup සහ ආපසු ගැනීම", "Backup & restore")}</h3>
        <div className="flex flex-wrap gap-2">
          <Btn variant="secondary" onClick={exportBackup}>📥 {L("Backup file එකක් බාගන්න", "Download backup file")}</Btn>
          <Btn variant="secondary" disabled={!registered || !online || syncStatus.busy} onClick={() => confirm(L("Cloud එකේ දත්ත මේ PC එකට ආපසු ගන්නද?", "Replace local data with the cloud copy?")) && restore()}>
            ☁️⬇ {L("Cloud එකෙන් ආපසු ගන්න", "Restore from cloud")}
          </Btn>
        </div>
        <p className="text-sm text-slate-500">{L("PC එක කැඩුණොත් අලුත් PC එකකට cloud එකෙන් ණය පොත ආපසු ගත හැක.", "If the PC breaks, restore the credit book onto a new PC from the cloud.")}</p>
      </Card>

      <Card className="flex items-center justify-between">
        <div>
          <div className="font-bold">{state.shop?.name}</div>
          <div className="text-sm text-slate-500">{L("අයිතිකරු / කැෂියර්", "Cashier")}: {state.shop?.cashier} · v1 MVP</div>
        </div>
        <Link href="/plan" className="rounded-xl bg-emerald-50 px-4 py-2 font-semibold text-emerald-800 ring-1 ring-emerald-200">🗺 {L("ව්‍යාපෘති සැලැස්ම", "Project plan")}</Link>
      </Card>
    </div>
  );
}
