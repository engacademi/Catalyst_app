"use client";

import { Star } from "lucide-react";
import { useDivisionFollows } from "@/lib/follows";

export function FollowDivisionButton({ eventId, divisionId, name }: { eventId: string; divisionId: string; name: string }) {
  const { isFollowing, toggle } = useDivisionFollows(eventId);
  const on = isFollowing(divisionId);
  return (
    <button
      type="button"
      onClick={() => toggle(divisionId)}
      aria-pressed={on}
      aria-label={on ? `Unfollow division ${name}` : `Follow division ${name}`}
      className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-full border px-3 text-sm font-medium ${
        on ? "border-brand bg-brand text-white" : "border-border bg-surface text-brand-strong hover:border-brand"
      }`}
    >
      <Star aria-hidden className={`h-4 w-4 ${on ? "fill-current" : ""}`} />
      {on ? "Following division" : "Follow division"}
    </button>
  );
}
