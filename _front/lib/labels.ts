"use client";

import { useCallback } from "react";
import { readStored, useStored, writeStored } from "./local-store";

// Private team labels ("Maya's team") live on this device next to guest follows and are
// never sent to the API. Keyed by canonical entry id, one map per event.
const KEY = (eventId: string) => `courtside:labels:${eventId}`;
const MAX_LENGTH = 40;
const EMPTY: Labels = {};

export type Labels = Readonly<Record<string, string>>;

function parseLabels(raw: unknown): Labels {
  const labels: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw)) {
      if (typeof value === "string" && value.trim()) labels[id] = value;
    }
  }
  return labels;
}

export function cleanLabel(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
}

export const LABEL_MAX_LENGTH = MAX_LENGTH;

export function useLabels(eventId: string) {
  const labels = useStored(KEY(eventId), parseLabels, EMPTY);
  // An empty label removes it, so editing to blank and "Remove" behave the same.
  const setLabel = useCallback(
    (entryId: string, text: string) => {
      const next: Record<string, string> = { ...readStored(KEY(eventId), parseLabels, EMPTY) };
      const clean = cleanLabel(text);
      if (clean) next[entryId] = clean;
      else delete next[entryId];
      writeStored(KEY(eventId), Object.keys(next).length ? next : null);
    },
    [eventId],
  );
  const removeLabel = useCallback((entryId: string) => setLabel(entryId, ""), [setLabel]);
  return { labels, labelFor: (entryId: string | null | undefined) => (entryId ? labels[entryId] : undefined), setLabel, removeLabel };
}
