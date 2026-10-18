import type { Change } from "./api";
import { formatTime } from "./format";

// Shared wording for match changes in Updates, match history and change badges.

type Pair = [string | null, string | null] | undefined;

/** True when only the estimated start moved and the official time stayed put. */
export function isEstimateOnly(c: Change): boolean {
  if (c.event_type !== "time_changed") return false;
  const official = c.diff.scheduled_start as Pair;
  const estimate = c.diff.estimated_start as Pair;
  return (
    (!official || official[0] === official[1]) &&
    !!estimate &&
    estimate[0] !== estimate[1]
  );
}

export function changeTitle(c: Change): string | null {
  if (isEstimateOnly(c)) return "Estimated start changed";
  if (c.event_type === "delay_cleared" || isClearedDelay(c))
    return "Court delay cleared";
  if (c.event_type === "delay_notice") {
    if (c.notice === "expired") return "Court delay notice (expired)";
    if (c.notice === "superseded") return "Court delay notice (replaced)";
    return "Court delay notice";
  }
  return null;
}

function isClearedDelay(c: Change) {
  return c.event_type === "delay_notice" && !Number(c.diff.minutes);
}

export function timeChangeText(c: Change, timeZone: string): string {
  const official = c.diff.scheduled_start as Pair;
  const estimate = c.diff.estimated_start as Pair;
  if (isEstimateOnly(c)) {
    if (!estimate![1])
      return `Estimate withdrawn. Official start ${formatTime(official?.[1] ?? null, timeZone)}.`;
    const was = estimate![0]
      ? ` (was ~${formatTime(estimate![0], timeZone)})`
      : "";
    return `Estimated start ~${formatTime(estimate![1], timeZone)}${was}. Official time unchanged.`;
  }
  return `Now ${formatTime(official?.[1] ?? null, timeZone)} (was ${formatTime(official?.[0] ?? null, timeZone)}).`;
}

export function delayText(c: Change, timeZone: string): string {
  if (c.event_type === "delay_cleared" || isClearedDelay(c))
    return "Staff cleared the court delay. The official start applies.";
  const minutes = String(c.diff.minutes);
  const expires = c.diff.expires_at as string | undefined;
  const state =
    c.notice ??
    (expires && Date.parse(expires) <= Date.now() ? "expired" : "active");
  if (state === "expired")
    return `Court was running ~${minutes} min late. This notice expired${expires ? ` at ${formatTime(expires, timeZone)}` : ""}.`;
  if (state === "superseded")
    return `Court was running ~${minutes} min late. A newer notice replaced this one.`;
  return `Court running ~${minutes} min late${expires ? ` until ${formatTime(expires, timeZone)}` : ""}. Official start remains unchanged.`;
}
