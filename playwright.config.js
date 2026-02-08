import { defineConfig, devices, webkit } from "@playwright/test";
import { existsSync } from "node:fs";

const PORT = process.env.E2E_PORT || "5173";
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
const webkitExecutablePath = (() => {
  try {
    return webkit.executablePath();
  } catch {
    return "";
  }
})();
const hasWebkitInstalled = Boolean(webkitExecutablePath && existsSync(webkitExecutablePath));
const projects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
];
if (hasWebkitInstalled) {
  projects.push({
    name: "webkit-iphone",
    use: { ...devices["iPhone 13"] },
  });
}

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects,
});
