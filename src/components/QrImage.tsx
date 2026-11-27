"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR is generated fully in the browser – no internet needed. Payload format: NP-<customer id> */
export const qrPayload = (code: number) => `NP-${code}`;

export function QrImage({ code, size = 160 }: { code: number; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(qrPayload(code), { margin: 1, width: size * 2, errorCorrectionLevel: "M" }).then((u) => {
      if (alive) setSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [code, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} width={size} height={size} alt={`QR ${code}`} /> : <div style={{ width: size, height: size }} className="animate-pulse rounded bg-slate-100" />;
}

export function parseScanned(text: string): number | null {
  const m = text.trim().match(/^(?:NP-?)?(\d{4,8})$/i);
  return m ? parseInt(m[1], 10) : null;
}
