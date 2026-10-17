import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./transport-tests",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3002",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3002",
    env: { API_BASE_URL: "http://127.0.0.1:8009" },
    url: "http://127.0.0.1:3002",
    reuseExistingServer: false,
  },
});
