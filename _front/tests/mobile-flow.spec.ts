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
    page
      .getByRole("list", { name: "Explore tournaments" })
      .getByText(event.title),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Explore tournaments" })
      .getByText("Beach Tour"),
  ).toHaveCount(0);
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

test("team followers get division notices and clear change wording", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  const at = new Date().toISOString();
  const base = { entity_type: "match", entity_id: "m1", entry_ids: ["t1"] };
  await page.route("**/v1/events/ontario-demo/changes*", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 4,
            entity_type: "announcement",
            entity_id: "a1",
            division_id: "d1",
            entry_ids: ["t1", "t2"],
            event_type: "announcement_published",
            diff: {},
            occurred_at: at,
            simulated: false,
          },
          {
            ...base,
            id: 3,
            event_type: "delay_cleared",
            diff: { minutes: 0 },
            notice: "cleared",
            occurred_at: at,
            simulated: false,
          },
          {
            ...base,
            id: 2,
            event_type: "delay_notice",
            diff: { minutes: 20, expires_at: at },
            notice: "expired",
            occurred_at: at,
            simulated: false,
          },
          {
            ...base,
            id: 1,
            event_type: "time_changed",
            diff: {
              scheduled_start: [match.scheduled_start, match.scheduled_start],
              estimated_start: [null, `${today}T23:20:00Z`],
            },
            occurred_at: at,
            simulated: false,
          },
        ],
        next_before: null,
        matches: { m1: match },
        announcements: {
          a1: {
            id: "a1",
            category: "general",
            title: "Division warm-up moved",
            body: "Gym B",
            entry_id: null,
            division_id: "d1",
            entry_ids: ["t1", "t2"],
            publish_at: at,
            expire_at: null,
            revision: 1,
          },
        },
        latest_id: 4,
        divisions: {},
        sources: [source],
      },
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("courtside:follows:ontario-demo", '["t1"]'),
  );
  await page.goto("/events/ontario-demo/updates");
  await expect(page.getByText("Division warm-up moved")).toBeVisible();
  await expect(page.getByText("Court delay cleared")).toBeVisible();
  await expect(page.getByText(/Court delay: 0 minutes/)).toHaveCount(0);
  await expect(page.getByText("Court delay notice (expired)")).toBeVisible();
  await expect(page.getByText("Estimated start changed")).toBeVisible();
  await expect(page.getByText(/Official time unchanged/)).toBeVisible();
});

test("overview and team follow lead to My event day, labels and updates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.route("**/v1/entries/t1", (route) =>
    route.fulfill({
      json: {
        data: {
          id: "t1",
          team_name: "Northern Lights",
          club_name: null,
          division: null,
          event,
          roster: null,
          matches: [match],
        },
        sources: [source],
      },
    }),
  );
  await page.goto("/events/ontario-demo");
  const panel = page.getByRole("region", { name: "Make this event yours" });
  await expect(
    panel.getByRole("link", { name: "Find your teams" }),
  ).toHaveAttribute("href", "/events/ontario-demo/teams");
  await expect(
    panel.getByRole("link", { name: /Event updates/ }),
  ).toHaveAttribute("href", "/events/ontario-demo/updates");
  await page.goto("/events/ontario-demo/teams/t1");
  await page.getByRole("button", { name: "Follow Northern Lights" }).click();
  await expect(
    page.getByRole("link", { name: "Add a private label" }),
  ).toHaveAttribute("href", "/events/ontario-demo/my-teams");
  await page.getByRole("link", { name: "Open My event day" }).click();
  await expect(page).toHaveURL(/\/events\/ontario-demo\/my-day$/);
  await page.goto("/events/ontario-demo");
  const following = page.getByRole("region", { name: "Following 1 team" });
  await expect(
    following.getByRole("link", { name: "Open My event day" }),
  ).toHaveAttribute("href", "/events/ontario-demo/my-day");
  await expect(
    following.getByRole("link", { name: "My teams & labels" }),
  ).toHaveAttribute("href", "/events/ontario-demo/my-teams");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});

test("follows saved under an event UUID move to the slug key", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("courtside:follows:e1", '["t1","division:d1"]');
    localStorage.setItem("courtside:follows:ontario-demo", '["t2"]');
    localStorage.setItem("courtside:label:e1:t1", "Maya");
    localStorage.setItem("courtside:seen:e1", "4");
  });
  await page.goto("/profile");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("courtside:follows:e1")),
    )
    .toBeNull();
  const stored = await page.evaluate(() => ({
    follows: JSON.parse(
      localStorage.getItem("courtside:follows:ontario-demo") ?? "[]",
    ),
    label: localStorage.getItem("courtside:label:ontario-demo:t1"),
    seen: localStorage.getItem("courtside:seen:ontario-demo"),
  }));
  expect(stored.follows.sort()).toEqual(["division:d1", "t1", "t2"]);
  expect(stored.label).toBe("Maya");
  expect(stored.seen).toBe("4");
});

test("work duties are labelled on the schedule, matches and calendar", async ({
  page,
}) => {
  await setup(page);
  const duty = {
    ...match,
    id: "m2",
    work_entry_id: "t9",
    work_team: { entry_id: "t9", team_name: "Forest Hill Spikers" },
  };
  await page.route("**/v1/events/ontario-demo/matches?**", (route) =>
    route.fulfill({
      json: { data: [match, duty], sources: [source], next_cursor: null },
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("courtside:follows:ontario-demo", '["t9"]'),
  );
  await page.goto("/schedule");
  await expect(
    page.getByRole("link", { name: /^Work duty for Forest Hill Spikers/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "List", exact: true }).click();
  const cards = page.locator(".schedule-list .match-card");
  await expect(cards).toHaveCount(2);
  await expect(page.locator(".match-card-duty")).toHaveCount(1);
  await expect(page.locator(".match-card-duty")).toContainText(
    "Work duty: referee / scorekeeping",
  );
  await expect(page.locator(".match-card-duty")).toContainText(
    "Forest Hill Spikers officiates this match",
  );
  await page.goto("/events/ontario-demo/matches");
  await expect(page.locator(".match-card-duty")).toHaveCount(1);
});

test("guide lists courts under their hall headings", async ({ page }) => {
  await setup(page);
  const court = (id: string, label: string, area: string | null) => ({
    id,
    label: area ? `${label} · ${area}` : label,
    base_label: label,
    area_label: area,
  });
  await page.route("**/v1/events/ontario-demo/guide", (route) =>
    route.fulfill({
      json: {
        data: {
          venues: [
            {
              id: "v1",
              name: "Enercare Centre",
              address: null,
              accessible_entrance: null,
              directions: null,
              map_url: null,
              courts: [
                court("c1", "Court 1", "Hall A"),
                court("c2", "Court 53", "Hall C"),
                court("c3", "Court 2", "Hall A"),
                court("c4", "Warm-up", null),
              ],
            },
          ],
          items: [],
          partners: [],
        },
      },
    }),
  );
  await page.goto("/events/ontario-demo/guide");
  await expect(page.locator(".court-area-heading")).toHaveText([
    "Hall A",
    "Hall C",
    "Other courts",
  ]);
  const hallA = page.getByRole("list", {
    name: "Courts at Enercare Centre, Hall A",
  });
  await expect(hallA.getByRole("link")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Court 53 · Hall C: view matches" }),
  ).toBeVisible();
});

for (const width of [320, 390]) {
  test(`list rows reflow under 200% text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page.route("**/v1/events/ontario-demo/teams?**", (route) =>
      route.fulfill({
        json: {
          data: [
            {
              id: "t1",
              team_name: "Northern Lights Volleyball Club 16U Elite",
              club_name: "Northern Lights",
              division: { id: "d1", name: "16U Girls Division 1", code: "16U" },
            },
          ],
          total: 1,
        },
      }),
    );
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.fontSize = "200%";
      });
    });
    const fits = async (selector: string) => {
      await expect(page.locator(selector).first()).toBeVisible();
      const overflow = await page.evaluate(
        (sel) =>
          Math.max(
            document.documentElement.scrollWidth,
            ...[...document.querySelectorAll(sel)].map(
              (el) => el.getBoundingClientRect().right,
            ),
          ),
        selector,
      );
      expect(overflow).toBeLessThanOrEqual(width);
    };
    await page.goto("/events/ontario-demo/teams");
    await page.locator(".team-picker summary").click();
    await fits("li.team-picker-option");
    await fits("li.team-picker-option a");
    await page.goto("/events/ontario-demo/matches");
    await fits(".match-card");
  });
}

test("guide shows OVA match-day rules for the event's kind", async ({
  page,
}) => {
  await setup(page);
  const guide = { venues: [], items: [], partners: [] };
  await page.route("**/v1/events/ontario-demo/guide", (route) =>
    route.fulfill({ json: { data: guide } }),
  );
  await page.goto("/events/ontario-demo/guide");
  const rules = page.getByRole("region", { name: "Match-day rules" });
  await expect(rules.getByText(/uses 8-4-4/)).toBeVisible();
  await expect(
    rules.getByRole("link", {
      name: /Youth Competitions Manual 2026-27 §6\.5/,
    }),
  ).toHaveAttribute("href", /YCM_2026-2027/);
  await expect(rules.getByText("Check-in")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Official OVA documents" })
      .getByRole("link", { name: /Roster Verification Process/ }),
  ).toBeVisible();
  await expect(page.locator('a[href="tel:647-467-5514"]')).toHaveCount(1);

  await page.route("**/v1/events/ontario-demo", (route) =>
    route.fulfill({
      json: {
        data: {
          ...event,
          kind: "beach",
          venues: [],
          divisions: [],
          counts: { entries: 20, matches: 3 },
        },
        sources: [source],
      },
    }),
  );
  await page.reload();
  await expect(
    rules.getByText(/both partners check in together/),
  ).toBeVisible();
  await expect(rules.getByText(/uses 8-4-4/)).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Official OVA documents" })
      .getByRole("link", { name: /Beach Tour Handbook 2026/ }),
  ).toBeVisible();
  await expect(page.locator('a[href="tel:647-467-5514"]')).toHaveCount(0);
});

test.describe("courtside picks", () => {
  const future = new Date(Date.now() + 3 * 3600_000).toISOString();
  async function pick(page: Page, storage: Record<string, string>) {
    await setup(page);
    let matchRequests = 0;
    await page.route("**/v1/events/ontario-demo/matches**", (route) => {
      matchRequests++;
      return route.fulfill({
        json: {
          data: [{ ...match, scheduled_start: future }],
          sources: [source],
          next_cursor: null,
        },
      });
    });
    await page.addInitScript((items) => {
      for (const [key, value] of Object.entries(items))
        localStorage.setItem(key, value);
    }, storage);
    await page.goto("/");
    const picks = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Your courtside picks" }),
      });
    await expect(
      picks.getByRole("link", { name: "Ontario Championships" }),
    ).toBeVisible();
    return { picks, matchRequests: () => matchRequests };
  }

  test("a saved event with no followed team shows only the event", async ({
    page,
  }) => {
    const { picks, matchRequests } = await pick(page, {
      "courtside:saved-events": JSON.stringify(["ontario-demo"]),
    });
    await expect(picks.locator(".saved-next")).toHaveCount(0);
    expect(matchRequests()).toBe(0);
  });

  test("a followed team shows that team's next match by name", async ({
    page,
  }) => {
    const { picks } = await pick(page, {
      "courtside:follows:ontario-demo": JSON.stringify(["t1"]),
    });
    const next = picks.locator(".saved-next");
    await expect(next).toContainText("Northern Lights: playing here");
    await expect(next).toContainText("vs Lakeshore");
    await expect(next).toContainText("Court 1");
  });

  test("a team label replaces the team name", async ({ page }) => {
    const { picks } = await pick(page, {
      "courtside:follows:ontario-demo": JSON.stringify(["t2"]),
      "courtside:label:ontario-demo:t2": "Maya's team",
    });
    const next = picks.locator(".saved-next");
    await expect(next).toContainText("Maya's team: playing here");
    await expect(next).toContainText("vs Northern Lights");
  });
});
