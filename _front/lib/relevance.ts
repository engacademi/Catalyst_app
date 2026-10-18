import type { Announcement, Change } from "./api";

// One rule decides what a guest sees in Updates, on the event overview and in the
// unread counts. It runs on the device, so the server never learns who follows what.

export type Audience = {
  /** The guest saved the whole event, so everything is relevant. */
  savedEvent: boolean;
  /** Followed team ids, including teams of followed divisions when known. */
  entryIds: string[];
  divisionIds: string[];
};

/** Builds an audience from the raw follow list stored on the device. */
export function audienceFrom(
  follows: string[],
  savedEvent: boolean,
  expandedEntryIds: string[] = [],
): Audience {
  return {
    savedEvent,
    entryIds: [
      ...new Set([
        ...follows.filter((id) => !id.startsWith("division:")),
        ...expandedEntryIds,
      ]),
    ],
    divisionIds: follows
      .filter((id) => id.startsWith("division:"))
      .map((id) => id.slice(9)),
  };
}

type Target = {
  isAnnouncement: boolean;
  /** For notices: every targeted team, so a team follow covers its division. */
  entryIds: string[];
  divisionId: string | null | undefined;
};

function relevant(t: Target, a: Audience): boolean {
  if (a.savedEvent) return true;
  if (t.isAnnouncement && !t.divisionId && t.entryIds.length === 0) return true;
  if (t.entryIds.some((id) => a.entryIds.includes(id))) return true;
  return !!t.divisionId && a.divisionIds.includes(t.divisionId);
}

/** `divisions` maps match ids to their division, as the change feed returns it. */
export function isRelevantChange(
  c: Change,
  a: Audience,
  divisions?: Record<string, string>,
): boolean {
  return relevant(
    {
      isAnnouncement: c.entity_type === "announcement",
      entryIds: c.entry_ids,
      divisionId: c.division_id ?? divisions?.[c.entity_id],
    },
    a,
  );
}

export function isRelevantAnnouncement(n: Announcement, a: Audience): boolean {
  return relevant(
    {
      isAnnouncement: true,
      entryIds: n.entry_ids ?? (n.entry_id ? [n.entry_id] : []),
      divisionId: n.division_id,
    },
    a,
  );
}
