import type { ReactNode } from "react";

/** Original vector motif: court lines, a net and a volleyball in flight. */
export function CourtArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 360"
      fill="none"
      aria-hidden="true"
      className={`court-art ${className}`}
    >
      <defs>
        <linearGradient
          id="court-field"
          x1="72"
          y1="70"
          x2="396"
          y2="340"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#E8F0E3" />
          <stop offset="1" stopColor="#BBD4BC" />
        </linearGradient>
      </defs>
      <circle cx="280" cy="178" r="154" fill="url(#court-field)" />
      <path d="M45 302 260 214 457 289 240 377Z" fill="#164C3B" />
      <path
        d="m80 306 182-73 158 60-182 73Zm92-37 156 61M262 233l-24 133"
        stroke="#E8F0E3"
        strokeWidth="2"
      />
      <g stroke="#638B71" strokeWidth="2">
        <path
          d="M146 166v146m254-214v145M146 166l254-68v100l-254 69Z"
          fill="#FFF"
          fillOpacity=".65"
        />
        <path
          d="m146 191 254-68m-254 93 254-68m-254 93 254-68M178 158v100m32-109v101m32-109v101m32-110v101m32-110v101m32-109v100m32-109v100"
          opacity=".55"
        />
      </g>
      <path
        d="M64 181C66 72 166 11 253 48"
        stroke="#164C3B"
        strokeOpacity=".4"
        strokeWidth="2"
        strokeDasharray="5 9"
        strokeLinecap="round"
      />
      <g className="volley-ball" stroke="#164C3B" strokeWidth="2.5">
        <circle cx="287" cy="65" r="47" fill="#D5E8AF" />
        <path d="M244 46c31-5 50 5 61 31m-65-13c31-8 54 2 66 26m-43-67c-7 28 0 49 20 65m-6-70c-8 25-2 47 19 66m32-48c-23 2-41 16-48 41m53-25c-24-1-42 13-52 39m27 16c-14-11-20-27-18-46" />
      </g>
      <path
        d="m86 232 5 12 13 3-12 6-3 13-6-12-13-3 12-6Zm308-190 4 9 10 3-9 4-3 10-4-9-10-3 9-4Z"
        fill="#164C3B"
      />
      <circle cx="103" cy="109" r="5" fill="#D5E8AF" />
      <circle cx="429" cy="231" r="7" fill="#D5E8AF" />
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`wordmark ${light ? "wordmark-light" : ""}`}>
      <svg
        aria-hidden="true"
        width="29"
        height="29"
        viewBox="0 0 32 32"
        fill="none"
      >
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
        <path
          d="M3 11c10-2 17 1 21 10M10 3c-2 10 1 18 10 23M28 7c-9 1-16 8-18 18M4 19c8-5 16-5 24-1"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
      olley<span className="wordmark-dot">.</span>
    </span>
  );
}

export function WelcomeBanner({
  title,
  children,
  eyebrow = "YOUR PLACE, COURTSIDE",
  compact = false,
}: {
  title: string;
  children?: ReactNode;
  eyebrow?: string;
  compact?: boolean;
}) {
  return (
    <section className={`welcome-banner ${compact ? "welcome-compact" : ""}`}>
      <div className="welcome-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {children && <div className="welcome-description">{children}</div>}
      </div>
      <CourtArt />
    </section>
  );
}

export function TeamAvatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`team-avatar ${small ? "team-avatar-small" : ""}`}
    >
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
