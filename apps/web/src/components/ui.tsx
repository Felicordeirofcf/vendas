import type { ComponentProps, ReactNode } from "react";

export function Card({ className = "", ...p }: ComponentProps<"section">) {
  return <section className={`rounded-2xl border border-line bg-white p-5 ${className}`} {...p} />;
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-bold">{children}</h2>
      {right ? <div className="text-xs text-muted">{right}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink min-h-10";
export const btnCls =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 cursor-pointer";
export const btnGhostCls =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-ink cursor-pointer";
export const btnSmCls =
  "inline-flex min-h-8 items-center justify-center rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink hover:border-ink cursor-pointer";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Pill({ children, tone = "line" }: { children: ReactNode; tone?: "line" | "dark" | "accent" | "warn" | "ok" }) {
  const map = {
    line: "border border-line text-ink",
    dark: "bg-ink text-white",
    accent: "tint text-ink",
    warn: "bg-amber-100 text-amber-900",
    ok: "bg-green-100 text-green-900",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${map[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}
