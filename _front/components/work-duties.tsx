import { Whistle } from "lucide-react";
import type { Match, WorkDuty } from "@/lib/api";
import { formatDay, formatTime } from "@/lib/format";
import { SectionTitle } from "./ui";

const side = (p: Match["home"]) => p.team_name ?? p.placeholder ?? "TBD";

export function WorkDuties({
  duties,
  matches,
  showTeam,
}: {
  duties: WorkDuty[];
  matches: Record<string, Match>;
  showTeam: boolean;
}) {
  if (duties.length === 0) return null;
  return (
    <section aria-labelledby="work-duties">
      <SectionTitle>
        <span id="work-duties">Work duties</span>
      </SectionTitle>
      <ul className="space-y-2">
        {duties.map(({ match_id, entry_id }) => {
          const match = matches[match_id];
          const start = match.scheduled_start ?? match.estimated_start;
          return (
            <li key={`${match_id}-${entry_id}`} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
              <Whistle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
              <div>
                <p className="font-semibold text-foreground">
                  Work duty: referee {side(match.home)} vs {side(match.away)}
                  {match.court ? `, ${match.court.label}` : ""}, {formatTime(start, match.timezone)}
                </p>
                <p className="text-sm text-muted">
                  {[
                    showTeam ? match.work_entry?.team_name : null,
                    match.court?.venue_name,
                    formatDay(start, match.timezone),
                    match.round_label,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
