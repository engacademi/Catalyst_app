import { ApiError } from "@/lib/api";
import type { ReactNode } from "react";
import { AlertTriangle, Loader2, Volleyball } from "lucide-react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const padding = /(?:^|\s)p-/.test(className) ? "" : "p-5 sm:p-6";
  return (
    <div
      className={`ui-card border border-border bg-surface ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-title flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold tracking-tight text-foreground">
        {children}
      </h2>
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

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p
      role="status"
      className="loading-state flex items-center gap-3 text-sm text-muted"
    >
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> {label}…
    </p>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : "Something went wrong";
  return (
    <div
      role="alert"
      className="my-4 flex gap-2 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
    >
      <AlertTriangle aria-hidden className="h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{error instanceof ApiError && [401,403].includes(error.status) ? "Account access needs attention" : "Couldn’t load this right now."}</p>
        <p>{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state text-center">
      <div className="empty-state-icon">
        <Volleyball aria-hidden size={28} strokeWidth={1.5} />
      </div>
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageTitle({
  children,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <h1 className="font-display">{children}</h1>
    </div>
  );
}
