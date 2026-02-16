import { test, expect } from "@playwright/test";
import { clearAuthSession } from "./utils/seed.js";

async function mockDiagnosticFetch(page, scenario) {
  await page.addInitScript(({ mode }) => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input?.url || "";
      const isDiagnosticTarget = url.includes("/auth/v1/health") || url.includes("/rest/v1/");

      if (isDiagnosticTarget) {
        if (mode === "network_fail") {
          throw new TypeError("Failed to fetch");
        }
        if (mode === "http_404") {
          return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
        }
        if (mode === "http_200") {
          return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
        }
      }

      return originalFetch(input, init);
    };
  }, { mode: scenario });
}

test("diagnostic réseau: network fail", async ({ page }) => {
  await clearAuthSession(page);
  await mockDiagnosticFetch(page, "network_fail");

  await page.goto("/");
  await page.getByTestId("auth-diagnostics-button").click();

  await expect(page.getByTestId("auth-diag-health")).toContainText("DNS/Network fail");
  await expect(page.getByTestId("auth-diag-rest")).toContainText("DNS/Network fail");
});

test("diagnostic réseau: 404", async ({ page }) => {
  await clearAuthSession(page);
  await mockDiagnosticFetch(page, "http_404");

  await page.goto("/");
  await page.getByTestId("auth-diagnostics-button").click();

  await expect(page.getByTestId("auth-diag-health")).toContainText("HTTP 404");
  await expect(page.getByTestId("auth-diag-rest")).toContainText("HTTP 404");
});

test("diagnostic réseau: 200", async ({ page }) => {
  await clearAuthSession(page);
  await mockDiagnosticFetch(page, "http_200");

  await page.goto("/");
  await page.getByTestId("auth-diagnostics-button").click();

  await expect(page.getByTestId("auth-diag-health")).toContainText("HTTP 200");
  await expect(page.getByTestId("auth-diag-rest")).toContainText("HTTP 200");
});
