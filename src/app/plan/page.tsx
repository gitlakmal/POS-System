import type { Metadata } from "next";
import Link from "next/link";
import { businessCase, ceoPrompt, milestones, scalability, securityPlan, vulns, type Severity } from "./content";
import { CopyButton } from "./CopyButton";

export const metadata: Metadata = { title: "Project plan · Naya Potha" };

const sev: Record<Severity, string> = {
  Critical: "bg-rose-100 text-rose-800",
  High: "bg-amber-100 text-amber-800",
  Medium: "bg-sky-100 text-sky-800",
};
const mstone = { Done: "bg-emerald-600 text-white", Next: "bg-amber-500 text-white", Later: "bg-slate-300 text-slate-700" };

function Section({ id, title, si, children }: { id: string; title: string; si: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-2xl font-extrabold text-emerald-900">{title}</h2>
      <p className="mb-4 text-slate-500">{si}</p>
      {children}
    </section>
  );
}

export default function PlanPage() {
  const built = vulns.filter((v) => v.status === "Built").length;
  return (
    <div className="min-h-screen bg-[#f1f5f2]">
      <header className="bg-gradient-to-br from-emerald-800 to-teal-600 px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-sm text-emerald-100 underline">← Back to the app · යෙදුමට ආපසු</Link>
          <h1 className="mt-3 text-4xl font-extrabold">නය පොත · Project plan</h1>
          <p className="mt-2 max-w-2xl text-emerald-50">
            Vulnerability review, milestones, scalability and security plans, and the prompt to hand to the OpenBot CEO. Everything marked <b>Built</b> already exists in this codebase.
          </p>
          <nav className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
            {[["#vulns", "Vulnerabilities"], ["#milestones", "Milestones"], ["#scale", "Scalability"], ["#security", "Security"], ["#ux", "UX & business"], ["#ceo", "CEO prompt"]].map(([h, l]) => (
              <a key={h} href={h} className="rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">{l}</a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        <Section id="vulns" title="1. Vulnerability review" si="අවදානම් සමාලෝචනය">
          <p className="mb-4 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <b>{built}</b> of <b>{vulns.length}</b> risks are already mitigated in code; the rest are scheduled in the milestones below.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {vulns.map((v) => (
              <article key={v.title} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${sev[v.severity]}`}>{v.severity}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${v.status === "Built" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{v.status}</span>
                </div>
                <h3 className="font-bold text-slate-900">{v.title}</h3>
                <p className="text-sm text-slate-500">{v.si}</p>
                <p className="mt-2 text-sm"><b className="text-rose-700">Risk:</b> {v.risk}</p>
                <p className="mt-1 text-sm"><b className="text-emerald-700">Fix:</b> {v.fix}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section id="milestones" title="2. Milestones" si="ව්‍යාපෘති මීල්ස්ටෝන්">
          <ol className="relative space-y-4 border-l-4 border-emerald-200 pl-6">
            {milestones.map((m) => (
              <li key={m.id} className="relative rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <span className="absolute -left-[38px] top-4 grid size-8 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white">{m.id}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold">{m.title}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${mstone[m.status]}`}>{m.status}</span>
                </div>
                <p className="text-sm text-slate-500">{m.si} · {m.when}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {m.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="scale" title="3. Scalability plan" si="විශාල කිරීමේ සැලැස්ම">
          <div className="grid gap-3 md:grid-cols-2">
            {scalability.map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><h3 className="font-bold text-emerald-800">{t}</h3><p className="text-sm text-slate-700">{d}</p></div>
            ))}
          </div>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs leading-5 text-emerald-100">{`Shop PC / tablet (PWA)                         Cloud (Next.js, stateless)
┌────────────────────────┐   HTTPS batch   ┌───────────────────────────────────────┐
│ React UI  (5 tabs, SI/EN)│ ──────────────▶ │ Controller  /api/shops /api/sync      │
│ Store ▸ IndexedDB (local)│   idempotent    │      ▼                                │
│ Outbox queue             │ ◀────────────── │ Service   SyncService (validation)    │
│ Offline QR + receipts    │   per-event ack │      ▼                                │
└────────────────────────┘                 │ Repository PgSyncRepository (3NF)     │
                                            │      ▼                                │
                                            │ PostgreSQL  credit_ledger (append-only)│
                                            │      ├─▶ ISyncProvider ▸ Google Sheets │
                                            │      └─▶ IPaymentGateway ▸ PayHere…   │
                                            └───────────────────────────────────────┘`}</pre>
        </Section>

        <Section id="security" title="4. Security plan" si="ආරක්ෂණ සැලැස්ම">
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {securityPlan.map(([t, d], i) => (
              <div key={t} className={`grid gap-1 p-4 md:grid-cols-[160px_1fr] ${i ? "border-t border-slate-100" : ""}`}>
                <b className="text-emerald-800">{t}</b>
                <span className="text-sm text-slate-700">{d}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="ux" title="5. Simple UI/UX & how to win the shop owner" si="සරල UI සහ කඩ අයිතිකරු දිනා ගැනීම">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <h3 className="mb-2 font-bold text-emerald-800">UX rules we follow</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>Five tabs only: Sell · Credit book · Items · Reports · Sync.</li>
                <li>One screen = one job. Big touch targets, Sinhala first, English one tap away.</li>
                <li>The credit customer flow is scan/type ID → add items → type cash paid → remaining credit shown in amber → print.</li>
                <li>Never show jargon: &quot;ledger&quot; is &quot;ණය පොත&quot;; offline is a green reassurance message, not an error.</li>
                <li>Partial payment works on the running balance, so there is no need to match cash to specific items. Per-bill aging can be added later from the same ledger.</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <h3 className="mb-2 font-bold text-emerald-800">Why the owner says yes</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{businessCase.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          </div>
        </Section>

        <Section id="ceo" title="6. Open-source-friendly CEO prompt" si="OpenBot CEO ට දීමට prompt එක">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm text-slate-500">Paste into the OpenBot CEO chat together with the reference file. It asks for planning first, then waits for your approval.</p>
              <CopyButton text={ceoPrompt} />
            </div>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-800">{ceoPrompt}</pre>
          </div>
        </Section>
      </main>
    </div>
  );
}
