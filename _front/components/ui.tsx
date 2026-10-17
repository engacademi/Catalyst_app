import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface p-4 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

type Tone = "neutral" | "brand" | "warn" | "danger" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-background text-muted border-border",
  brand: "bg-brand-soft text-brand-strong border-brand/30",
  warn: "bg-warn-soft text-warn border-warn/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/30",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted">
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> {label}…
    </p>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div role="alert" className="my-4 flex gap-2 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
      <AlertTriangle aria-hidden className="h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">Couldn&apos;t load this right now.</p>
        <p>{message}. We&apos;ll keep trying. Nothing here means the schedule is empty.</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
