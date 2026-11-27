/** All money is integer cents. Never use floating point for amounts. */

export function toCents(input: string): number | null {
  const t = input.replace(/[,\s]/g, "").replace(/^rs\.?/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const v = parseInt(whole, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  return Number.isSafeInteger(v) && v <= 100_000_000_000 ? v : null;
}

export function formatRs(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = abs % 100;
  const body = frac === 0 ? whole : `${whole}.${frac.toString().padStart(2, "0")}`;
  return `${neg ? "-" : ""}Rs. ${body}`;
}

/** Plain number string for inputs: 125050 -> "1250.5" */
export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  return frac === 0 ? String(whole) : `${whole}.${frac.toString().padStart(2, "0").replace(/0$/, "")}`;
}

/** Quantity in thousandths (1000 = 1 unit) so 0.25 kg is exact. */
export function toMilli(input: string): number | null {
  const t = input.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const v = parseInt(whole, 10) * 1000 + parseInt((frac + "000").slice(0, 3), 10);
  return v > 0 && v <= 10_000_000 ? v : null;
}

export function formatQty(milli: number): string {
  const whole = Math.floor(milli / 1000);
  const frac = milli % 1000;
  return frac === 0 ? String(whole) : `${whole}.${frac.toString().padStart(3, "0").replace(/0+$/, "")}`;
}

export function lineTotal(qtyMilli: number, priceCents: number): number {
  return Math.round((qtyMilli * priceCents) / 1000);
}

export function uuid(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
