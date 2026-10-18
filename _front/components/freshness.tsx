import { CircleAlert, Database } from "lucide-react";
import type { Freshness, SourceInfo } from "@/lib/api";
import { formatRelative } from "@/lib/format";

/** Freshness values that mean attendees may be looking at an out-of-date schedule. */
const PROBLEMS: Freshness[] = ["stale", "paused", "unavailable"];

function describe(source: SourceInfo): { text: string; problem: boolean } {
  switch (source.freshness) {
    case "imported_snapshot":
      return { text: `Imported ${formatRelative(source.last_import_at)}`, problem: false };
    case "current":
      return { text: `Checked ${formatRelative(source.last_checked_at)}`, problem: false };
    case "stale":
      return { text: `Not checked since ${formatRelative(source.last_checked_at)}`, problem: true };
    case "paused":
      return { text: `Updates paused. Showing the last schedule we received`, problem: true };
    case "unavailable":
      return { text: `Source unavailable. Showing the last schedule we received`, problem: true };
    case "no_data":
      return { text: "No schedule imported yet", problem: true };
    default:
      return { text: "Last update time unknown", problem: true };
  }
}

/** Short per-card label: when the source itself was last checked, not when the record changed. */
export function checkedLabel(freshness: Freshness, lastChecked: string | null | undefined) {
  if (freshness === "imported_snapshot") return "Imported snapshot";
  if (!lastChecked) return "Not checked yet";
  const when = formatRelative(lastChecked);
  switch (freshness) {
    case "stale":
      return `Not checked since ${when}`;
    case "paused":
      return `Updates paused · last checked ${when}`;
    case "unavailable":
      return `Source unavailable · last checked ${when}`;
    default:
      return `Checked ${when}`;
  }
}

function warningText(source: SourceInfo) {
  const checked = source.last_checked_at
    ? ` (last checked ${formatRelative(source.last_checked_at)})`
    : "";
  switch (source.freshness) {
    case "stale":
      return `${source.name} hasn’t been checked since ${formatRelative(source.last_checked_at)}. Times and courts may have changed.`;
    case "paused":
      return `Updates from ${source.name} are paused. Showing the last schedule we received${checked}.`;
    default:
      return `${source.name} is unavailable. Showing the last schedule we received${checked}.`;
  }
}

/**
 * Compact warning shown above a schedule when any of its sources is stale, paused or down.
 * Renders nothing while every source is healthy, so it can sit at the top of any screen.
 */
export function SourceWarning({
  sources,
  label,
}: {
  sources: SourceInfo[] | undefined;
  label?: string;
}) {
  const problems = sources?.filter((s) => PROBLEMS.includes(s.freshness)) ?? [];
  if (!problems.length) return null;
  return (
    <div role="status" className="source-warning">
      {problems.map((s) => (
        <p key={s.id}>
          <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {label && <strong>{label}: </strong>}
            {warningText(s)}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Where the schedule came from and how old it is. Never claims "live" for an import. */
export function FreshnessNote({ sources }: { sources: SourceInfo[] | undefined }) {
  if (!sources?.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-xs text-muted" aria-label="Data sources">
      {sources.map((s) => {
        const { text, problem } = describe(s);
        return (
          <li key={s.id} className={`flex items-start gap-1 ${problem ? "font-medium text-warn" : ""}`}>
            {problem ? (
              <CircleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <Database aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {s.name}: {text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
