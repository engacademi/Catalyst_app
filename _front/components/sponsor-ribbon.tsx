"use client";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Partner } from "@/lib/api";
export function SponsorRibbon() {
  const sponsors = useQuery({
    queryKey: ["discovery-sponsors"],
    queryFn: () => apiGet<{ data: Partner[] }>("/v1/sponsors"),
  });
  const items = sponsors.data?.data ?? [];
  if (!items.length) return null;
  return (
    <section className="sponsor-ribbon" aria-label="Our sponsors">
      <h2>Our partners</h2>
      <div className="sponsor-window">
        <div className="sponsor-track">
          {[0, 1].map((copy) => (
            <div className="sponsor-group" key={copy} aria-hidden={copy === 1}>
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.link_url || undefined}
                  tabIndex={copy ? -1 : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="sponsor-mark"
                >
                  {item.logo_url ? (
                    <>
                      <Image
                        src={item.logo_url}
                        alt=""
                        width={96}
                        height={36}
                        unoptimized
                      />
                      <span>{item.name}</span>
                    </>
                  ) : (
                    item.name
                  )}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
