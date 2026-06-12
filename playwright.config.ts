import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PUBLIC_APP_URL ?? "https://nyumba-search.kevinbuluma1.workers.dev";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
