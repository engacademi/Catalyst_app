"use client";
import { useRef, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Partner } from "@/lib/api";
import {
  trackSponsorClick,
  useSponsorImpressions,
} from "@/lib/sponsor-engagement";

export function SponsorRibbon() {
  const sponsors = useQuery({
    queryKey: ["discovery-sponsors"],
    queryFn: () => apiGet<{ data: Partner[] }>("/v1/sponsors"),
  });
  const items = sponsors.data?.data ?? [];
  const ref = useRef<HTMLElement>(null);
  useSponsorImpressions(
    ref,
    items.map((item) => item.id),
    "ribbon",
  );
  if (!items.length) return null;
  return (
    <section ref={ref} className="sponsor-ribbon" aria-label="Our sponsors">
      <h2>Our partners</h2>
      <div className="sponsor-window">
        <div
          className="sponsor-track"
          style={{ "--sponsor-count": items.length } as CSSProperties}
        >
          {[0, 1].map((copy) => (
            <ul className="sponsor-group" key={copy} aria-hidden={copy === 1}>
              {items.map((item) => {
                const mark = item.logo_url ? (
                  // Plain img: logos are small static files with their own aspect ratios.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.logo_url} alt={item.name} decoding="async" />
                ) : (
                  <span className="sponsor-name">{item.name}</span>
                );
                return (
                  <li key={item.id}>
                    {item.link_url ? (
                      <a
                        href={item.link_url}
                        tabIndex={copy ? -1 : undefined}
                        target="_blank"
                        rel="noopener sponsored"
                        className="sponsor-mark"
                        title={item.name}
                        onClick={() => trackSponsorClick(item.id, "ribbon")}
                      >
                        {mark}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="sponsor-mark">{mark}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
