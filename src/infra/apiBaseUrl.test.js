import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  API_PROXY_PREFIX,
  buildApiUrl,
  getApiBaseUrl,
  isDevApiProxyEnabled,
  normalizeApiBaseUrl,
} from "./apiBaseUrl";

const SRC_DIR = dirname(fileURLToPath(import.meta.url)).replace(/\/infra$/, "");

function listRuntimeSourceFiles(dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) return listRuntimeSourceFiles(fullPath);
      if (!/\.(js|jsx|ts|tsx)$/.test(entry)) return [];
      if (/\.(test|spec)\./.test(entry)) return [];
      return [fullPath];
    });
}

describe("apiBaseUrl", () => {
  it("resolves the backend base to /api in Vite development by default", () => {
    expect(isDevApiProxyEnabled({ DEV: true })).toBe(true);
    expect(getApiBaseUrl(undefined, { env: { DEV: true }, inferLocal: false })).toBe(API_PROXY_PREFIX);
  });

  it("allows disabling the dev proxy to preserve explicit local backend overrides", () => {
    expect(
      getApiBaseUrl(undefined, {
        env: {
          DEV: true,
          VITE_USE_DEV_API_PROXY: "false",
          VITE_AI_BACKEND_URL: "http://127.0.0.1:3001/",
        },
        inferLocal: false,
      }),
    ).toBe("http://127.0.0.1:3001");
  });

  it("preserves the configured production backend URL", () => {
    expect(
      getApiBaseUrl(undefined, {
        env: {
          DEV: false,
          PROD: true,
          VITE_AI_BACKEND_URL: "https://discip-yourself-backend.onrender.com/",
        },
        inferLocal: false,
      }),
    ).toBe("https://discip-yourself-backend.onrender.com");
  });

  it("fails safely when production has no backend URL", () => {
    expect(getApiBaseUrl(undefined, { env: { DEV: false, PROD: true }, inferLocal: false })).toBe("");
  });

  it("normalizes base URLs and joins endpoints without double slashes", () => {
    expect(normalizeApiBaseUrl("/api/")).toBe("/api");
    expect(normalizeApiBaseUrl("https://api.example.test///")).toBe("https://api.example.test");
    expect(buildApiUrl("/ai/session-guidance", "/api/")).toBe("/api/ai/session-guidance");
    expect(buildApiUrl("ai/day-analysis", "https://api.example.test/")).toBe(
      "https://api.example.test/ai/day-analysis",
    );
  });

  it("does not leave hard-coded Render backend URLs in runtime frontend source", () => {
    const offenders = listRuntimeSourceFiles(SRC_DIR).filter((filePath) =>
      readFileSync(filePath, "utf8").includes("discip-yourself-backend.onrender.com")
    );

    expect(offenders).toEqual([]);
  });
});
