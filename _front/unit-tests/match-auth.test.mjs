import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToReadableStream } from "react-dom/server";

const nativeRequire = createRequire(import.meta.url);
// Use the same CommonJS Clerk instance as the transpiled Next components.
const { ClerkProvider } = nativeRequire("@clerk/react");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

// Exercise the route's provider boundary with the real dispute component and
// Clerk's real useAuth hook. Replace only Next routing and network dependencies.
function load(relativePath, replacements) {
  const filename = path.join(testDirectory, "..", relativePath);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module: compiledModule,
      exports: compiledModule.exports,
      require: (id) => id in replacements ? replacements[id] : nativeRequire(id),
      process,
    },
    { filename },
  );
  return compiledModule.exports;
}

const { ScoreDispute } = load("components/score-dispute.tsx", {
  "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  "@/lib/api": { apiSend: () => { throw new Error("Unexpected API write"); } },
});

for (const configured of [true, false]) {
  for (const status of ["completed", "in_progress", "scheduled"]) {
    test(`${status} match renders with Clerk ${configured ? "enabled" : "disabled"}`, async () => {
      const previousKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      const key = "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k";
      if (configured) process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = key;
      else delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      try {
        const Page = load("app/events/[eventId]/matches/[matchId]/page.tsx", {
          // Next's server provider ultimately renders this React provider.
          "@clerk/nextjs": { ClerkProvider },
          "@/components/ui": { Loading: () => "Loading match" },
          "@/components/views/match": {
            MatchView: () => React.createElement(
              "main",
              null,
              status === "completed" ? "Final: 2–0" : status,
              status !== "scheduled" && React.createElement(ScoreDispute, { matchId: "m1" }),
            ),
          },
        }).default;
        const errors = [];
        const stream = await renderToReadableStream(
          React.createElement(Page, { params: Promise.resolve({ eventId: "e1", matchId: "m1" }) }),
          { onError: (error) => { errors.push(error.message); } },
        );
        await stream.allReady;
        const html = await new Response(stream).text();
        assert.deepEqual(errors, []);
        assert.match(html, status === "completed" ? /Final: 2–0/ : new RegExp(status));
        if (status !== "scheduled") {
          assert.match(html, /Flag a score dispute/);
          assert.match(html, /Sign in/);
        } else {
          assert.doesNotMatch(html, /Flag a score dispute/);
        }
      } finally {
        if (previousKey === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
        else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previousKey;
      }
    });
  }
}
