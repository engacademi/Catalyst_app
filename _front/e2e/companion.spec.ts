import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const api = process.env.E2E_API_URL ?? "http://127.0.0.1:8000";
const headers = { "X-Dev-User": "dev-admin" };
const base = "/events/demo-championships";
let event: { id: string; divisions: { id: string; name: string }[] };
let team: { id: string; team_name: string };
let source: string;
async function getJson(request: APIRequestContext, path: string) {
  const res = await request.get(api + path, { headers });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}
test.beforeAll(async ({ request }) => {
  event = (await getJson(request, "/v1/events/demo-championships")).data;
  const detail = (await getJson(request, `/v1/admin/events/${event.id}`)).data;
  team = [...detail.entries].sort((a, b) =>
    a.team_name.localeCompare(b.team_name),
  )[0];
  source = detail.sources[0].id;
});

test("division follows persist; labels stay private and divisions stay below own teams", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/teams");
  await page
    .getByRole("button", { name: `+ ${event.divisions[0].name}`, exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: `Following · ${event.divisions[0].name}`,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Follow ${team.team_name}`, exact: true })
    .click();
  await page.goto(base + "/my-teams");
  await page
    .getByRole("textbox", { name: "Private label" })
    .fill("Maya's team");
  await page.goto(base + "/my-day");
  await expect(
    page.getByRole("heading", { name: "Next match", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Maya's team", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator("details")).not.toHaveAttribute("open");
  await page.locator("summary").click();
  await expect(
    page.getByRole("heading", { name: "Division schedule" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("large event browsing can reach entries beyond the first page", async ({
  request,
  page,
}) => {
  const csv =
    "external_entry_id,team_name,division\n" +
    Array.from(
      { length: 115 },
      (_, i) =>
        `LARGE-${i},Scale Team ${String(i).padStart(3, "0")},Scale Division`,
    ).join("\n");
  const staged = await request.post(api + "/v1/admin/imports", {
    headers,
    multipart: {
      event_id: event.id,
      source_id: source,
      kind: "entries",
      file: {
        name: "scale.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv),
      },
    },
  });
  expect(staged.ok()).toBeTruthy();
  const id = (await staged.json()).data.id;
  expect(
    (
      await request.post(api + `/v1/admin/imports/${id}/commit`, { headers })
    ).ok(),
  ).toBeTruthy();
  await page.goto(base + "/teams?q=Scale");
  await expect(page.getByText("Scale Team 000", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Load more teams", exact: true })
    .click();
  await expect(page.getByText("Scale Team 114", { exact: true })).toBeVisible();
});

test("staff schedule a division notice and manage an expiring court estimate", async ({
  page,
  request,
}) => {
  await page.goto(`/admin/events/${event.id}`);
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Division briefing");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Please check your court before reporting.");
  await page
    .getByLabel("Who sees it")
    .selectOption(`division:${event.divisions[0].id}`);
  await page.getByRole("button", { name: "Publish / schedule" }).click();
  await expect(
    page.getByText("Division briefing", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Courts & clock", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Court", exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Area label", { exact: true }).fill("Hall C");
  await page.getByRole("button", { name: "Post notice / save area" }).click();
  await expect(page.getByText("Court information updated.")).toBeVisible();
  const detail = (await getJson(request, `/v1/admin/events/${event.id}`)).data;
  expect(
    detail.venues
      .flatMap((v: { courts: { label: string }[] }) => v.courts)
      .some((c: { label: string }) => c.label.includes("Hall C")),
  ).toBeTruthy();
});

test("core phone journeys have no serious accessibility findings or horizontal overflow", async ({
  page,
}) => {
  await page.goto(base + "/teams");
  await page
    .getByRole("button", { name: `Follow ${team.team_name}`, exact: true })
    .click();
  for (const route of [
    "/teams",
    "/my-day",
    "/my-teams",
    "/matches",
    "/guide",
    "/updates",
    "/pathway",
  ]) {
    await page.goto(base + route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Loading event", { exact: true })).toHaveCount(
      0,
    );
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
      JSON.stringify(result.violations),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(base + "/my-day");
  await expect(
    page.getByRole("heading", { name: "My Day", exact: true }),
  ).toBeVisible();
});
