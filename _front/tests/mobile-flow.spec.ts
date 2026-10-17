import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
  venue_locations: [{ city: "Toronto", latitude: 43.65, longitude: -79.38 }],
  team_count: 20,
};
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
  court: {
    id: "c1",
    label: "Court 1",
    venue_name: "Enercare Centre",
    venue_id: "v1",
  },
  home: {
    entry_id: "t1",
    team_name: "Northern Lights",
    club_name: null,
    placeholder: null,
  },
  away: {
    entry_id: "t2",
    team_name: "Lakeshore",
    club_name: null,
    placeholder: null,
  },
  sets: [],
  sets_won: null,
  source: { ...source, observed_at: new Date().toISOString() },
  latest_change: null,
};
async function setup(page: Page) {
  await page.route("**/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { data: [] };
    if (path.endsWith("/events"))
      body = {
        data: [
          event,
          {
            ...event,
            id: "e2",
            slug: "beach-demo",
            title: "Beach Tour",
            kind: "beach",
            team_count: 10,
          },
        ],
      };
    else if (path.endsWith("/ontario-demo"))
      body = { data: { ...event, venues: [] }, sources: [source] };
    else if (path.endsWith("/matches"))
      body = { data: [match], sources: [source], next_cursor: null };
    else if (path.endsWith("/changes"))
      body = {
        data: [
          {
            id: 1,
            entity_type: "match",
            entity_id: "m1",
            entry_ids: ["t1"],
            event_type: "time_changed",
            diff: {},
            occurred_at: new Date().toISOString(),
            simulated: true,
          },
        ],
        next_before: null,
        matches: { m1: match },
        announcements: {},
        latest_id: 1,
        divisions: {},
        sources: [source],
      };
    return route.fulfill({ json: body });
  });
}
for (const width of [320, 390, 768, 1440]) {
  test(`navigation, discovery and guest profile fit ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    for (const path of [
      "/",
      "/tournaments",
      "/profile",
      "/schedule",
      "/updates",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".loading-state")).toHaveCount(0);
      await expect(
        page
          .getByRole("navigation", { name: "Main navigation" })
          .filter({ visible: true })
          .getByRole("link"),
      ).toHaveCount(4);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        path,
      ).toBeTruthy();
    }
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Updates", exact: true }),
    ).toBeVisible();
    await page.goto("/tournaments");
    await expect(
      page.getByRole("link", { name: "Updates", exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
test("saved tournament populates calendar, persists, hides and restores", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/tournaments");
  await page.getByRole("button", { name: "Save tournament" }).first().click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .filter({ visible: true })
    .getByRole("link", { name: "My Schedule" })
    .click();
  await expect(page.locator(".calendar-grid > section")).toHaveCount(3);
  await expect(
    page.getByText("Northern Lights", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/calendar-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Full week" }).click();
  await expect(page.locator(".calendar-grid > section")).toHaveCount(7);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".schedule-list")).toBeVisible();
  await page.locator(".schedule-visibility summary").click();
  await page.getByRole("checkbox", { name: event.title }).uncheck();
  await expect(page.getByText("All tournaments are hidden")).toBeVisible();
  await page.reload();
  await expect(page.getByText("All tournaments are hidden")).toBeVisible();
  await page.locator(".schedule-visibility summary").click();
  await page.getByRole("checkbox", { name: event.title }).check();
  await expect(
    page.getByText("Northern Lights", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/schedule-mobile.png",
    fullPage: true,
  });
});
test("location denial keeps Toronto and interests drive recommendations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: unknown,
          failure: (error: unknown) => void,
        ) => failure({ code: 1 }),
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(
    page.getByText("Location wasn't shared. Showing Toronto instead."),
  ).toBeVisible();
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Near Toronto" }) })
      .getByText(event.title),
  ).toBeVisible();
  await page.goto("/profile");
  await page.getByRole("button", { name: "Beach volleyball" }).click();
  await page.goto("/");
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Picked for you" }) })
      .getByText("Beach Tour"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/discover-mobile.png",
    fullPage: true,
  });
});
test("new public pages pass axe AA checks", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("courtside:saved-events", '["ontario-demo"]'),
  );
  for (const path of [
    "/",
    "/schedule",
    "/tournaments",
    "/profile",
    "/updates",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".loading-state")).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations,
      `${path}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })))}`,
    ).toEqual([]);
  }
});

test("profile badge clears after reading saved tournament updates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.addInitScript(() =>
    localStorage.setItem("courtside:saved-events", '["ontario-demo"]'),
  );
  await page.goto("/profile");
  await expect(page.locator(".platform-dock .unread-count")).toHaveText(
    "1 unread notifications",
  );
  await page.locator(".profile-links a").first().click();
  await expect(
    page.getByRole("heading", { name: "Updates", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".platform-dock .unread-count")).toHaveCount(0);
});
