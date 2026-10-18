import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const filename = path.join(testDirectory, "..", "lib/ova-venues.ts");
const code = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiled = { exports: {} };
vm.runInNewContext(code, { module: compiled, exports: compiled.exports });
const { eventSeries, venueProfile, appEventFor, upcomingMajorEvents, OVA_VENUES } =
  compiled.exports;

// Titles and venue names exactly as the live connectors publish them.
const series = (title, venues = []) => eventSeries({ title, venues })?.id ?? null;

test("Ontario Championships events get the logo for their venue", () => {
  assert.equal(
    series("2026 Ontario Championships - Event 3 (6v6B, 16U, 18U)", ["Enercare Centre"]),
    "ontario-championships",
  );
  assert.equal(
    series("2026 Ontario Championships - 4v4 Boys and Girls", [
      "Niagara Falls Convention Centre",
    ]),
    "ontario-championships-niagara",
  );
  assert.equal(
    series("Ontario Championships Demo (simulated source)", ["Exhibition Sports Centre"]),
    null,
  );
});

test("only OVA's Fall Classic gets the Fall Classic logo", () => {
  assert.equal(series("OVA Fall Classic 2026", []), "fall-classic");
  assert.equal(
    series("2026 Fall Classic - Event 1 (16UG D1/D2)", ["Cohere Centre"]),
    "fall-classic",
  );
  assert.equal(
    series("17U Girls Strikers Fall Classic - Exhibition", ["David Suzuki SS"]),
    null,
  );
});

test("other series are recognised from their titles", () => {
  assert.equal(series("WBT - Downsview- 18U", ["Downsview"]), "winter-beach-tour");
  assert.equal(series("2027 New Year's Open - Event 1", []), "new-years-open");
  assert.equal(
    series("2027 Grand Prix 16UG D1", ["Niagara Falls Convention Centre"]),
    "grand-prix-bugarski-cup",
  );
  assert.equal(series("Autumn Invitational", ["Hamilton Sports Hall"]), null);
});

test("connector venue names resolve to OVA venue profiles", () => {
  assert.equal(venueProfile("Enercare Centre")?.id, "enercare-centre");
  assert.equal(
    venueProfile("Niagara Falls Convention Centre")?.id,
    "niagara-falls-convention-centre",
  );
  assert.equal(venueProfile("Downsview")?.id, "downsview");
  assert.equal(venueProfile("London - The Beach Hangar")?.id, "beach-hangar");
  assert.equal(venueProfile("Cohere Centre")?.id, "cohere-centre");
  assert.equal(venueProfile("David Suzuki SS"), null);
});

test("every OVA venue links to its source and every map has a text description", () => {
  for (const venue of OVA_VENUES) {
    assert.match(venue.source.url, /^https:\/\/www\.ontariovolleyball\.org\//);
    for (const map of venue.maps) assert.ok(map.description.length > 0, map.src);
  }
});

test("major events link to the next matching app event, never a club exhibition", () => {
  const cohere = OVA_VENUES.find((v) => v.id === "cohere-centre");
  const [fallClassic] = cohere.events;
  const strikers = {
    title: "17U Girls Strikers Fall Classic - Exhibition",
    venues: ["David Suzuki SS"],
    start_date: "2026-10-18",
    end_date: "2026-10-18",
  };
  assert.equal(appEventFor(fallClassic, [strikers], "2026-10-18"), undefined);

  const wbt = OVA_VENUES.find((v) => v.id === "downsview").events[0];
  const day = (d) => ({
    title: "WBT - Downsview- 18U",
    venues: ["Downsview"],
    start_date: d,
    end_date: d,
  });
  assert.equal(
    appEventFor(wbt, [day("2027-03-07"), day("2026-11-29")], "2026-10-18").start_date,
    "2026-11-29",
  );
});

test("upcoming major events drop finished ones and list each once", () => {
  const titles = upcomingMajorEvents("2026-10-18").map((x) => x.event.title);
  assert.equal(titles[0], "2026 Fall Classic");
  assert.ok(!titles.includes("2026 Ontario Championships"));
  assert.equal(titles.filter((t) => t.includes("Winter Beach Tour")).length, 1);
});
