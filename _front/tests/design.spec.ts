/** UI contract tests. These fixtures do not replace API/database integration tests. */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const eventId = "demo-championships";
const base = `/events/${eventId}`;
const now = new Date().toISOString();
const next = new Date(Date.now() + 3_600_000).toISOString();
const source = {
  id: "csv-1",
  name: "Tournament CSV",
  mode: "manual_import",
  status: "active",
  official_url: null,
  last_checked_at: now,
  last_import_at: now,
  upstream_updated_at: null,
  freshness: "imported_snapshot",
  generation: 1,
};
const division = { id: "d1", name: "16U Girls Division 1", code: "16UG D1" };
const venue = {
  id: "v1",
  name: "Enercare Centre",
  address: "100 Princes' Boulevard, Toronto",
  accessible_entrance: "Use the east entrance",
  directions: "Follow signs to Hall C",
  map_url: "https://example.com/map",
  courts: [{ id: "c1", label: "Court 12" }],
};
const entries = [
  {
    id: "t1",
    team_name: "Northern Lights Volleyball",
    club_name: "Northern Lights VC",
    division,
  },
  {
    id: "t2",
    team_name: "Lakeshore Thunder",
    club_name: "Lakeshore VC",
    division,
  },
];
const event = {
  id: eventId,
  slug: eventId,
  title: "Ontario Championships",
  kind: "indoor",
  timezone: "America/Toronto",
  start_date: "2026-10-17",
  end_date: "2026-10-19",
  status: "published",
  is_demo: true,
  revision: 1,
  venues: [venue],
  divisions: [division],
  counts: { entries: 2, matches: 2 },
};
const match = {
  id: "m1",
  source_match_id: "S1",
  revision: 1,
  status: "scheduled",
  result_state: "pending",
  round_label: "Pool A",
  division,
  scheduled_start: next,
  estimated_start: null,
  timezone: "America/Toronto",
  court: {
    id: "c1",
    label: "Court 12",
    venue_id: "v1",
    venue_name: venue.name,
  },
  home: {
    entry_id: "t1",
    team_name: entries[0].team_name,
    club_name: entries[0].club_name,
    placeholder: null,
  },
  away: {
    entry_id: "t2",
    team_name: entries[1].team_name,
    club_name: entries[1].club_name,
    placeholder: null,
  },
  sets: [],
  sets_won: null,
  source: { ...source, observed_at: now, source_updated_at: null },
  latest_change: null,
};
const result = {
  ...match,
  id: "m2",
  status: "completed",
  sets: [
    { set_number: 1, home: 25, away: 20 },
    { set_number: 2, home: 25, away: null },
  ],
  sets_won: { home: 2, away: 0 },
  result_state: "final",
};
const announcement = {
  id: "a1",
  category: "venue",
  title: "East entrance is open",
  body: "Use the east doors for accessible entry.",
  entry_id: null,
  division_id: null,
  publish_at: now,
  expire_at: null,
  revision: 1,
  state: "published",
};
const change = {
  id: 1,
  entity_type: "announcement",
  entity_id: "a1",
  entity_revision: 1,
  event_type: "announcement_published",
  diff: {},
  entry_ids: [],
  simulated: true,
  occurred_at: now,
};

async function fixtures(page: Page) {
  await page.route("**/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/backend/, "");
    const wrap = (data: unknown) => ({ data, sources: [source] });
    let body: unknown;
    if (path === "/v1/events")
      body = { data: [{ ...event, venues: [venue.name] }] };
    else if (path === `/v1/events/${eventId}`) body = wrap(event);
    else if (path.endsWith("/teams"))
      body = {
        data: entries.filter((e) =>
          e.team_name
            .toLowerCase()
            .includes((url.searchParams.get("q") || "").toLowerCase()),
        ),
        total: 2,
      };
    else if (path.endsWith("/pathway"))
      body = {
        data: [{ label: "Pool A", matches: [match, result] }],
        sources: [source],
        note: "Published competition path",
      };
    else if (path.endsWith("/my-day"))
      body = wrap({
        next_match_id: "m1",
        next_by_entry: { t1: "m1" },
        upcoming_ids: ["m1"],
        awaiting_schedule_ids: [],
        completed_ids: ["m2"],
        conflicts: [],
        assumed_match_minutes: 60,
        entries,
        matches: { m1: match, m2: result },
      });
    else if (path.endsWith("/changes"))
      body = {
        data: [change],
        matches: {},
        announcements: { a1: announcement },
        latest_id: 1,
        sources: [source],
      };
    else if (path === `/v1/events/${eventId}/matches`)
      body = {
        data: url.searchParams.get("status") === "results" ? [result] : [match],
        next_cursor: null,
        sources: [source],
      };
    else if (path.startsWith("/v1/matches/"))
      body = wrap({
        ...(path.endsWith("m2") ? result : match),
        event,
        history: [],
      });
    else if (path.startsWith("/v1/entries/"))
      body = wrap({
        ...entries[0],
        event,
        matches: [match, result],
        roster: {
          version: 1,
          published_at: now,
          team_photo_url: null,
          players: [
            {
              jersey: 7,
              display_name: "Avery (fictional)",
              position: "Setter",
              photo_url: null,
            },
          ],
        },
      });
    else if (path === `/v1/events/${eventId}/announcements`)
      body = { data: [announcement] };
    else if (path.endsWith("/guide") || path.endsWith("/guide-items"))
      body = {
        data: {
          venues: [venue],
          items: [
            {
              id: "g1",
              venue_id: "v1",
              kind: "parking",
              title: "Parking",
              body: "Use the underground car park.",
              link_url: null,
              sort: 0,
              revision: 1,
            },
            {
              id: "g2",
              venue_id: null,
              kind: "officials",
              title: "Scoring guide",
              body: "Review the official scoring guide.",
              link_url: "https://example.com/scoring",
              sort: 1,
              revision: 1,
            },
          ],
          partners: [
            {
              id: "p1",
              kind: "fundraiser",
              name: "Community 50/50",
              body: "Support community volleyball",
              link_url: "https://example.com/draw",
              logo_url: null,
              booth_location: "Hall C",
              seller_note: "External seller",
              sort: 0,
              active: true,
              revision: 1,
            },
          ],
        },
      };
    else if (path === "/v1/admin/me")
      body = { grants: [{ role: "admin", event_id: null }], is_staff: true };
    else if (path === "/v1/admin/events") body = { data: [event] };
    else if (path === `/v1/admin/events/${eventId}`)
      body = { data: { ...event, sources: [source], entries } };
    else if (path === "/v1/me/assignments") body = { data: [] };
    else if (path.endsWith("/announcements")) body = { data: [announcement] };
    else body = { data: [] };
    await route.fulfill({
      json: body,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

for (const width of [390, 768, 1440]) {
  test(`all attendee pages render and fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await fixtures(page);
    await page.addInitScript(
      ({ eventId }) =>
        localStorage.setItem(`courtside:follows:${eventId}`, '["t1"]'),
      { eventId },
    );
    for (const path of [
      "/",
      base,
      `${base}/my-day`,
      `${base}/teams`,
      `${base}/matches`,
      `${base}/matches/m2`,
      `${base}/teams/t1`,
      `${base}/my-teams`,
      `${base}/pathway`,
      `${base}/guide`,
      `${base}/updates`,
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".loading-state")).toHaveCount(0);
      await noOverflow(page);
    }
    await page.goto(`${base}/my-day`);
    await expect(page.getByText("Next on court")).toBeVisible();
    await page.screenshot({
      path: `test-results/my-day-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Find your next game." })).toBeVisible();
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("following survives navigation and reload; search and match filters retain URLs", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto(`${base}/teams`);
  const follow = page.getByRole("button", {
    name: `Follow ${entries[0].team_name}`,
    exact: true,
  });
  await follow.click();
  await expect(
    page.getByRole("button", {
      name: `Unfollow ${entries[0].team_name}`,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: `Unfollow ${entries[0].team_name}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("Northern");
  await expect(page).toHaveURL(/q=Northern/);
  await page.goto(`${base}/my-day`);
  await expect(page.getByText("Next on court")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Download matches/ }),
  ).toHaveAttribute("href", /calendar\.ics\?entry_ids=t1/);
  await page.goto(`${base}/matches`);
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(page).toHaveURL(/status=results/);
  await expect(
    page.locator(".match-card").getByText("Final", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".match-card").getByText("25 25", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".match-card").getByText("20 –", { exact: true }),
  ).toBeVisible();
});

test("guide resources, approved roster and guest empty state remain accessible", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto(`${base}/my-day`);
  await expect(
    page.getByRole("link", { name: "Find your teams", exact: true }),
  ).toBeVisible();
  await page.goto(`${base}/guide`);
  await expect(
    page.getByRole("link", { name: /Open.*resource/ }),
  ).toHaveAttribute("href", "https://example.com/scoring");
  await expect(page.getByText("Use the east entrance")).toBeVisible();
  await page.goto(`${base}/teams/t1`);
  await expect(page.getByText("Avery (fictional)")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});

test("staff tools and forms remain reachable on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtures(page);
  await page.goto("/admin");
  await page.getByRole("link", { name: /Ontario Championships/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ontario Championships" }),
  ).toBeVisible();
  for (const name of [
    "Announcements",
    "Imports",
    "Content",
    "Rosters",
    "Registration",
    "Assignments",
    "Courts & clock",
    "Sources",
    "Demo tools",
    "Audit",
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await noOverflow(page);
  }
  await page.getByRole("tab", { name: "Announcements", exact: true }).click();
  await page
    .getByRole("tab", { name: "Announcements", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Imports", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("tab", { name: "Imports", exact: true })
    .press("ArrowLeft");
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/staff-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("core journeys have no WCAG A/AA axe violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixtures(page);
  for (const path of [
    "/",
    base,
    `${base}/teams`,
    `${base}/matches`,
    `${base}/guide`,
    "/admin",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".loading-state")).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations,
      `${path}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
    ).toEqual([]);
  }
});

test("320px reflow and reduced motion remain usable", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of [
    "/",
    base,
    `${base}/teams`,
    `${base}/matches`,
    `${base}/guide`,
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await noOverflow(page);
  }
  expect(
    await page
      .locator(".route-content")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("attendee routes produce no browser runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) =>
    errors.push(`${page.url()}: ${error.message}`),
  );
  await fixtures(page);
  for (const path of [
    "/",
    base,
    `${base}/my-day`,
    `${base}/teams`,
    `${base}/matches`,
    `${base}/matches/m2`,
    `${base}/teams/t1`,
    `${base}/my-teams`,
    `${base}/pathway`,
    `${base}/guide`,
    `${base}/updates`,
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".loading-state")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("merged division follows, private labels, pathway and staff estimates remain usable", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto(`${base}/teams`);
  const followDivision = page.getByRole("button", {
    name: /16U Girls Division 1/,
  });
  await followDivision.click();
  await expect(followDivision).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", {
      name: `Follow ${entries[0].team_name}`,
      exact: true,
    })
    .click();
  await page.goto(`${base}/my-teams`);
  await page
    .getByRole("textbox", { name: "Private label" })
    .fill("Maya's team");
  await page.goto(`${base}/my-day`);
  await expect(page.getByText("Maya's team", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Divisions you follow")).toBeVisible();
  await page.locator("summary").click();
  await expect(
    page.getByText("Division schedule", { exact: true }),
  ).toBeVisible();
  await page.goto(`${base}/pathway`);
  await expect(
    page.getByRole("heading", { name: "Competition path" }),
  ).toBeVisible();
  await expect(page.locator(".match-card")).toHaveCount(2);
  await page.route("**/v1/matches/m1", (route) =>
    route.fulfill({
      json: {
        data: {
          ...match,
          event,
          history: [],
          estimated_start: next,
          estimate_source: "OVA staff",
          delay_notice: {
            minutes: 20,
            posted_by: "OVA staff",
            posted_at: now,
            expires_at: next,
          },
          expected_start_soon: true,
        },
        sources: [source],
      },
    }),
  );
  await page.goto(`${base}/matches/m1`);
  await expect(page.getByText(/Court running ~20 minutes late/)).toBeVisible();
  await expect(page.getByText(/Official time remains unchanged/)).toBeVisible();
  await expect(page.getByText(/Expected to start soon/)).toBeVisible();
});
