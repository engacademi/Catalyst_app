import type { ReactNode } from "react";

export const inputClass = "min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function PrimaryButton({ children, pending, disabled }: { children: ReactNode; pending?: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="min-h-11 rounded-full bg-brand px-5 font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function SmallButton({
  children,
  onClick,
  tone = "neutral",
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "neutral" | "brand" | "danger";
  disabled?: boolean;
}) {
  const tones = {
    neutral: "border-border text-foreground",
    brand: "border-brand bg-brand text-white",
    danger: "border-danger/40 text-danger",
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`min-h-9 rounded-full border px-3 text-sm font-medium disabled:opacity-50 ${tones[tone]}`}>
      {children}
    </button>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {error instanceof Error ? error.message : "Something went wrong"}
    </p>
  );
}
