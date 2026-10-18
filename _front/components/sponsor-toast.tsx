"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Heart, X } from "lucide-react";
import type { Partner } from "@/lib/api";
import { useGuide } from "@/lib/queries";

const COOLDOWN = 5 * 60_000;
export function SponsorToast({ eventId }: { eventId: string }) {
  const guide = useGuide(eventId);
  const partners = guide.data?.data.partners;
  const [sponsor, setSponsor] = useState<Partner | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimer = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  };
  const dismissLater = () => {
    stopTimer();
    dismissTimer.current = setTimeout(() => setSponsor(null), 12_000);
  };
  useEffect(() => {
    const eligible =
      partners?.filter((p) => p.kind === "sponsor" && p.active) ?? [];
    if (!eligible.length) return;
    try {
      const last = Number(
        sessionStorage.getItem("olley:sponsor-last-shown") || 0,
      );
      if (Date.now() - last < COOLDOWN) return;
    } catch {
      return;
    }
    if (Math.random() > 0.35) return;
    const chosen = eligible[Math.floor(Math.random() * eligible.length)];
    const showTimer = setTimeout(() => {
      try {
        sessionStorage.setItem("olley:sponsor-last-shown", String(Date.now()));
      } catch {
        return;
      }
      setSponsor(chosen);
      dismissTimer.current = setTimeout(() => setSponsor(null), 12_000);
    }, 1400);
    return () => {
      clearTimeout(showTimer);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [partners]);
  if (!sponsor) return null;
  return createPortal(
    <aside
      className="sponsor-toast"
      aria-label="A message from an event sponsor"
      onPointerEnter={stopTimer}
      onPointerLeave={dismissLater}
      onFocus={stopTimer}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) dismissLater();
      }}
    >
      <div className="sponsor-toast-icon" aria-hidden>
        {sponsor.logo_url ? (
          <Image
            src={sponsor.logo_url}
            alt=""
            width={36}
            height={36}
            unoptimized
          />
        ) : (
          <Heart size={21} />
        )}
      </div>
      <div className="sponsor-toast-copy" role="status">
        <small>Sponsored · {sponsor.name}</small>
        <p>{sponsor.body || `${sponsor.name} is cheering you on!`}</p>
        {sponsor.link_url?.startsWith("https://") && (
          <a
            href={sponsor.link_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            Meet {sponsor.name}
          </a>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss sponsor message"
        onClick={() => {
          stopTimer();
          setSponsor(null);
        }}
      >
        <X size={16} aria-hidden />
      </button>
    </aside>,
    document.body,
  );
}
