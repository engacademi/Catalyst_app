// OVA-wide event-day rules, quoted from OVA's own 2026-27 documents. They apply to every
// OVA event of a kind, so they live here rather than in each event's guide items.

export type EventKind = "indoor" | "beach";

export type OvaSource = { label: string; url: string };

export type OvaRule = { title: string; body: string; source: OvaSource };

const YCM = "https://cdn1.sportngin.com/attachments/document/6beb-3517468/YCM_2026-2027_FINAL.pdf";
const BEACH_HANDBOOK =
  "https://cdn3.sportngin.com/attachments/document/a35c-3547431/2026_Beach_Handbook_V6.pdf";

const ycm = (section: string): OvaSource => ({
  label: `Youth Competitions Manual 2026-27 §${section}`,
  url: YCM,
});
const beach = (section: string): OvaSource => ({
  label: `Beach Tour Handbook 2026 §${section}`,
  url: BEACH_HANDBOOK,
});

export const MATCH_DAY_RULES: Record<EventKind, OvaRule[]> = {
  indoor: [
    {
      title: "Warm-up",
      body: "A team's first match of the day uses 8-4-4: 8 minutes of shared ball handling, then 4 minutes for the serving team and 4 for the receiving team. Later matches use 2-4-4. No shared hitting or serving, and no warming up with balls at the bench or in walkways.",
      source: ycm("6.5"),
    },
    {
      title: "Late teams",
      body: "The referee waits 10 minutes from the start time, then defaults set 1. After another 10 minutes the team forfeits the match.",
      source: ycm("6.24"),
    },
    {
      title: "No side switching",
      body: "Teams don't switch sides between sets, so families can stay where they are. The head referee may name a court where teams do switch.",
      source: ycm("6.15"),
    },
    {
      title: "First aid",
      body: "Most regular-season events have no on-site medical staff, so teams bring their own first aid kit. Medical services are on site at Cohere Centre, International Centre, Niagara Falls Convention Centre and all Grand Prix events.",
      source: ycm("6.26"),
    },
  ],
  beach: [
    {
      title: "Check-in",
      body: "Check-in runs 8:30 to 9:00 a.m. and both partners check in together. A team not checked in by 9:00 a.m. is removed from the tournament. Bring your own ball for warm-up.",
      source: beach("2.6.1"),
    },
    {
      title: "Late teams",
      body: "A team that hasn't shown up 10 minutes after the start time forfeits the first set. After another 10 minutes it forfeits the match.",
      source: beach("2.6.3"),
    },
    {
      title: "Lightning",
      body: "Once lightning hits, play is suspended for 30 minutes and the weather is re-evaluated.",
      source: beach("3.8.2"),
    },
    {
      title: "Extreme heat and air quality",
      body: "OVA may activate its extreme heat and air quality policy when the humidex reaches 40 or more with an Environment Canada humidex warning, or when the air quality health index is high risk.",
      source: beach("3.8.3"),
    },
  ],
};

export const WORK_DUTY: Record<EventKind, { items: string[]; source: OvaSource }> = {
  indoor: {
    items: [
      "15U to 18U: your team provides one athlete line judge per match, calling the lines on your own side.",
      "Your team also provides one volunteer scorer or assistant scorer. A parent or any supporter can do it.",
      "Missing either role gives the other team a 3-point start in every set it isn't filled, plus a $75 fine per match. The line judge rule applies to rosters of 9 or more.",
    ],
    source: ycm("6.21"),
  },
  beach: {
    items: [
      "Every team scores and referees matches in its pool, as shown on the posted schedule.",
      "In playoffs, teams officiate first-round matches and must score one match after they are eliminated.",
      "Missing a duty is a $100 sanction, paid before registering for the next OVA event.",
    ],
    source: beach("2.8.1"),
  },
};

export const CANT_ATTEND = {
  phone: "647-467-5514",
  body: "If weather or something unforeseen stops your team from getting to the event, coaches email the Program Coordinator and call OVA's Event Day Emergency Hotline.",
  source: ycm("3.7"),
};

export const OFFICIAL_DOCUMENTS: Record<EventKind | "all", OvaSource[]> = {
  indoor: [
    { label: "Youth Competitions Manual 2026-27", url: YCM },
    {
      label: "Youth Competitions Calendar 2026-27",
      url: "https://cdn1.sportngin.com/attachments/document/d57f-1591849/YC_Calendar_26-27_Jun_19_FINAL.pdf",
    },
    {
      label: "Roster Verification Process",
      url: "https://cdn4.sportngin.com/attachments/document/60ef-3478541/Roster_Verification_Process.pdf",
    },
  ],
  beach: [
    { label: "Beach Tour Handbook 2026", url: BEACH_HANDBOOK },
    {
      label: "Beach Tour Coaching Policy 2026",
      url: "https://cdn1.sportngin.com/attachments/document/3365-3367046/Beach_Tour_Coaching_Policy_2026.pdf",
    },
    {
      label: "FIVB Beach Volleyball Rules 2025-2028",
      url: "https://cdn4.sportngin.com/attachments/document/97e8-3371908/FIVB-BeachVolleyball_Rules2025_2028-EN-v01.pdf",
    },
  ],
  all: [
    {
      label: "2026-27 OVA Coach Eligibility Policy",
      url: "https://cdn3.sportngin.com/attachments/document/44f2-1591880/2026-27_OVA_Coach_Eligibility_Policy.pdf",
    },
  ],
};
