import type { LedgerEntry } from "./types";

const DAY = 86_400_000;

export function balanceMap(ledger: LedgerEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of ledger) m.set(e.customerId, (m.get(e.customerId) ?? 0) + e.amountCents);
  return m;
}

export interface LedgerRow {
  entry: LedgerEntry;
  running: number;
  reversed: boolean;
}

/** Entries for one customer, oldest first, each with the running balance after it. */
export function ledgerRows(ledger: LedgerEntry[], customerId: string): LedgerRow[] {
  const mine = ledger
    .filter((e) => e.customerId === customerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const reversedIds = new Set(mine.map((e) => e.reversesEntryId).filter(Boolean) as string[]);
  let running = 0;
  return mine.map((entry) => {
    running += entry.amountCents;
    return { entry, running, reversed: reversedIds.has(entry.id) };
  });
}

export function lastPaymentAt(ledger: LedgerEntry[], customerId: string): string | null {
  const rows = ledgerRows(ledger, customerId).filter(
    (r) => r.entry.entryType === "PAYMENT" && !r.reversed,
  );
  return rows.length ? rows[rows.length - 1].entry.createdAt : null;
}

/** Days since the customer last paid (or since their first credit if they never paid). 0 if nothing owed. */
export function daysOverdue(ledger: LedgerEntry[], customerId: string, balance: number, now = Date.now()): number {
  if (balance <= 0) return 0;
  const paid = lastPaymentAt(ledger, customerId);
  const first = ledger
    .filter((e) => e.customerId === customerId && e.entryType === "SALE")
    .map((e) => e.createdAt)
    .sort()[0];
  const ref = paid ?? first;
  return ref ? Math.max(0, Math.floor((now - new Date(ref).getTime()) / DAY)) : 0;
}
