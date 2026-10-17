export function formatTime(iso: string | null, timeZone: string): string {
  if (!iso) return "Time to be confirmed";
  return new Intl.DateTimeFormat("en-CA", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function formatDay(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(
    new Date(iso),
  );
}

export function formatDateRange(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return start === end ? fmt.format(new Date(start)) : `${fmt.format(new Date(start))} to ${fmt.format(new Date(end))}`;
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "unknown";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function dayKey(iso: string | null, timeZone: string): string {
  if (!iso) return "tbd";
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}
