import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "http://127.0.0.1:3000",
    ...devices["iPhone 13"],
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
});
