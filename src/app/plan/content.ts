export type Severity = "Critical" | "High" | "Medium";

export interface Vuln {
  title: string;
  si: string;
  risk: string;
  fix: string;
  severity: Severity;
  status: "Built" | "Planned";
}

export const vulns: Vuln[] = [
  {
    title: "Hard-coded SPREADSHEET_ID / URLs (reference file)",
    si: "Code එකේ Spreadsheet ID තැබීම",
    risk: "Anyone with the repo can read or write the shop's sheet.",
    fix: "Sheet id lives in Apps Script Script Properties; URL + shared secret live in server .env. .gitignore blocks .env*. Only .env.example is committed.",
    severity: "Critical",
    status: "Built",
  },
  {
    title: "Apps Script Web App open to 'Anyone' without auth",
    si: "Apps Script URL එකට ඕනෑම කෙනෙකුට ලිවිය හැකි වීම",
    risk: "Attacker POSTs fake payments to the mirror.",
    fix: "Browser never talks to Sheets. Only our server does, with a secret checked on every call. Sheets is a read-only mirror, Postgres is the source of truth.",
    severity: "Critical",
    status: "Built",
  },
  {
    title: "Mutable credit book (edit / delete rows)",
    si: "ණය සටහන් මකා දැමීම / වෙනස් කිරීම",
    risk: "Fraud by cashier, impossible audit trail, disputes with customers.",
    fix: "Append-only credit_ledger. Mistakes are ADJUSTMENT or REVERSAL rows (a row can only be reversed once – DB unique constraint).",
    severity: "Critical",
    status: "Built",
  },
  {
    title: "Floating-point money",
    si: "දශම (float) ගණන් හැසිරවීම",
    risk: "0.1 + 0.2 errors – the Rs. 5,000-10,000 monthly leak we promise to stop.",
    fix: "Integer cents everywhere (bigint in Postgres, number in the UI). Quantity is integer thousandths (0.25 kg = 250).",
    severity: "High",
    status: "Built",
  },
  {
    title: "Duplicate / replayed sync batches",
    si: "එකම දත්ත දෙවරක් sync වීම",
    risk: "A weak connection retries a request and a payment is counted twice.",
    fix: "Every record carries a UUID idempotency key stored in processed_events; the server skips duplicates. Each event is its own transaction.",
    severity: "High",
    status: "Built",
  },
  {
    title: "Server trusts the client's totals",
    si: "Client එක එවන ගණන් තහවුරු නොකිරීම",
    risk: "Tampered request could create a bill whose total does not match its items.",
    fix: "Server recomputes totals from line items, checks ledger rows equal total and paid, validates reversals mirror the original. Zod validates every field and bound.",
    severity: "High",
    status: "Built",
  },
  {
    title: "Open shop registration / key theft",
    si: "ඕනෑම කෙනෙකුට කඩයක් register කිරීම",
    risk: "Spam shops, storage abuse, leaked device key.",
    fix: "Optional SHOP_REGISTRATION_CODE, per-IP rate limit, device key hashed with SHA-256 and compared in constant time, per-shop rate limits. Next: key rotation + revoke from admin console.",
    severity: "High",
    status: "Built",
  },
  {
    title: "Card data storage (Phase 2)",
    si: "බැංකු කාඩ් විස්තර save කිරීම",
    risk: "PCI-DSS breach liability could end the startup.",
    fix: "Card numbers never enter our system. IPaymentGateway uses hosted tokenization (PayHere / DirectPay / WebXPay). We store only the token and send charge commands.",
    severity: "Critical",
    status: "Planned",
  },
  {
    title: "Stolen or broken shop PC",
    si: "PC එක සොරකම් වීම / කැඩීම",
    risk: "Whole credit book lost or read by a stranger.",
    fix: "Daily cloud sync + one-click restore + downloadable backup now. Next: owner PIN lock screen, auto-lock, optional on-device encryption.",
    severity: "High",
    status: "Planned",
  },
  {
    title: "Cashier abuse (undo / adjust without owner)",
    si: "කැෂියර් විසින් වැරදි ලෙස ණය අඩු කිරීම",
    risk: "Quiet 'forgiving' of a relative's debt.",
    fix: "Every entry stores the cashier name. Next: owner PIN required for Adjustment/Undo, plus a weekly 'all adjustments' report in the owner's SMS.",
    severity: "Medium",
    status: "Planned",
  },
  {
    title: "Back-dated entries (clock tampering)",
    si: "PC clock එක වෙනස් කිරීම",
    risk: "Hides overdue accounts.",
    fix: "Server stores its own received_at beside the device time. Next: flag events whose skew is more than 24 hours.",
    severity: "Medium",
    status: "Planned",
  },
  {
    title: "XSS stealing the device key from IndexedDB",
    si: "XSS මගින් device key එක ඇදීම",
    risk: "Attacker syncs as the shop.",
    fix: "No third-party scripts, React escapes output, CSV formula-injection guard, security headers. Next: strict CSP with nonces, key rotation.",
    severity: "Medium",
    status: "Planned",
  },
  {
    title: "Customer privacy (SMS reminders)",
    si: "පාරිභෝගික දත්ත / SMS කැමැත්ත",
    risk: "Sri Lanka's PDPA (Act No. 9 of 2022) requires lawful basis and consent.",
    fix: "Opt-in flag per customer, minimal data (name, phone), message shows only the balance. Provide data-export & delete-request workflow.",
    severity: "Medium",
    status: "Planned",
  },
  {
    title: "Dependency supply-chain",
    si: "Library security",
    risk: "Vulnerable npm package.",
    fix: "Lockfile, npm audit in CI, Dependabot, minimal dependencies (zod, qrcode only).",
    severity: "Medium",
    status: "Planned",
  },
];

export interface Milestone {
  id: string;
  title: string;
  si: string;
  when: string;
  status: "Done" | "Next" | "Later";
  items: string[];
}

export const milestones: Milestone[] = [
  {
    id: "M1",
    title: "Offline POS + Credit Book (MVP)",
    si: "Offline POS සහ ණය පොත",
    when: "Weeks 1-4 · built in this repo",
    status: "Done",
    items: [
      "IndexedDB local DB, works with zero internet, installable PWA",
      "Customer ID (4+ digits) + offline QR generation + printable pre-printed card sheets + camera/USB scan",
      "Running balance: previous + today's bill - paid today = remaining; receipt prints all four numbers",
      "Append-only ledger with Undo (reversal) and Correction (adjustment)",
      "Sinhala / English toggle, big-button UI, daily report, Excel CSV export",
    ],
  },
  {
    id: "M2",
    title: "Cloud sync + Sheets mirror",
    si: "Cloud sync සහ Google Sheets",
    when: "Weeks 3-5 · built, needs field test",
    status: "Done",
    items: [
      "Outbox queue, idempotent /api/sync, per-event transactions, rejection handling UI",
      "3NF Postgres schema, restore-from-cloud snapshot",
      "ISyncProvider + GoogleSheetsSyncAdapter (docs/apps-script.gs), secrets only in env",
    ],
  },
  {
    id: "M3",
    title: "Owner trust & fraud controls",
    si: "අයිතිකරුගේ විශ්වාසය",
    when: "Weeks 6-8",
    status: "Next",
    items: [
      "Owner PIN lock + cashier role (cannot adjust or undo)",
      "Weekly owner summary: adjustments, reversals, overdue list",
      "Clock-skew flag, device key rotation, CSP with nonces",
      "Import backup file, multi-language receipts",
    ],
  },
  {
    id: "M4",
    title: "Pilot with 5 villages shops",
    si: "ගම් 5ක කඩ 5ක පරීක්ෂණය",
    when: "Weeks 8-12",
    status: "Next",
    items: [
      "Run on real old PCs / Android tablets with real printers",
      "Measure: bill time, ledger errors found, owner satisfaction",
      "Fix the top 10 friction points, record a 3-minute Sinhala training video",
      "Prove the Rs. 5,000-10,000/month error leak is stopped",
    ],
  },
  {
    id: "M5",
    title: "Automatic reminders",
    si: "ස්වයංක්‍රීය SMS මතක් කිරීම",
    when: "Weeks 12-16",
    status: "Later",
    items: [
      "Server job after each sync: customers 30+ days unpaid -> Sinhala SMS via a local SMS gateway",
      "Customer opt-in, daily cap, STOP keyword",
      "Cost per SMS added to the Rs. 1,990 plan or passed through",
    ],
  },
  {
    id: "M6",
    title: "Card / bank auto-debit (Phase 2)",
    si: "බැංකු කාඩ් ගෙවීම්",
    when: "Months 5-7",
    status: "Later",
    items: [
      "Choose gateway (PayHere recurring / DirectPay / WebXPay) after a sandbox spike",
      "Hosted tokenization page, store token only, charge command on due date",
      "Gateway webhook -> PAYMENT ledger row; reconciliation report; legal review of customer consent",
    ],
  },
  {
    id: "M7",
    title: "Scale-out",
    si: "විශාල කිරීම",
    when: "Months 7-12",
    status: "Later",
    items: [
      "Multi-device per shop (device-scoped ID ranges, CRDT-free: ledger is append-only so merges are trivial)",
      "Android wrapper (Capacitor/TWA), Bluetooth thermal printing",
      "Admin console, billing, supplier orders, stock alerts",
    ],
  },
];

export const scalability = [
  ["Data model", "Append-only ledger + UUID keys means any number of devices can create rows offline and merge without conflicts."],
  ["Sync", "Batches of 100 events, each idempotent. Safe to retry on 2G. Add a pull cursor (since=timestamp) when multi-device arrives."],
  ["Database", "Partition credit_ledger and audit_log by month once a table passes ~50M rows. Indexes exist on (customer, date) and shop."],
  ["Compute", "Stateless Next.js routes - run N instances behind a load balancer. Replace the in-memory rate limiter with Redis at that point."],
  ["Integrations", "ISyncProvider and IPaymentGateway are the only extension points; adding Supabase, Firebase, or PayHere never touches services."],
  ["Cost", "At 1,000 shops x ~100 events/day = 100k writes/day - a single small Postgres instance. Sheets is optional and capped per shop."],
];

export const securityPlan = [
  ["Secrets", "Only env vars. .env* ignored by git, .env.example documents names. Rotate any secret that was ever pasted into chat or code."],
  ["Authentication", "Per-shop device key (256-bit random, shown once, stored hashed). Owner PIN for sensitive actions (M3)."],
  ["Validation", "Zod schemas on every payload, hard numeric bounds, server-side recomputation of totals."],
  ["Integrity", "Append-only ledger, unique constraint on reversals, idempotency keys, per-event DB transactions."],
  ["Transport", "HTTPS only in production, security headers on every response, API responses never cached by the service worker."],
  ["Abuse", "Rate limits on registration, sync, snapshot. Request size cap."],
  ["Audit", "audit_log row for every applied event. Server time stored next to device time."],
  ["Privacy", "Data minimisation, opt-in SMS, export + delete workflow (PDPA)."],
  ["Payments", "No card data ever (PCI-DSS SAQ-A scope through hosted tokenization)."],
  ["Process", "Dependabot + npm audit in CI, code review on ledger code, restore drill every release."],
];

export const businessCase = [
  "Rs. 5,000 starter kit (old PC/tablet + printer is the shop's own) then Rs. 1,990 / month.",
  "Selling line: 'The book can't be wrong and nobody argues about the bill'. A printed receipt shows previous credit, today, paid, remaining.",
  "Break-even for the owner: avoiding a single Rs. 5,000 counting error per month pays 2.5 months of the plan.",
  "Our unit economics: 100 shops = Rs. 199,000 / month recurring; Postgres + hosting stays well under 10% of that.",
  "Sri Lankan tip: let the owner's spouse / child use the Sinhala UI with the same simple 5 tabs - training takes 10 minutes.",
];

export const ceoPrompt = `You are the CEO of a small engineering team (UI/UX, Frontend, Backend, QA, DevOps). We are a cash-poor startup building "Naya Potha": an offline-first POS and digital credit book for village grocery shops in Sri Lanka.

REVIEW FIRST (do not write the whole app yet):
1. Read D:\\My Projects\\New folder\\New Text Document.txt for the simple Sinhala CRUD workflow only. Do NOT copy its hard-coded SPREADSHEET_ID or tightly coupled UI/data code.
2. Review the repository for these vulnerabilities and report status for each: hard-coded ids/secrets, open Apps Script endpoint, mutable ledger, float money, duplicate sync, client-trusted totals, open registration, card data storage, stolen PC, cashier abuse, clock tampering, XSS on device key, PDPA consent, dependency risk.

PRODUCT RULES
- Customers: 4+ digit ID (QR = "NP-<id>"), QR generated offline or from pre-printed cards. Cash customers need no registration.
- Running balance: Remaining = Previous credit + Today's bill - Paid today. Receipt prints all four.
- UX: ultra simple, big buttons, 5 tabs (Sell, Credit book, Items, Reports, Sync), Sinhala/English toggle, no jargon.
- Price: shop pays Rs. 5,000 once then Rs. 1,990/month; we must prove accuracy and show daily profit.

ENGINEERING RULES
- Layered architecture like Spring Boot: Controller (route) -> Service -> Repository / Adapter. Interfaces: ISyncProvider (Postgres primary, GoogleSheetsSyncAdapter mirror), IPaymentGateway (CashCreditAdapter now; PayHere / DirectPay / WebXPay tokenization in Phase 2).
- 3NF schema, integer cents only, append-only credit_ledger (ADJUSTMENT / REVERSAL), idempotency keys, audit log, server time beside device time.
- Secrets only in env / Apps Script Script Properties; strong .gitignore; commit .env.example only.
- Never store card numbers; store gateway tokens only.

DELIVER (planning only, max 2 pages each)
1. Architecture diagram (mermaid): offline app -> outbox -> API -> services -> repositories -> Postgres, plus Sheets mirror and payment gateway adapters.
2. Milestones with acceptance tests for M3 (owner PIN, fraud controls), M4 (5-shop pilot), M5 (SMS reminders), M6 (card auto-debit), M7 (scale-out).
3. Security plan and threat model updates, ranked by severity.
4. Scalability plan for 1,000+ shops and multi-device shops.
5. Simple UI wireframes (Sinhala + English) for Sell, Credit settlement, and Reports.
Then wait for approval before coding.`;
