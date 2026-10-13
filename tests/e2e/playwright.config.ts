import { defineConfig, devices } from "@playwright/test";

// Runs the real app (web build) in a phone-sized browser against the Firestore emulator
// and the real Gemini model.
export default defineConfig({
  testDir: ".",
  timeout: 300_000,
  expect: { timeout: 15_000 },
  retries: 1,
  reporter: [["list"]],
  outputDir: "./results",
  use: {
    ...devices["Pixel 7"],
    baseURL: "http://127.0.0.1:4173",
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1 --directory ../../dist-e2e",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
