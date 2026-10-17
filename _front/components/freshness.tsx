import { CircleAlert, Database } from "lucide-react";
import type { SourceInfo } from "@/lib/api";
import { formatRelative } from "@/lib/format";

function describe(source: SourceInfo): { text: string; problem: boolean } {
  switch (source.freshness) {
    case "imported_snapshot":
      return { text: `Imported ${formatRelative(source.last_import_at)}`, problem: false };
    case "current":
      return { text: `Checked ${formatRelative(source.last_checked_at)}`, problem: false };
    case "stale":
      return { text: `Not checked since ${formatRelative(source.last_checked_at)}`, problem: true };
    case "unavailable":
      return { text: `Source unavailable. Showing the last schedule we received`, problem: true };
    case "no_data":
      return { text: "No schedule imported yet", problem: true };
    default:
      return { text: "Last update time unknown", problem: true };
  }
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
