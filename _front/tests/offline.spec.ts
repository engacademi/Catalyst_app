import { test, expect, type Page } from "@playwright/test";

// R-27: the guide and last-loaded schedule stay readable on venue Wi-Fi, labelled with
// the time they were saved. Needs the production build, where the service worker runs.
const today = new Date().toISOString().slice(0, 10);
const source = {
  id: "s1",
  name: "Approved export",
  mode: "manual_import",
  freshness: "imported_snapshot",
  status: "healthy",
  last_checked_at: null,
  last_import_at: null,
};
const event = {
  id: "e1",
  slug: "ontario-demo",
  title: "Ontario Championships",
  kind: "indoor",
  timezone: "America/Toronto",
  start_date: today,
  end_date: today,
  status: "published",
  is_demo: true,
  revision: 1,
  venues: ["Enercare Centre"],
  team_count: 2,
};
const venue = {
  id: "v1",
  name: "Enercare Centre",
  address: "100 Princes' Blvd, Toronto",
  accessible_entrance: "Ramp at Gate 2",
  directions: null,
  map_url: null,
  courts: [{ id: "c1", label: "Court 1" }],
};
const team = (id: string, name: string) => ({
  entry_id: id,
  team_name: name,
  club_name: null,
  placeholder: null,
});
const match = {
  id: "m1",
  source_match_id: "1",
  revision: 1,
  status: "scheduled",
  result_state: "pending",
  round_label: "Pool A",
  division: null,
  scheduled_start: `${today}T23:00:00Z`,
  estimated_start: null,
  timezone: "America/Toronto",
  court: { id: "c1", label: "Court 1", venue_name: venue.name, venue_id: "v1" },
  home: team("t1", "Northern Lights"),
  away: team("t2", "Lakeshore"),
  sets: [],
  sets_won: null,
  source: { ...source, observed_at: new Date().toISOString() },
  latest_change: null,
};

type Network = "online" | "offline" | "failing";

async function mockApi(page: Page, network: { state: Network }) {
  await page.route("**/v1/**", (route) => {
    if (network.state !== "online") return route.abort("internetdisconnected");
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { data: [] };
    if (path.endsWith("/events")) body = { data: [event] };
    else if (path.endsWith("/ontario-demo"))
      body = {
        data: {
          ...event,
          venues: [venue],
          divisions: [],
          counts: { entries: 2, matches: 1 },
        },
        sources: [source],
      };
    else if (path.endsWith("/guide"))
      body = {
        data: {
          venues: [venue],
          items: [
            {
              id: "g1",
              venue_id: "v1",
              kind: "parking",
              title: "Parking",
              body: "Lot 3 opens at 7:00.",
              link_url: null,
              sort: 1,
              revision: 1,
            },
          ],
          partners: [],
        },
      };
    else if (path.endsWith("/matches"))
      body = { data: [match], sources: [source], next_cursor: null };
    else if (path.endsWith("/changes"))
      body = {
        data: [],
        next_before: null,
        matches: {},
        announcements: {},
        latest_id: 0,
        divisions: {},
        sources: [source],
      };
    return route.fulfill({ json: body });
  });
}

// The guide keeps venue details folded inside each "Getting around" card.
async function openParking(page: Page) {
  await page
    .locator(".venue-quick-card", { hasText: "Parking & directions" })
    .getByRole("link", { name: "View details" })
    .click();
}

async function visitAndSave(page: Page, path: string, text: string) {
  await page.goto(path);
  if (path.endsWith("/guide")) await openParking(page);
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-offline-saved",
    path,
  );
}

test("guide and My Schedule reload offline with their saved time", async ({
  page,
  context,
}) => {
  const network = { state: "online" as Network };
  await mockApi(page, network);
  await page.goto("/tournaments");
  await page.evaluate(() =>
    localStorage.setItem(
      "courtside:saved-events",
      JSON.stringify(["ontario-demo"]),
    ),
  );

  await visitAndSave(page, "/events/ontario-demo/guide", "Lot 3 opens at 7:00.");
  await visitAndSave(page, "/schedule", "Northern Lights");
  await expect(page.locator(".connection-banner")).toHaveCount(0);
  await page.waitForFunction(() =>
    (localStorage.getItem("courtside:offline-cache:v1") ?? "").includes(
      "saved-schedule",
    ),
  );

  network.state = "offline";
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Northern Lights", { exact: true })).toBeVisible();
  await expect(page.locator(".connection-banner")).toContainText(
    /Offline — showing schedule saved at \d{1,2}:\d{2}/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/offline-schedule.png" });

  await page.goto("/events/ontario-demo/guide");
  await openParking(page);
  await expect(
    page.getByText("Lot 3 opens at 7:00.", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".connection-banner")).toContainText(
    "Offline — showing venue guide saved at",
  );

  // A page never visited online gets an honest offline notice, not a browser error.
  await page.goto("/events/ontario-demo/teams");
  await expect(
    page.getByRole("heading", { name: "You're offline" }),
  ).toBeVisible();

  // The app server answers but the API does not: saved data stays, labelled as such.
  network.state = "failing";
  await context.setOffline(false);
  await page.goto("/schedule");
  await expect(page.getByText("Northern Lights", { exact: true })).toBeVisible();
  await expect(page.locator(".connection-banner")).toContainText(
    /Weak connection — showing schedule saved at/,
  );

  network.state = "online";
  await page.reload();
  await expect(page.getByText("Northern Lights", { exact: true })).toBeVisible();
  await expect(page.locator(".connection-banner")).toHaveCount(0);
});
