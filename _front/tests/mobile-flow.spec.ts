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
      body = {
        data: {
          ...event,
          venues: [],
          divisions: [],
          counts: { entries: 20, matches: 3 },
        },
        sources: [source],
      };
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

  await expect(
    page.getByText("Location wasn’t shared. Showing Toronto instead."),
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
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations,
      `${path}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })))}`,
    ).toEqual([]);
  }
});

test("only the Discover bell shows unread notifications", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.addInitScript(() =>
    localStorage.setItem("courtside:saved-events", '["ontario-demo"]'),
  );
  await page.goto("/");
  await expect(page.locator(".platform-header .unread-count")).toHaveText("1");
  await expect(page.locator(".platform-dock .unread-count")).toHaveCount(0);
  await page.getByRole("link", { name: "Updates, 1 unread" }).click();
  await page.locator(".profile-links a").first().click();
  await expect(
    page.getByRole("heading", { name: "Updates", exact: true }),
  ).toBeVisible();
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator(".platform-header .unread-count")).toHaveCount(0);
});

for (const width of [320, 390, 768]) {
  test(`polished controls stay on two rows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Find your next game." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your courtside picks" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("The teams you love. The games around you."),
    ).toHaveCount(0);
    const near = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Near Toronto" }) });
    await expect(
      near.getByRole("combobox", { name: "Event location" }),
    ).toBeVisible();
    const rects = await page.locator(".discovery-filters").evaluate((el) => {
      const a = el.querySelector(".segmented")!.getBoundingClientRect();
      const b = el.querySelector("select")!.getBoundingClientRect();
      return { a: a.top, b: b.top, right: b.right };
    });
    expect(Math.abs(rects.a - rects.b)).toBeLessThan(5);
    expect(rects.right).toBeLessThanOrEqual(width);
    await expect(page.locator(".platform-header .by-ova")).toHaveText(
      "By Ontario Volleyball Association",
    );
    if (width === 390)
      await page.screenshot({
        path: "test-results/discover-polished-mobile.png",
        fullPage: true,
        animations: "disabled",
      });
    await page.goto("/tournaments");
    await page.getByRole("button", { name: "Save tournament" }).first().click();
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Your courtside picks" }),
    ).toBeVisible();
    await page.goto("/schedule");
    await expect(page.getByText("YOUR GAME PLAN")).toHaveCount(0);
    await expect(page.getByText(/Times shown in America/)).toHaveCount(0);
    const controls = await page.locator(".date-controls").evaluate((el) => {
      const today = Array.from(el.querySelectorAll("button"))
        .find((b) => b.textContent === "Today")!
        .getBoundingClientRect();
      const visibility = el.querySelector("summary")!.getBoundingClientRect();
      return {
        sameRow: Math.abs(today.top - visibility.top) < 5,
        adjacent: visibility.left > today.left,
      };
    });
    expect(controls).toEqual({ sameRow: true, adjacent: true });
    await expect(page.getByText("1 of 1 events shown")).toBeHidden();
    await page.locator(".schedule-visibility summary").click();
    await expect(page.getByText("1 of 1 events shown")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  });
}
test("overview uses compact attendance and label actions without redundant tabs or banner", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/events/ontario-demo");
  await expect(
    page.getByRole("heading", { name: "Ontario Championships", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Demo event · Fictional/)).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Tournament sections" });
  await expect(nav.getByRole("link", { name: "My event day" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "My teams" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Manage team labels" }),
  ).toHaveAttribute("href", "/events/ontario-demo/my-teams");
  const attended = page.getByRole("button", { name: "Attended", exact: true });
  await attended.click();
  await expect(attended).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(attended).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});
test("calendar uses scaled start times and separate overlap lanes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.addInitScript(() =>
    localStorage.setItem("courtside:saved-events", '["ontario-demo"]'),
  );
  await page.route("**/v1/events/ontario-demo/matches?**", (route) =>
    route.fulfill({
      json: {
        data: [
          { ...match, id: "a", scheduled_start: `${today}T14:00:00Z` },
          {
            ...match,
            id: "b",
            scheduled_start: `${today}T14:30:00Z`,
            home: { ...match.home, team_name: "Overlapping team" },
          },
          {
            ...match,
            id: "c",
            scheduled_start: `${today}T16:00:00Z`,
            home: { ...match.home, team_name: "Later team" },
          },
        ],
        sources: [source],
        next_cursor: null,
      },
    }),
  );
  await page.goto("/schedule");
  await expect(page.locator(".time-block")).toHaveCount(3);
  const geometry = await page.locator(".time-block").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, right: r.right, width: r.width };
    }),
  );
  expect(Math.round(geometry[1].top - geometry[0].top)).toBe(56);
  expect(Math.round(geometry[2].top - geometry[0].top)).toBe(224);
  expect(geometry[0].right).toBeLessThan(geometry[1].left);
  expect(geometry[2].width).toBeGreaterThan(geometry[0].width);
  await page.screenshot({
    path: "test-results/calendar-time-grid-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("discovery searches teams with navigable suggestions", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/v1/search?**", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "t1",
            kind: "Team",
            label: "Northern Lights",
            context: event.title,
            event_slug: event.slug,
            href: `/events/${event.slug}/teams/t1`,
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search teams, tournaments or venues" })
    .fill("Northern");
  const results = page.getByRole("region", { name: "Search results" });
  await expect(
    results.getByRole("link", { name: /Northern Lights/ }),
  ).toHaveAttribute("href", `/events/${event.slug}/teams/t1`);
  await expect(
    page.locator(".event-grid").getByText(event.title),
  ).toBeVisible();
  await expect(page.locator(".event-grid").getByText("Beach Tour")).toHaveCount(
    0,
  );
  await page
    .getByRole("textbox", { name: "Search teams, tournaments or venues" })
    .press("Escape");
  await expect(results).toHaveCount(0);
});

test("current location can be replaced and event venues link to directions", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (success: (position: unknown) => void) =>
          success({ coords: { latitude: 45.42, longitude: -75.69 } }),
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Near your location" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Event location" })
    .selectOption("Toronto");
  const nearby = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Near Toronto" }) });
  await expect(
    nearby.getByRole("link", { name: "Directions to Enercare Centre" }).first(),
  ).toHaveAttribute(
    "href",
    /google.com\/maps\/dir\/\?api=1&destination=Enercare%20Centre%2C%20Toronto/,
  );
});

test("compact saved picks, sponsor ribbon and profile saved-team lists", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() => {
    localStorage.setItem("courtside:saved-events", '["ontario-demo"]');
    localStorage.setItem("courtside:follows:ontario-demo", '["t1"]');
  });
  await page.route("**/v1/sponsors", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "sp1",
            name: "Rally Sports",
            kind: "sponsor",
            link_url: "https://example.com/",
          },
        ],
      },
    }),
  );
  await page.route("**/v1/events/ontario-demo/teams?**", (route) =>
    route.fulfill({
      json: { data: [{ id: "t1", team_name: "Northern Lights" }], total: 1 },
    }),
  );
  await page.goto("/");
  const pick = page.locator(".compact-pick .event-tile").first();
  const nearby = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Near Toronto" }) });
  await expect(pick).toBeVisible();
  const small = await pick.boundingBox();
  const heart = await pick
    .getByRole("button", { name: "Unsave tournament" })
    .boundingBox();
  expect(small!.x + small!.width - heart!.x - heart!.width).toBeLessThan(12);
  expect(heart!.y - small!.y).toBeLessThan(12);
  const full = await nearby.locator(".event-tile").first().boundingBox();
  expect(small!.height).toBeLessThan(full!.height * 0.65);
  const sponsor = page.getByRole("region", { name: "Our sponsors" });
  await expect(sponsor).toBeVisible();
  expect((await sponsor.boundingBox())!.y).toBeGreaterThan(
    (await page.locator(".saved-discovery").boundingBox())!.y,
  );
  expect((await sponsor.boundingBox())!.y).toBeLessThan(
    (await nearby.boundingBox())!.y,
  );
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Saved teams" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Northern Lights Ontario Championships/ }),
  ).toHaveAttribute("href", "/events/ontario-demo/teams/t1");
  await expect(page.locator(".profile-page .event-tile")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/profile-saved-lists.png",
    fullPage: true,
  });
});

test("schedule list removes source and tournament-label clutter", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() =>
    localStorage.setItem("courtside:saved-events", '["ontario-demo"]'),
  );
  await page.goto("/schedule");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".schedule-list .match-card")).toHaveCount(1);
  await expect(page.locator(".schedule-list .match-card-source")).toHaveCount(
    0,
  );
  await expect(page.locator(".schedule-event-label")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/calendar-list-mobile.png",
    fullPage: true,
  });
});

test("discovery carousel cards keep equal bounded heights", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "courtside:saved-events",
      '["ontario-demo","beach-demo"]',
    ),
  );
  await page.goto("/");
  await expect(page.locator(".event-tile").first()).toBeVisible();
  for (const list of await page.locator(".event-carousel").all()) {
    const sizes = await list
      .locator(".event-tile")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    if (sizes.length) {
      expect(Math.max(...sizes)).toBeLessThan(480);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(2);
    }
  }
  await page.screenshot({
    path: "test-results/discover-final-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("visibility popover has compact switches and working bulk controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "courtside:saved-events",
      '["ontario-demo","beach-demo"]',
    ),
  );
  await page.goto("/schedule");
  await page.locator(".schedule-visibility summary").click();
  const panel = page.getByRole("region", { name: "Calendar visibility" });
  await expect(panel.getByRole("checkbox")).toHaveCount(2);
  await expect(panel.locator(".visibility-switch").first()).toHaveCSS(
    "width",
    "36px",
  );
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await panel.getByRole("button", { name: "Hide all", exact: true }).click();
  await expect(page.getByText("All tournaments are hidden")).toBeVisible();
  await panel.getByRole("button", { name: "Show all", exact: true }).click();
  await expect(panel.getByText("2 of 2 events shown")).toBeVisible();
  await page.screenshot({
    path: "test-results/visibility-final-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await panel.getByRole("button", { name: "Close visibility" }).click();
  await expect(panel).not.toBeVisible();
});
