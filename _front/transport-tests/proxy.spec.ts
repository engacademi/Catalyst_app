import { createServer, type Server } from "node:http";
import { test, expect } from "@playwright/test";

let backend: Server;

test.beforeAll(async () => {
  // Deliberately no CORS headers: the browser must use the app's origin.
  backend = createServer(async (req, res) => {
    if (req.url === "/v1/events") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [] }));
      return;
    }
    if (req.url === "/v1/admin/me" && !req.headers.authorization) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "Sign in required" }));
      return;
    }
    if (req.url?.startsWith("/v1/events/demo/calendar.ics")) {
      res.writeHead(200, {
        "Content-Type": "text/calendar",
        "Content-Disposition": 'attachment; filename="demo.ics"',
      });
      res.end("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      path: req.url,
      method: req.method,
      authorization: req.headers.authorization,
      contentType: req.headers["content-type"],
      body: Buffer.concat(chunks).toString(),
    }));
  });
  await new Promise<void>((resolve) => backend.listen(8009, "127.0.0.1", resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => backend.close((error) => error ? reject(error) : resolve()));
});

test("browser reads public and authenticated endpoints without CORS", async ({ page }) => {
  await page.goto("/");
  const results = await page.evaluate(async () => {
    const publicResult = await fetch("/api/backend/v1/events?limit=12");
    const staffResult = await fetch("/api/backend/v1/admin/me", {
      headers: { Authorization: "Bearer transport-test-token" },
    });
    const denied = await fetch("/api/backend/v1/admin/me");
    return { public: await publicResult.json(), staff: await staffResult.json(), denied: denied.status };
  });
  expect(results.public.path).toBe("/v1/events?limit=12");
  expect(results.staff.authorization).toBe("Bearer transport-test-token");
  expect(results.denied).toBe(401);
});

test("CSV uploads and calendar downloads preserve their contents", async ({ request }) => {
  const upload = await request.post("/api/backend/v1/admin/imports", {
    headers: { Authorization: "Bearer transport-test-token" },
    multipart: { file: { name: "teams.csv", mimeType: "text/csv", buffer: Buffer.from("team_name\nDemo Team\n") } },
  });
  const result = await upload.json();
  expect(result.method).toBe("POST");
  expect(result.authorization).toBe("Bearer transport-test-token");
  expect(result.contentType).toContain("multipart/form-data; boundary=");
  expect(result.body).toContain("team_name\nDemo Team\n");
  const calendar = await request.get("/api/backend/v1/events/demo/calendar.ics?entry_ids=team-1");
  expect(calendar.headers()["content-disposition"]).toContain("demo.ics");
  expect(await calendar.text()).toContain("BEGIN:VCALENDAR");
});
