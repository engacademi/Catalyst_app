"use client";

import { Star } from "lucide-react";
import { useFollows } from "@/lib/follows";

export function FollowButton({ eventId, entryId, teamName }: { eventId: string; entryId: string; teamName: string }) {
  const { isFollowing, toggle } = useFollows(eventId);
  const on = isFollowing(entryId);
  return (
    <button
      type="button"
      onClick={() => toggle(entryId)}
      aria-pressed={on}
      aria-label={on ? `Unfollow ${teamName}` : `Follow ${teamName}`}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-3 text-sm font-medium ${
        on ? "border-brand bg-brand text-white" : "border-border bg-surface text-brand-strong hover:border-brand"
      }`}
    >
      <Star aria-hidden className={`h-4 w-4 ${on ? "fill-current" : ""}`} />
      {on ? "Following" : "Follow"}
    </button>
  );
}
