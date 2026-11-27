"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { daysOverdue, lastPaymentAt, ledgerRows } from "@/lib/ledger";
import { formatRs, toCents } from "@/lib/money";
import { useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { QrImage } from "./QrImage";
import { Btn, Card, Empty, Field, Modal, Notice, PrintModal } from "./ui";

type Filter = "all" | "owing" | "overdue";
const OVERDUE_DAYS = 30;

export function Customers() {
  const { state, balances, L } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<{ customer?: Customer } | null>(null);
  const [cards, setCards] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^np-?/, "");
    return state.customers
      .filter((c) => c.isActive)
      .map((c) => {
        const bal = balances.get(c.id) ?? 0;
        return { c, bal, days: daysOverdue(state.ledger, c.id, bal) };
      })
      .filter(({ c, bal, days }) => {
        if (q && !(String(c.code).startsWith(q) || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q))) return false;
        if (filter === "owing") return bal > 0;
        if (filter === "overdue") return days >= OVERDUE_DAYS;
        return true;
      })
      .sort((a, b) => b.bal - a.bal || a.c.code - b.c.code);
  }, [state.customers, state.ledger, balances, query, filter]);

  const totalOwed = useMemo(() => [...balances.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0), [balances]);
  const current = selected ? state.customers.find((c) => c.id === selected) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className={`space-y-3 ${current ? "hidden lg:block" : ""}`}>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-lg shadow-amber-600/20">
          <div className="text-sm opacity-90">{L("සියලු පාරිභෝගිකයන්ගෙන් ලැබිය යුතු ණය", "Total credit to collect")}</div>
          <div className="text-3xl font-extrabold">{formatRs(totalOwed)}</div>
        </div>
        <div className="flex gap-2">
          <Btn className="flex-1" onClick={() => setForm({})}>➕ {L("අලුත් පාරිභෝගිකයා", "New customer")}</Btn>
          <Btn variant="secondary" onClick={() => setCards(true)}>🪪 {L("QR කාඩ්", "QR cards")}</Btn>
        </div>
        <Field placeholder={L("🔍 ID / නම / දුරකථනය", "🔍 ID / name / phone")} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        <div className="flex gap-2 text-sm">
          {(
            [
              ["all", L("සියල්ල", "All")],
              ["owing", L("ණය ඇත්තන්", "Owing")],
              ["overdue", L(`දින ${OVERDUE_DAYS}+ ගෙවා නැත`, `${OVERDUE_DAYS}+ days`)],
            ] as Array<[Filter, string]>
          ).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 font-medium ${filter === k ? "bg-emerald-600 text-white" : "bg-white ring-1 ring-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <Card><Empty icon="📒" text={L("පාරිභෝගිකයන් නැත", "No customers yet")} /></Card>
        ) : (
          <ul className="space-y-2">
            {rows.map(({ c, bal, days }) => (
              <li key={c.id}>
                <button onClick={() => setSelected(c.id)} className={`flex w-full items-center justify-between rounded-2xl bg-white p-3 text-left shadow-sm ring-1 transition hover:ring-emerald-400 ${selected === c.id ? "ring-2 ring-emerald-500" : "ring-slate-200"}`}>
                  <div>
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      ID {c.code}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${bal > 0 ? "text-amber-700" : bal < 0 ? "text-sky-700" : "text-emerald-700"}`}>{formatRs(bal)}</div>
                    {days >= OVERDUE_DAYS && <div className="text-xs text-rose-600">⚠ {L(`දින ${days}`, `${days} days`)}</div>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={current ? "" : "hidden lg:block"}>
        {current ? (
          <Detail customer={current} onBack={() => setSelected(null)} onEdit={() => setForm({ customer: current })} />
        ) : (
          <Card><Empty icon="👈" text={L("පාරිභෝගිකයෙකු තෝරන්න", "Select a customer")} /></Card>
        )}
      </div>

      {form && <CustomerForm customer={form.customer} onClose={() => setForm(null)} onSaved={(id) => id && setSelected(id)} />}
      {cards && <CardSheet onClose={() => setCards(false)} />}
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved: (id: string | null) => void }) {
  const { state, L, saveCustomer } = useStore();
  const nextCode = Math.max(1000, ...state.customers.map((c) => c.code)) + 1;
  const [code, setCode] = useState(String(customer?.code ?? nextCode));
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const n = /^\d+$/.test(code) ? parseInt(code, 10) : NaN;
    const err = saveCustomer({ id: customer?.id, code: n, name, phone });
    if (err) return setError(err);
    onSaved(state.customers.find((c) => c.code === n)?.id ?? null);
    onClose();
  };

  return (
    <Modal title={customer ? L("පාරිභෝගිකයා වෙනස් කරන්න", "Edit customer") : L("අලුත් පාරිභෝගිකයා", "New customer")} onClose={onClose}>
      <div className="space-y-3">
        <Field label={L("නම", "Name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Field label={L("දුරකථන අංකය (SMS සඳහා)", "Phone (for SMS reminders)")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="07XXXXXXXX" />
        <Field
          label={L("ID අංකය", "Customer ID")}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          hint={L("කලින් print කළ QR කාඩ් එකක් නම්, ඒ කාඩ් එකේ අංකය ගහන්න.", "Using a pre-printed QR card? Type the number printed on it.")}
        />
        {error && <Notice tone="err">{error}</Notice>}
        <Btn big className="w-full" onClick={submit}>💾 {L("සුරකින්න", "Save")}</Btn>
      </div>
    </Modal>
  );
}

function Detail({ customer, onBack, onEdit }: { customer: Customer; onBack: () => void; onEdit: () => void }) {
  const { state, balances, L, addLedger, reverseEntry } = useStore();
  const [mode, setMode] = useState<null | "pay" | "adjust">(null);
  const [card, setCard] = useState(false);
  const bal = balances.get(customer.id) ?? 0;
  const rows = ledgerRows(state.ledger, customer.id);
  const lastPaid = lastPaymentAt(state.ledger, customer.id);
  const days = daysOverdue(state.ledger, customer.id, bal);
  const [msg, setMsg] = useState<string | null>(null);

  const reminder = L(
    `${state.shop?.name}: ${customer.name}, ඔබගේ ඉතිරි ණය ${formatRs(bal)} කි. පහසු වෙලාවක ගෙවන්න. ස්තූතියි!`,
    `${state.shop?.name}: Dear ${customer.name}, your remaining credit is ${formatRs(bal)}. Please pay when convenient. Thank you!`,
  );

  const exportCsv = () =>
    downloadCsv(`credit-${customer.code}.csv`, [
      ["Date", "Type", "Note", "Amount (Rs)", "Balance (Rs)", "By"],
      ...rows.map((r) => [new Date(r.entry.createdAt).toLocaleString(), r.entry.entryType, r.entry.note, r.entry.amountCents / 100, r.running / 100, r.entry.createdBy]),
    ]);

  return (
    <div className="space-y-3">
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button className="mb-1 text-sm text-emerald-700 lg:hidden" onClick={onBack}>← {L("ආපසු", "Back")}</button>
            <h2 className="text-2xl font-bold">{customer.name}</h2>
            <p className="text-sm text-slate-500">ID {customer.code}{customer.phone ? ` · ${customer.phone}` : ""}</p>
            <button className="mt-1 text-sm text-emerald-700 underline" onClick={onEdit}>✏️ {L("වෙනස් කරන්න", "Edit")}</button>
          </div>
          <button onClick={() => setCard(true)} className="rounded-xl bg-white p-1 ring-1 ring-slate-200" title={L("කාඩ් එක print කරන්න", "Print card")}>
            <QrImage code={customer.code} size={84} />
          </button>
        </div>

        <div className={`rounded-2xl p-4 ${bal > 0 ? "bg-amber-50 ring-1 ring-amber-200" : "bg-emerald-50 ring-1 ring-emerald-200"}`}>
          <div className="text-sm text-slate-600">{L("ඉතිරි ණය", "Outstanding credit")}</div>
          <div className={`text-4xl font-extrabold ${bal > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatRs(bal)}</div>
          <div className="mt-1 text-sm text-slate-500">
            {L("අන්තිම ගෙවීම", "Last payment")}: {lastPaid ? new Date(lastPaid).toLocaleDateString() : L("නැත", "never")}
            {days >= OVERDUE_DAYS && <span className="ml-2 font-semibold text-rose-600">⚠ {L(`දින ${days}ක් ගෙවා නැත`, `${days} days unpaid`)}</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => setMode("pay")} disabled={bal <= 0}>💵 {L("ගෙවීමක් ලබාගන්න", "Receive payment")}</Btn>
          {customer.phone && bal > 0 && (
            <a className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 font-semibold ring-1 ring-slate-300 hover:bg-slate-50" href={`sms:${customer.phone}?body=${encodeURIComponent(reminder)}`}>
              💬 {L("SMS මතක් කිරීම", "SMS reminder")}
            </a>
          )}
          {bal > 0 && (
            <Btn variant="secondary" onClick={() => navigator.clipboard?.writeText(reminder).then(() => setMsg(L("පණිවිඩය copy විය", "Message copied")))}>
              📋 {L("පණිවිඩය copy", "Copy message")}
            </Btn>
          )}
          <Btn variant="secondary" onClick={() => setMode("adjust")}>🛠 {L("නිවැරදි කිරීමක්", "Correction")}</Btn>
          <Btn variant="secondary" onClick={exportCsv}>📤 Excel</Btn>
        </div>
        {msg && <Notice tone="ok">{msg}</Notice>}
      </Card>

      <Card>
        <h3 className="mb-2 font-bold">📜 {L("ණය පොත", "Credit book")}</h3>
        {rows.length === 0 ? (
          <Empty icon="📭" text={L("තවම ගනුදෙනු නැත", "No transactions yet")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">{L("දිනය", "Date")}</th>
                  <th>{L("විස්තරය", "Details")}</th>
                  <th className="text-right">{L("මුදල", "Amount")}</th>
                  <th className="text-right">{L("ශේෂය", "Balance")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map(({ entry, running, reversed }) => (
                  <tr key={entry.id} className={`border-t border-slate-100 ${reversed ? "text-slate-400 line-through" : ""}`}>
                    <td className="py-2 pr-2 whitespace-nowrap">{new Date(entry.createdAt).toLocaleDateString()}</td>
                    <td className="pr-2">
                      <span className={`mr-1 rounded px-1.5 py-0.5 text-xs font-semibold no-underline ${entry.entryType === "SALE" ? "bg-amber-100 text-amber-800" : entry.entryType === "PAYMENT" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                        {entry.entryType === "SALE" ? L("ණයට", "Credit") : entry.entryType === "PAYMENT" ? L("ගෙවීම", "Paid") : entry.entryType === "REVERSAL" ? L("අහෝසි", "Reversal") : L("නිවැරදි", "Adjust")}
                      </span>
                      {entry.note}
                    </td>
                    <td className={`text-right font-medium ${entry.amountCents > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatRs(entry.amountCents)}</td>
                    <td className="text-right font-semibold">{formatRs(running)}</td>
                    <td className="pl-2 text-right">
                      {!reversed && entry.entryType !== "REVERSAL" && entry.entryType !== "SALE" && (
                        <button
                          className="text-xs text-rose-600 underline"
                          onClick={() => {
                            if (confirm(L("මෙම ගනුදෙනුව අහෝසි කරන්නද? (මකන්නේ නැත, ප්‍රතිවිරුද්ධ සටහනක් එකතු වේ)", "Reverse this entry? (Nothing is deleted – an opposite entry is added)"))) {
                              const e = reverseEntry(entry.id);
                              if (e) alert(e);
                            }
                          }}
                        >
                          {L("අහෝසි", "Undo")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">🔒 {L("ණය පොතේ සටහන් කිසිවිටෙක මැකෙන්නේ නැත – වැරදි නිවැරදි කරන්නේ අලුත් සටහනකින්.", "Entries are never deleted – mistakes are fixed with a new entry.")}</p>
      </Card>

      {mode && (
        <MoneyModal
          title={mode === "pay" ? L("ගෙවීමක් ලබාගන්න", "Receive payment") : L("නිවැරදි කිරීමක්", "Correction")}
          adjust={mode === "adjust"}
          balance={bal}
          onClose={() => setMode(null)}
          onSubmit={(cents, note) =>
            mode === "pay" ? addLedger(customer.id, "PAYMENT", cents, note) : addLedger(customer.id, "ADJUSTMENT", cents, note)
          }
        />
      )}
      {card && (
        <PrintModal onClose={() => setCard(false)} closeLabel={L("වසන්න", "Close")} printLabel={L("Print", "Print")}>
          <div className="grid grid-cols-2 gap-3 bg-white p-3">
            <CardFace code={customer.code} name={customer.name} shop={state.shop?.name ?? ""} />
          </div>
        </PrintModal>
      )}
    </div>
  );
}

function MoneyModal({ title, adjust, balance, onClose, onSubmit }: { title: string; adjust: boolean; balance: number; onClose: () => void; onSubmit: (cents: number, note: string) => string | null }) {
  const { L } = useStore();
  const [amount, setAmount] = useState("");
  const [sign, setSign] = useState<1 | -1>(-1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const c = toCents(amount);
    if (c === null || c === 0) return setError(L("වලංගු මුදලක් ඇතුළත් කරන්න", "Enter a valid amount"));
    const err = onSubmit(adjust ? sign * c : c, note);
    if (err) return setError(err);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
          {L("දැනට ඉතිරි ණය", "Current credit")}: <b>{formatRs(balance)}</b>
        </div>
        {adjust && (
          <div className="flex gap-2">
            <Btn variant={sign === -1 ? "primary" : "secondary"} className="flex-1" onClick={() => setSign(-1)}>➖ {L("ණය අඩු කරන්න", "Reduce credit")}</Btn>
            <Btn variant={sign === 1 ? "warn" : "secondary"} className="flex-1" onClick={() => setSign(1)}>➕ {L("ණය වැඩි කරන්න", "Increase credit")}</Btn>
          </div>
        )}
        <Field label={L("මුදල (රු.)", "Amount (Rs.)")} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
        {!adjust && (
          <Btn variant="secondary" className="w-full" onClick={() => setAmount(String(balance / 100))}>
            {L("සම්පූර්ණ ණය ගෙවීම", "Pay full balance")}
          </Btn>
        )}
        <Field label={adjust ? L("හේතුව (අනිවාර්යයි)", "Reason (required)") : L("සටහනක් (අවශ්‍ය නම්)", "Note (optional)")} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <Notice tone="err">{error}</Notice>}
        <Btn big className="w-full" onClick={submit}>✅ {L("තහවුරු කරන්න", "Confirm")}</Btn>
      </div>
    </Modal>
  );
}

function CardFace({ code, name, shop }: { code: number; name?: string; shop: string }) {
  const { L } = useStore();
  return (
    <div className="flex w-[250px] break-inside-avoid flex-col items-center rounded-xl border-2 border-dashed border-slate-400 bg-white p-3 text-center text-black">
      <div className="text-sm font-bold">{shop}</div>
      <div className="text-[11px] text-slate-600">{L("ණය පොත කාඩ්පත", "Credit card")}</div>
      <QrImage code={code} size={130} />
      <div className="text-lg font-extrabold tracking-widest">ID {code}</div>
      <div className="mt-1 h-5 w-full border-b border-slate-400 text-sm">{name}</div>
    </div>
  );
}

/** Batch of pre-printed QR cards. The shop hands them out later and links each to a name. */
function CardSheet({ onClose }: { onClose: () => void }) {
  const { state, L } = useStore();
  const start = Math.max(1000, ...state.customers.map((c) => c.code)) + 1;
  const [from, setFrom] = useState(String(start));
  const [count, setCount] = useState("12");
  const [show, setShow] = useState(false);
  const f = parseInt(from, 10);
  const n = Math.min(60, Math.max(1, parseInt(count, 10) || 1));

  if (show && f >= 1000) {
    return (
      <PrintModal onClose={() => setShow(false)} closeLabel={L("ආපසු", "Back")} printLabel={L("Print", "Print")}>
        <div className="grid grid-cols-2 gap-3 bg-white p-3 sm:grid-cols-3">
          {Array.from({ length: n }, (_, i) => (
            <CardFace key={f + i} code={f + i} shop={state.shop?.name ?? ""} />
          ))}
        </div>
      </PrintModal>
    );
  }
  return (
    <Modal title={L("QR කාඩ්පත් කට්ටලයක් print කරන්න", "Print a batch of QR cards")} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{L("කාඩ් කලින්ම print කර තබාගන්න. අලුත් පාරිභෝගිකයෙක් ආවම කාඩ් එකේ ID අංකය දාලා නමට සම්බන්ධ කරන්න. (අන්තර්ජාලය අවශ්‍ය නැත)", "Print cards in advance. When a new customer arrives, register them with the number on the card. (No internet needed)")}</p>
        <Field label={L("පළමු ID අංකය", "First ID")} value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
        <Field label={L("කාඩ් ගණන (උපරිම 60)", "How many cards (max 60)")} value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
        <Btn big className="w-full" disabled={!(f >= 1000)} onClick={() => setShow(true)}>👁 {L("පෙරදසුන් / Print", "Preview / Print")}</Btn>
      </div>
    </Modal>
  );
}
