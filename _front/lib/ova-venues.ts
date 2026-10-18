// OVA's own venue pages and event logos, collected so every major event's venue
// details sit in the app instead of on separate ontariovolleyball.org pages.
// Facts are copied from the linked OVA pages as checked on OVA_CHECKED; OVA updates
// them before each event, so every block links back to its source.

export const OVA_CHECKED = "2026-10-18";

export type OvaLogo = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type OvaSeries = {
  id: string;
  name: string;
  logo: OvaLogo;
};

export const OVA_SERIES = {
  ontarioChampionships: {
    id: "ontario-championships",
    name: "Ontario Championships",
    logo: {
      src: "/ova/logos/ontario-championships-2026.png",
      alt: "2026 Ontario Championships logo, Toronto, Enercare",
      width: 480,
      height: 422,
    },
  },
  ontarioChampionshipsNiagara: {
    id: "ontario-championships-niagara",
    name: "Ontario Championships · Niagara Falls",
    logo: {
      src: "/ova/logos/ontario-championships-niagara-2026.png",
      alt: "2026 Ontario Volleyball Championships Niagara Falls logo",
      width: 480,
      height: 480,
    },
  },
  fallClassic: {
    id: "fall-classic",
    name: "Fall Classic",
    logo: {
      src: "/ova/logos/fall-classic.png",
      alt: "Ontario Volleyball Association Fall Classic logo",
      width: 480,
      height: 480,
    },
  },
  newYearsOpen: {
    id: "new-years-open",
    name: "New Year's Open",
    logo: {
      src: "/ova/logos/new-years-open.png",
      alt: "New Year's Open Mississauga, Ontario Volleyball logo",
      width: 480,
      height: 480,
    },
  },
  grandPrix: {
    id: "grand-prix-bugarski-cup",
    name: "Grand Prix / Bugarski Cup",
    // OVA publishes no Grand Prix logo; its page carries the venue's.
    logo: {
      src: "/ova/logos/niagara-falls-convention-centre.png",
      alt: "Niagara Falls Convention Centre logo",
      width: 480,
      height: 269,
    },
  },
  winterBeachTour: {
    id: "winter-beach-tour",
    name: "Winter Beach Tour",
    logo: {
      src: "/ova/logos/winter-beach-tour.png",
      alt: "Ontario Volleyball Winter Beach Tour logo",
      width: 380,
      height: 380,
    },
  },
  beachTourChampionships: {
    id: "beach-tour-championships",
    name: "Beach Tour Championships",
    logo: {
      src: "/ova/logos/beach-tour-championships-2026.png",
      alt: "2026 Ontario Volleyball Beach Tour Championships Ashbridges Bay logo",
      width: 480,
      height: 442,
    },
  },
} satisfies Record<string, OvaSeries>;

type EventLike = { title: string; venues?: string[] };

const has = (text: string, pattern: RegExp) => pattern.test(text);

/** The OVA event series an app event belongs to, from its title and venues. */
export function eventSeries(event: EventLike): OvaSeries | null {
  const title = event.title;
  const venues = (event.venues ?? []).join(" ");
  if (has(title, /beach (tour )?(ontario )?championships|beach ocs?\b/i))
    return OVA_SERIES.beachTourChampionships;
  if (has(title, /ontario championships/i) && !has(title, /\bdemo\b/i))
    return has(title, /4v4/i) || has(venues, /niagara falls/i)
      ? OVA_SERIES.ontarioChampionshipsNiagara
      : OVA_SERIES.ontarioChampionships;
  // Clubs run their own "Fall Classic" exhibitions; only OVA's event gets its logo.
  if (
    has(title, /fall classic/i) &&
    !has(title, /exhibition/i) &&
    (has(title, /\bOVA\b|ontario volleyball/i) ||
      has(venues, /cohere|ey centre/i))
  )
    return OVA_SERIES.fallClassic;
  if (has(title, /new year'?s open/i)) return OVA_SERIES.newYearsOpen;
  if (has(title, /grand prix|bugarski/i) && has(venues, /niagara falls/i))
    return OVA_SERIES.grandPrix;
  if (has(title, /^WBT\b|winter beach tour/i))
    return OVA_SERIES.winterBeachTour;
  return null;
}

export type OvaMap = {
  src: string;
  width: number;
  height: number;
  title: string;
  /** A text alternative to the drawing, read in order. */
  description: string[];
};

export type OvaLink = { label: string; url: string };

export type OvaDetail = {
  kind:
    | "parking"
    | "food"
    | "services"
    | "rules"
    | "schedule"
    | "travel"
    | "streaming"
    | "tourism";
  title: string;
  items: string[];
  links?: OvaLink[];
};

export type OvaMajorEvent = {
  series: OvaSeries;
  title: string;
  dates: string;
  /** ISO date of the last day, so past events can be dropped. */
  ends: string;
  summary: string[];
  /** Words in the app's event title that identify this event once imported. */
  appTitle?: RegExp;
  links: OvaLink[];
};

export type OvaVenue = {
  id: string;
  name: string;
  /** Venue names as AES, TIMU, MyTeam.click and the seed spell them. */
  aliases: string[];
  city: string;
  address?: string;
  kind: "indoor" | "beach";
  logo?: OvaLogo;
  intro: string;
  maps: OvaMap[];
  details: OvaDetail[];
  documents: OvaLink[];
  events: OvaMajorEvent[];
  source: OvaLink;
};

const HTG_STAY_TO_PLAY = [
  "Travelling teams (125 km or more one way) must book hotel rooms through Hudson Travel Group (HTG Sports) to play these 2-day convention centre events. This is OVA's Stay to Play policy.",
  "Minimum rooms for one night: 8–9 athletes, 3 rooms · 10–11 athletes, 4 rooms · 12 or more, 5 rooms. It is the team's responsibility to meet the minimum.",
  "Teams under 125 km away, or at single-day events, don't have to stay over, but any hotel they book must go through HTG.",
];

const NO_NOISEMAKERS =
  "Noise makers (cowbells, air horns, drums, whistles) aren't allowed and will be confiscated.";
const PHOTOGRAPHERS =
  "Only OVA's authorized photographers may be on the playing area or between courts. Parents and spectators who take photos from there will be asked to leave.";
const NO_HALLWAY_WARMUP =
  "No warming up in hallways. A ball hitting an overhead sprinkler sets off the alarm and evacuates the whole building.";
const PIXELLOT_STEPS =
  "To watch: go to cbc.watch.pixellot.tv, sign up for a free account, choose Volleyball in the top bar and follow the Ontario Volleyball Association.";

const FALL_CLASSIC: OvaMajorEvent = {
  series: OVA_SERIES.fallClassic,
  title: "2026 Fall Classic",
  dates: "November 6–8, 2026",
  ends: "2026-11-08",
  summary: [
    "Event 1, November 6–7: 16UG Division 1 and Division 2 (48 teams each). Matches start at 8:30 am on Nov 6 and 7:30 am on Nov 7.",
    "Event 2, November 7–8: 18UG (48 teams), 16UB (24 teams) and 18UB (24 teams). Matches start at 3:00 pm on Nov 7 and 9:30 am on Nov 8.",
    "All matches are best 2 of 3 with no cap. Schedules and results will be on Advanced Event Systems (AES) by October 23, 2026, and appear here once AES publishes them.",
  ],
  appTitle: /fall classic/i,
  links: [
    {
      label: "Fall Classic page on ontariovolleyball.org",
      url: "https://www.ontariovolleyball.org/fall-classic",
    },
    {
      label: "Schedules and results on AES",
      url: "https://www.advancedeventsystems.com/",
    },
    {
      label: "Qualification, seeding and points (PDF)",
      url: "https://cdn2.sportngin.com/attachments/document/6646-3620059/Qualification_Seeding_Points_V1.1.pdf",
    },
  ],
};

const NEW_YEARS_OPEN: OvaMajorEvent = {
  series: OVA_SERIES.newYearsOpen,
  title: "2027 New Year's Open",
  dates: "January 15–17, 2027",
  ends: "2027-01-17",
  summary: [
    "A 2-day event for the whole 18UG and 18UB age group on 24 courts. It replaces the 18U McGregor Cup as the third 18U regular-season event.",
    "Event 1: 18UB Division 1 (ranked 1–32) and 18UG Division 1 (ranked 1–64). Event 2: 18UB Division 2 (33–64) and 18UG Division 2 (65–128).",
    "Seeding is posted by 6:00 pm on Monday, December 14, 2026. Schedules go up on AES. Entry is free for spectators.",
  ],
  appTitle: /new year'?s open/i,
  links: [
    {
      label: "New Year's Open page on ontariovolleyball.org",
      url: "https://www.ontariovolleyball.org/new-years-open",
    },
  ],
};

const GRAND_PRIX: OvaMajorEvent = {
  series: OVA_SERIES.grandPrix,
  title: "2027 Grand Prix / Bugarski Cup",
  dates: "March 5–7, 2027",
  ends: "2027-03-07",
  summary: [
    "Friday, March 5 (about 11 am–8 pm): four single-day Bugarski Cup events.",
    "Saturday, March 6 (about 9 am–6 pm) and Sunday, March 7 (about 8 am–5 pm): 16UG D1, 16UG D2 and 17UB Grand Prix, plus one single-day Bugarski Cup event each day.",
    "Grand Prix seeding comes from the Grand Prix Qualifier. Full schedules are on TIMU.ca/ova at least a week before.",
  ],
  appTitle: /grand prix|bugarski/i,
  links: [
    {
      label: "Niagara Falls page on ontariovolleyball.org",
      url: "https://www.ontariovolleyball.org/niagara-falls",
    },
  ],
};

const OC_2026_NIAGARA: OvaMajorEvent = {
  series: OVA_SERIES.ontarioChampionshipsNiagara,
  title: "2026 Ontario Championships · 4v4 Boys and Girls",
  dates: "March 2026",
  ends: "2026-03-29",
  summary: [
    "68 4v4 teams played their own Ontario Championships at the Niagara Falls Convention Centre.",
  ],
  appTitle: /ontario championships.*4v4/i,
  links: [
    {
      label: "Ontario Championships page on ontariovolleyball.org",
      url: "https://www.ontariovolleyball.org/page/show/3835478-ontario-championships",
    },
  ],
};

const OC_2026_ENERCARE: OvaMajorEvent = {
  series: OVA_SERIES.ontarioChampionships,
  title: "2026 Ontario Championships",
  dates: "April 16–25, 2026",
  ends: "2026-04-25",
  summary: [
    "1,338 teams played on 58 courts, 14 hours a day, over 9 competition days at Enercare Centre in downtown Toronto.",
    "The vendor hall had the Canuckstuff Clubhouse, food trucks, games and the Team Ontario Testing Station.",
  ],
  appTitle: /ontario championships - event/i,
  links: [
    {
      label: "Ontario Championships page on ontariovolleyball.org",
      url: "https://www.ontariovolleyball.org/page/show/3835478-ontario-championships",
    },
  ],
};

const WINTER_BEACH_TOUR: OvaMajorEvent = {
  series: OVA_SERIES.winterBeachTour,
  title: "2026–27 Winter Beach Tour",
  dates: "November 2026 to April 2027",
  ends: "2027-04-30",
  summary: [
    "Half-day events on indoor sand courts with round robin and playoff matches, for 13U to 18U.",
    "Mandatory team check-in is 8:30–8:50 am and play runs from 9:00 am to 1:00 pm.",
    "Registration is on MyTeam.click.",
  ],
  appTitle: /^WBT\b/i,
  links: [
    {
      label: "Winter Beach Tour page on ontariovolleyball.org",
      url: "https://www.ontariovolleyball.org/page/show/3836004-winter-beach-tour",
    },
    {
      label: "Half-day events info sheet (PDF)",
      url: "https://cdn2.sportngin.com/attachments/document/7e41-3274952/2027_WBT_-_Half_Day_Events_Info_Sheet.pdf",
    },
  ],
};

export const OVA_VENUES: OvaVenue[] = [
  {
    id: "cohere-centre",
    name: "Cohere Centre",
    aliases: ["cohere centre", "cohere convention centre", "ey centre"],
    city: "Ottawa",
    kind: "indoor",
    logo: {
      src: "/ova/logos/cohere-centre.png",
      alt: "Cohere Centre logo",
      width: 480,
      height: 177,
    },
    intro:
      "Home of the OVA Fall Classic, now in its fourth year in Ottawa, with support from Ottawa Tourism. Cohere Centre is at Upland Station on the Ottawa light rail line.",
    maps: [
      {
        src: "/ova/maps/cohere-centre-fall-classic-2026.jpg",
        width: 2000,
        height: 1333,
        title: "Fall Classic 2026 event map",
        description: [
          "One long playing hall with 24 courts. Courts 1–4 are at the left end and courts 21–24 at the right end, each in a block of four.",
          "Courts 5–12 run along the back row and courts 13–20 along the front row, in pairs.",
          "Ball-free warm-up areas sit between courts 1–4 and court 5, and between court 12 and courts 21–24. OVA photo backdrops are beside court 13.",
          "First aid is below court 13 and below court 20. The Mikasa, Canuck Stuff and Mizuno booth is beside courts 23–24. A water refill station is by court 5.",
          "Hall doors 4, 3, 2 and 1 open from the front corridor, left to right. Snack bars are by Hall 4 and by Hall 1, with washrooms in between and Event HQ by Hall 2.",
          "Team lunch rooms are in Meeting Rooms B–D, between the two entrances. Tables aren't reserved.",
        ],
      },
    ],
    details: [
      {
        kind: "parking",
        title: "Parking and getting there",
        items: [
          "Flat daily parking rate of $10. Everyone gets a re-entry pass for the day, so you can come and go.",
          "Quick pick-up and drop-off is at the north-west corner of the parking lot.",
          "Cohere Centre is at Upland Station on the Ottawa light rail line.",
        ],
        links: [
          {
            label: "Google map of the parking lot",
            url: "https://goo.gl/maps/htd3A8rX9cu",
          },
        ],
      },
      {
        kind: "food",
        title: "Food and drink",
        items: [
          "Concession hours: Friday 7:30 am–5:30 pm, Saturday 6:30 am–9:00 pm, Sunday 8:30 am–5:30 pm. There's no team food pre-order for this event.",
          "Lunch rooms are in Meeting Rooms B, C and D. Tables aren't reserved; clear your things so other teams can sit.",
          "Brown-bag lunches are fine. Coolers, crock pots, hot plates, buffet tables and food delivery aren't allowed.",
          "Food questions: Nuri Kim, 613-822-8800 ext. 203, nkim@coherecentre.ca.",
        ],
      },
      {
        kind: "services",
        title: "Medical, warm-up and awards",
        items: [
          "Athletic therapists are on site all three days, below court 13 and court 20. They provide tape and ice, and tape athletes who bring their own tape.",
          "Ball-free warm-up areas are in Hall 1 and Hall 4. Warm-up is 8-4-4 for a team's first match of the day and 2-4-4 after that.",
          "Medals go to the score table of each medal match; there's no formal ceremony. Photo backdrops for team medal photos are in Hall 4.",
          "Courts 7, 9, 11, 15, 17 and 19 switch sides between sets because of large ceiling fans. Other courts don't switch.",
        ],
      },
      {
        kind: "schedule",
        title: "Doors and check-in",
        items: [
          "There's no official team check-in. Hall doors open an hour before first serve: Friday Nov 6 at 7:30 am, Saturday Nov 7 at 6:30 am, Sunday Nov 8 at 8:30 am.",
        ],
      },
      {
        kind: "rules",
        title: "Facility rules",
        items: [
          "Tables in the eating areas aren't reserved. Unattended bags left on tables are moved.",
          "Keep walkways clear of bags and team gear.",
          NO_HALLWAY_WARMUP,
          NO_NOISEMAKERS,
          PHOTOGRAPHERS,
          "Sport court rule: the last contact before playing the ball must be both feet fully on the sport court tile. There's no pursuit across the centre line.",
        ],
      },
      {
        kind: "streaming",
        title: "Video",
        items: [
          "OVA won't stream or upload Pixellot video for this year's Fall Classic. Teams can record their own matches.",
        ],
      },
      {
        kind: "travel",
        title: "Hotels and flights",
        items: [
          "The live hotel link was posted on Tuesday, October 6, 2026, and rooming lists were due by 12 pm on Friday, October 9. Hotel questions go to HTG at ova@htgsports.com.",
          "Flight discounts for travel October 30 to November 15, 2026: Air Canada code P72PZVZ1, WestJet code 2K5O0KS.",
          "Teams 550 km or more away get early hotel access for Cohere Centre events.",
          ...HTG_STAY_TO_PLAY,
        ],
        links: [
          {
            label: "Live hotel booking (HTG)",
            url: "https://secure.htgsports.com/registration.nsf/BTSRP_EventAccess?OpenForm&eventid=0256E7FB30F6470F85258B74004CFD51&pvw=0&lang=en",
          },
          {
            label: "Stay to Play club list (PDF)",
            url: "https://cdn1.sportngin.com/attachments/document/8880-3632812/Stay_To_Play_-_Club_List_Breakdown_V1.2.pdf",
          },
        ],
      },
      {
        kind: "tourism",
        title: "Merch and things to do",
        items: [
          "Pre-order Fall Classic gear from Canuck Stuff for pick-up at Cohere Centre; Ottawa orders close November 1 at 11:59 pm. Home shipping is a flat $14.95 plus tax. Event merchandise can't be returned; exchanges are at the Ottawa event while supplies last.",
          "Flash Your Badge gives participants and a guest discounts at Ottawa attractions, tours and restaurants. It's web-based at ottawatourism.ca/en/fyb.",
        ],
        links: [
          {
            label: "Shop Fall Classic gear",
            url: "https://canuckstuff.com/fallclassic26/shop/home",
          },
          {
            label: "Flash Your Badge",
            url: "https://ottawatourism.ca/en/fyb",
          },
        ],
      },
    ],
    documents: [
      {
        label: "Welcome letter, Ottawa Tourism (PDF)",
        url: "https://cdn3.sportngin.com/attachments/document/eaf0-3416731/Welcome_Letter_2026_OVA_Fall_Classics.pdf",
      },
      {
        label: "Welcome letter, Mayor of Ottawa (PDF)",
        url: "https://cdn1.sportngin.com/attachments/document/6e92-3416732/2026OVAFallClassicBil.pdf",
      },
    ],
    events: [FALL_CLASSIC],
    source: {
      label: "OVA Fall Classic page",
      url: "https://www.ontariovolleyball.org/fall-classic",
    },
  },
  {
    id: "international-centre",
    name: "International Centre",
    aliases: ["international centre"],
    city: "Mississauga",
    address: "6900 Airport Rd, Mississauga, ON L4V 1E8",
    kind: "indoor",
    logo: {
      src: "/ova/logos/international-centre.png",
      alt: "The International Centre logo",
      width: 480,
      height: 177,
    },
    intro:
      "Home of the New Year's Open, held with financial support from Visit Mississauga.",
    maps: [
      {
        src: "/ova/maps/international-centre-2026.jpg",
        width: 2000,
        height: 1333,
        title: "International Centre facility map (New Year's Open 2026)",
        description: [
          "Airport Road runs along the left edge of the map. Hall 2, top left, holds the ball-free warm-up zone, the food court and team seating, Pizza Pizza and the Canuck Stuff booth, with awards next to it.",
          "Halls 3 and 4 run diagonally to the top right with courts 17–24. Medical, athlete massage therapy and a water refill station are between Hall 2 and Hall 4.",
          "A corridor runs down from Hall 4 to Hall 5, past the coffee shop near court 8.",
          "Hall 5, along the bottom, has courts 1–8 in the upper row and 9–16 in the lower row. Medical is below court 12.",
          "Numbered entrances: 2 and 3 at the top of Hall 3, 4 on the right side between Hall 4 and Hall 5, and 5 at the lower right corner of Hall 5.",
        ],
      },
    ],
    details: [
      {
        kind: "parking",
        title: "Parking",
        items: [
          "Free parking with more than 5,000 spaces. Check which hall your matches are in and park near Hall 3, 4 or 5.",
          "The North and South lots have 55 accessible spaces. A few EV chargers are near the Conference Centre entrance.",
        ],
      },
      {
        kind: "food",
        title: "Food and drink",
        items: [
          "The main food court is in Hall 2 (Craft Express, Sweet and Savoury Corner, The Bar, Pizza Pizza, Kelly Greens). A coffee shop is just outside Hall 5 near court 8.",
          "Team pre-orders go to catering@internationalcentre.com: one form per meal period per day, picked up at the Hall 2 retail concession.",
          "Lunchroom space is in Hall 2. Tables aren't reserved. Personal brown-bag meals only; no coolers, buffets or delivery.",
        ],
      },
      {
        kind: "services",
        title: "Medical, warm-up and awards",
        items: [
          "Athletic therapists are in Hall 4 (below court 20) and Hall 5 (below court 12) all three days.",
          "Free massage therapy for athletes in Hall 2.",
          "Hall 2 has 35,000 sq ft of ball-free warm-up space. Warm-up is 8-4-4 for a team's first match and 2-4-4 after.",
          "Halls 3 and 4 don't switch sides between sets. Hall 5 does, because of a difference in ceiling height.",
          "Medals for every tier are handed out in Hall 2 next to Canuck Stuff. Go there right after your medal match.",
          "Lost and found is just outside Hall 5.",
        ],
      },
      {
        kind: "streaming",
        title: "Video",
        items: [
          "Pixellot cameras record courts 5, 13 and 17–20. It isn't live: morning matches are uploaded early afternoon and afternoon matches in the evening.",
          PIXELLOT_STEPS,
        ],
        links: [
          { label: "Pixellot (CBC)", url: "https://cbc.watch.pixellot.tv/" },
        ],
      },
      {
        kind: "rules",
        title: "Facility rules",
        items: [
          "No official team check-in. Exterior doors open an hour before first serve.",
          "Crock pots, hot plates, coolers and buffet tables aren't allowed.",
          NO_HALLWAY_WARMUP,
          NO_NOISEMAKERS,
          PHOTOGRAPHERS,
          "Teams can't set up their own Pixellot cameras between courts.",
        ],
      },
      {
        kind: "travel",
        title: "Hotels",
        items: [
          "Hotel links go live on Tuesday, December 15: 10:00 am for teams 400 km or more away, 12:00 pm for everyone. Rooming lists are due at 12 pm on Thursday, December 17.",
          ...HTG_STAY_TO_PLAY,
        ],
      },
      {
        kind: "tourism",
        title: "Things to do",
        items: [
          "The Sauga Savings Pass has free family offers around Mississauga.",
        ],
        links: [
          {
            label: "Sauga Savings Pass",
            url: "https://visitmississauga.ca/ontario-volleyball",
          },
        ],
      },
    ],
    documents: [
      {
        label: "Facility map (PDF)",
        url: "https://cdn2.sportngin.com/attachments/document/77e7-3501976/IC_Map_2026_Jan_6.pdf",
      },
      {
        label: "International Centre safety manual (PDF)",
        url: "https://cdn4.sportngin.com/attachments/document/2cdc-3501974/International_Centre_Safety_Manual_New_Years_Open_2026.pdf",
      },
    ],
    events: [NEW_YEARS_OPEN],
    source: {
      label: "OVA New Year's Open page",
      url: "https://www.ontariovolleyball.org/new-years-open",
    },
  },
  {
    id: "niagara-falls-convention-centre",
    name: "Niagara Falls Convention Centre",
    aliases: ["niagara falls convention centre", "nfcc"],
    city: "Niagara Falls",
    kind: "indoor",
    logo: OVA_SERIES.grandPrix.logo,
    intro:
      "A major part of OVA's season, hosting the Grand Prix, some Bugarski Cup events and the 4v4 Ontario Championships. OVA returns in 2027.",
    maps: [
      {
        src: "/ova/maps/niagara-falls-convention-centre.png",
        width: 1024,
        height: 663,
        title: "Court map",
        description: [
          "Three exhibit halls side by side with 12 courts. Hall A (left) has courts 1–4, Hall B (centre) courts 5–8 and Hall C (right) courts 9–12. Court 1, 5 and 9 are nearest the entrances.",
          "Each hall has its own entrance from the front corridor. The facility entrance doors are along the front of the building, with vendors and the OVA awards backdrop in the corridor.",
          "Food services order pick-up is in the Peller Estate Room to the left of Hall A. Junior Ballrooms A and B are below it.",
        ],
      },
      {
        src: "/ova/maps/niagara-falls-convention-centre-parking.png",
        width: 800,
        height: 600,
        title: "Parking map",
        description: [
          "More than 800 spaces behind the building, reached from Stanley Avenue and Dunn Street.",
          "Lot A1: 24 spaces, 17 accessible, 3 motorcycle. Lot A2: 30 spaces, 2 accessible, 3 motorcycle, 11 bus. Lots A to F: 570 spaces. West 71, East 62, South 41.",
          "Entry and exit doors are on the north side of the building and beside the visitor parking and loading docks.",
        ],
      },
    ],
    details: [
      {
        kind: "parking",
        title: "Parking",
        items: [
          "Paid parking is $20 per vehicle, debit or credit only. There are no in-and-out privileges.",
          "Accessible spaces are in lots A1 (17) and A2 (2). Buses use lot A2.",
        ],
      },
      {
        kind: "food",
        title: "Food and drink",
        items: [
          "Food services are cashless with no pre-order option. At the March 2026 weekend they ran Friday 8 am–6 pm, Saturday 7:30 am–5:30 pm and Sunday 7:30 am–8 pm.",
          "No outside coolers of any kind; they're turned away at the entrance. Personal athlete snacks are fine, but take-out and Uber deliveries can't come in.",
          "Team tables aren't reserved. Unattended items are taken to the security office.",
        ],
        links: [
          {
            label: "Food services menu",
            url: "https://cdn3.sportngin.com/attachments/document/1bac-3533568/Volleyball_Retail_Menu_-_Copy.docx",
          },
        ],
      },
      {
        kind: "services",
        title: "Medical, warm-up and awards",
        items: [
          "Athletic therapists are on site every competition day in Hall B, below court 5. They provide tape and ice, and tape athletes who bring their own tape.",
          "No side switching between sets on any court.",
          "At the March 2026 weekend the Grand Prix courts were together in Hall C, with awards on court after the final medal match. Bugarski Cup medal sets were left on the score tables for coaches.",
        ],
      },
      {
        kind: "streaming",
        title: "Video",
        items: [
          "Grand Prix courts 9–12 have been streamed live by Weestream to the OVA YouTube channel.",
          "Pixellot cameras have covered Bugarski Cup courts 1, 2, 5 and 6. Matches are saved on the CBC platform. Teams can't set up their own Pixellot cameras between courts.",
          PIXELLOT_STEPS,
        ],
        links: [
          { label: "Pixellot (CBC)", url: "https://cbc.watch.pixellot.tv/" },
        ],
      },
      {
        kind: "rules",
        title: "Facility rules",
        items: [
          "No official team check-in; teams can enter through any door.",
          NO_NOISEMAKERS,
          "Pom poms are allowed in spectator seating only, not on team benches.",
          PHOTOGRAPHERS,
          "Tripods must stay at least 2 m from the sport court, no higher than 10 ft, and never unattended.",
          "Sport court rule: play the ball with both feet on the sport court tile. Any service must start with at least one foot on it.",
        ],
      },
      {
        kind: "travel",
        title: "Hotels",
        items: [
          "For March 2027: teams 400 km or more away get early hotel access at 10:00 am on Thursday, February 4, 2027, and the live hotel link is posted at 12:00 pm. Rooming lists are due by 12 pm on Friday, February 12, 2027.",
          "HTG contact: Cathy Nolan, cathy@htgsports.com.",
          ...HTG_STAY_TO_PLAY,
        ],
        links: [
          {
            label: "Hotel preview (HTG)",
            url: "https://secure.htgsports.com/hrms.nsf/BTSRP_AvailHotels?OpenForm&ParentUNID=F8597A95C8A3D2B685258DAA0065D173&lang=en",
          },
        ],
      },
      {
        kind: "tourism",
        title: "Things to do",
        items: [
          "Clifton Hill attractions and restaurants are steps from the Falls. Groups can book through 1-800-801-8557 or groups@cliftonhill.com.",
        ],
        links: [
          {
            label: "Niagara Falls Tourism",
            url: "https://www.niagarafallstourism.com",
          },
          {
            label: "Niagara Parks",
            url: "https://www.niagaraparks.com/explore",
          },
        ],
      },
    ],
    documents: [
      {
        label: "Operational and safety plan (PDF)",
        url: "https://cdn3.sportngin.com/attachments/document/c514-3548524/Operational___Safety_Plan_NFCC_2026.pdf",
      },
      {
        label: "Parking map (PDF)",
        url: "https://cdn4.sportngin.com/attachments/document/d7da-3416758/NFCC_Parking_Map.pdf",
      },
    ],
    events: [GRAND_PRIX, OC_2026_NIAGARA],
    source: {
      label: "OVA Niagara Falls page",
      url: "https://www.ontariovolleyball.org/niagara-falls",
    },
  },
  {
    id: "enercare-centre",
    name: "Enercare Centre",
    aliases: ["enercare centre", "enercare"],
    city: "Toronto",
    kind: "indoor",
    intro:
      "Enercare Centre at Exhibition Place in downtown Toronto hosted the 2026 Ontario Championships. The 2027 Ontario Championships move to Kitchener-Waterloo, Ottawa and Mississauga.",
    maps: [],
    details: [
      {
        kind: "parking",
        title: "Parking",
        items: [
          "Exhibition Place has 88 accessible parking spaces across its surface lots and indoor garage, near lot entrances and pedestrian access points. Regular rates apply.",
          "There are 732 bike racks on the grounds; locations can change with events.",
        ],
      },
      {
        kind: "rules",
        title: "Ontario Championships rules",
        items: [
          "No outside food, chairs, coolers or buffet tables. Athletes may bring their own brown-bag meal in their backpack.",
          "Tables aren't reserved; unattended items go to the security office.",
          NO_NOISEMAKERS,
          "Pom poms are allowed in spectator seating only, never on the bench, including theme days.",
          PHOTOGRAPHERS,
          "Ball-free warm-up zones are for warm-ups without volleyballs. Balls are only for use on court.",
          "No pursuit across the centre line beyond the antenna.",
        ],
      },
      {
        kind: "travel",
        title: "Stay to Play",
        items: [
          "Travelling teams (125 km or more one way) must book hotels through HTG Sports to play the Ontario Championships. Minimum room nights match the convention centre events.",
        ],
      },
    ],
    documents: [
      {
        label: "Referee and venue update, April 10, 2026 (PDF)",
        url: "https://cdn2.sportngin.com/attachments/document/3413-3557216/Enecare_Referee___Venue_Update_April_10_2026.pdf",
      },
    ],
    events: [OC_2026_ENERCARE],
    source: {
      label: "OVA Ontario Championships page",
      url: "https://www.ontariovolleyball.org/page/show/3835478-ontario-championships",
    },
  },
  {
    id: "downsview",
    name: "National Beach Volleyball High-Performance Training Centre",
    aliases: ["downsview"],
    city: "Toronto",
    address: "75 Carl Hall Rd #3, North York (Downsview Park)",
    kind: "beach",
    intro:
      "Indoor sand courts at Downsview Park, the long-standing Toronto home of the Winter Beach Tour.",
    maps: [],
    details: [
      {
        kind: "schedule",
        title: "Event day",
        items: [
          "Mandatory team check-in is 8:30–8:50 am. Play runs from 9:00 am to 1:00 pm.",
          "Registration closes at 4 pm on the Monday before the event weekend. A division with fewer than 3 teams may be changed 2 Mondays before.",
        ],
      },
    ],
    documents: [
      {
        label: "2026 Beach Tour handbook (PDF)",
        url: "https://cdn3.sportngin.com/attachments/document/a35c-3547431/2026_Beach_Handbook_V6.pdf",
      },
    ],
    events: [WINTER_BEACH_TOUR],
    source: {
      label: "OVA Winter Beach Tour page",
      url: "https://www.ontariovolleyball.org/page/show/3836004-winter-beach-tour",
    },
  },
  {
    id: "beach-hangar",
    name: "The Beach Hangar",
    aliases: ["the beach hangar", "beach hangar"],
    city: "London",
    address: "15475 Robins Hill Road, London, ON",
    kind: "beach",
    intro:
      "OVA's London Winter Beach Tour location, back after its first season and run in partnership with OVA for year-round beach volleyball.",
    maps: [],
    details: [
      {
        kind: "schedule",
        title: "Event day",
        items: [
          "Mandatory team check-in is 8:30–8:50 am. Play runs from 9:00 am to 1:00 pm.",
          "Registration closes 2 Mondays before the event weekend.",
        ],
      },
    ],
    documents: [
      {
        label: "2026 Beach Tour handbook (PDF)",
        url: "https://cdn3.sportngin.com/attachments/document/a35c-3547431/2026_Beach_Handbook_V6.pdf",
      },
    ],
    events: [WINTER_BEACH_TOUR],
    source: {
      label: "OVA Winter Beach Tour page",
      url: "https://www.ontariovolleyball.org/page/show/3836004-winter-beach-tour",
    },
  },
];

const normalize = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The OVA profile for a venue name as a connector spells it, if OVA publishes one. */
export function venueProfile(name: string): OvaVenue | null {
  const key = normalize(name);
  return (
    OVA_VENUES.find((v) =>
      v.aliases.some((alias) => {
        const a = normalize(alias);
        return key === a || key.startsWith(`${a} `) || key.endsWith(` ${a}`);
      }),
    ) ?? null
  );
}

type AppEvent = EventLike & { start_date: string; end_date: string };

/** The app event for a major OVA event: the next one still running, else the latest. */
export function appEventFor<T extends AppEvent>(
  event: OvaMajorEvent,
  events: T[],
  today: string,
): T | undefined {
  const matches = events
    .filter(
      (e) =>
        eventSeries(e)?.id === event.series.id &&
        (!event.appTitle || event.appTitle.test(e.title)),
    )
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  return matches.find((e) => e.end_date >= today) ?? matches.at(-1);
}

/** Major OVA events that haven't finished, soonest first, with every venue they use. */
export function upcomingMajorEvents(today: string) {
  const byTitle = new Map<
    string,
    { event: OvaMajorEvent; venues: OvaVenue[] }
  >();
  for (const venue of OVA_VENUES)
    for (const event of venue.events) {
      if (event.ends < today) continue;
      const entry = byTitle.get(event.title) ?? { event, venues: [] };
      entry.venues.push(venue);
      byTitle.set(event.title, entry);
    }
  return [...byTitle.values()].sort((a, b) =>
    a.event.ends.localeCompare(b.event.ends),
  );
}
