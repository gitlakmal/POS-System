import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "නය පොත · Naya Potha",
  description: "Offline-first POS and digital credit book for village grocery shops.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#065f46",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="si">
      <body className="text-slate-900 antialiased">{children}</body>
    </html>
  );
}
