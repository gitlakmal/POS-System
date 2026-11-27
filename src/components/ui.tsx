"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "warn";

const variants: Record<Variant, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/30",
  secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50",
  ghost: "bg-transparent text-emerald-800 hover:bg-emerald-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  warn: "bg-amber-500 text-white hover:bg-amber-600",
};

export function Btn({
  variant = "primary",
  big = false,
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean }) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        big ? "px-5 py-4 text-lg" : "px-4 py-2.5 text-base"
      } ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>;
}

export function Field({
  label,
  hint,
  className = "",
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>}
      <input
        {...p}
        className="w-full rounded-xl border-0 bg-white px-3 py-3 text-base text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "err" | "info"; children: ReactNode }) {
  const c = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    err: "bg-rose-50 text-rose-800 ring-rose-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
  }[tone];
  return <div className={`rounded-xl px-3 py-2 text-sm ring-1 ${c}`}>{children}</div>;
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-end bg-slate-900/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Renders printable content straight into <body> so the app chrome (.no-print) is hidden while printing. */
export function PrintModal({ onClose, children, closeLabel, printLabel }: { onClose: () => void; children: ReactNode; closeLabel: string; printLabel: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="print-area fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="mx-auto w-fit max-w-full">
        <div className="no-print mb-3 flex justify-center gap-2">
          <Btn onClick={() => window.print()}>🖨️ {printLabel}</Btn>
          <Btn variant="secondary" onClick={onClose}>{closeLabel}</Btn>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="grid place-items-center gap-2 py-10 text-center text-slate-500">
      <div className="text-4xl">{icon}</div>
      <p>{text}</p>
    </div>
  );
}
