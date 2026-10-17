"use client";

import { useCallback } from "react";
import { readStored, useStored, writeStored } from "./local-store";

// Guest follows stay on this device. The ids are canonical entry ids from the API, so a
// later sign-in can merge them into an account without guessing.
const KEY = (eventId: string) => `courtside:follows:${eventId}`;
const DIVISION_KEY = (eventId: string) => `courtside:division-follows:${eventId}`;
const EMPTY: string[] = [];

const parseIds = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : EMPTY;

function useIdList(key: string) {
  const ids = useStored(key, parseIds, EMPTY);
  const toggle = useCallback(
    (id: string) => {
      const current = readStored(key, parseIds, EMPTY);
      writeStored(key, current.includes(id) ? current.filter((v) => v !== id) : [...current, id]);
    },
    [key],
  );
  return { ids, isFollowing: (id: string) => ids.includes(id), toggle };
}

export function useFollows(eventId: string) {
  return useIdList(KEY(eventId));
}

// Followed divisions, stored next to the followed entries and just as local.
export function useDivisionFollows(eventId: string) {
  return useIdList(DIVISION_KEY(eventId));
}

const parseSeen = (raw: unknown): number => (typeof raw === "number" ? raw : Number(raw) || 0);

// The last change the guest has seen, so Updates can mark new items. Local only.
export function useLastSeen(eventId: string) {
  const key = `courtside:seen:${eventId}`;
  const lastSeen = useStored(key, parseSeen, 0);
  const markSeen = useCallback((id: number) => writeStored(key, id), [key]);
  return { lastSeen, markSeen };
}
