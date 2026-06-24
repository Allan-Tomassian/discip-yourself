import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CAPACITOR_IOS_ORIGIN,
  findSecretTokensInLine,
  formatSecretViolation,
  hasFailures,
  isPrivateIpv4Hostname,
  resolveAuthenticatedSmokeRoutes,
  scanProductionBundle,
  validateHealthPayload,
  validateProductionEnvironment,
} from "../../scripts/release-validation-core.mjs";

const PRODUCTION_ORIGIN = "https://app.discipyourself.com";

function validFrontendEnv() {
  return {
    VITE_APP_ENV: "prod",
    VITE_AI_BACKEND_URL: "https://discip-yourself-backend.onrender.com",
    VITE_SUPABASE_URL: "https://project.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_releasecheck_abcdefghijklmnopqrstuvwxyz1234567890",
  };
}

function validBackendEnv() {
  return {
    APP_ENV: "prod",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "releasecheck-secret-redacted-1234567890",
    OPENAI_API_KEY: "releasecheck-openai-redacted-1234567890",
    CORS_ALLOWED_ORIGINS: `${PRODUCTION_ORIGIN},${CAPACITOR_IOS_ORIGIN}`,
    CORS_ALLOW_PRIVATE_NETWORK_DEV: "false",
    AI_QUOTA_MODE: "normal",
  };
}

describe("production release validation", () => {
  it("accepts the canonical production frontend/backend pairing", () => {
    const results = validateProductionEnvironment({
      frontendEnv: validFrontendEnv(),
      backendEnv: validBackendEnv(),
      productionWebOrigin: PRODUCTION_ORIGIN,
    });

    expect(hasFailures(results)).toBe(false);
  });

  it("rejects dev proxy, staging backend env, unsafe CORS, and private backend URLs", () => {
    const results = validateProductionEnvironment({
      frontendEnv: {
        ...validFrontendEnv(),
        VITE_AI_BACKEND_URL: "http://192.168.1.12:3001",
        VITE_USE_DEV_API_PROXY: "true",
      },
      backendEnv: {
        ...validBackendEnv(),
        APP_ENV: "staging",
        CORS_ALLOWED_ORIGINS: `${PRODUCTION_ORIGIN},http://localhost:5173`,
        CORS_ALLOW_PRIVATE_NETWORK_DEV: "true",
        AI_QUOTA_MODE: "dev_relaxed",
      },
      productionWebOrigin: PRODUCTION_ORIGIN,
    });

    expect(results.filter((entry) => entry.status === "FAIL").map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        "VITE_AI_BACKEND_URL",
        "VITE_USE_DEV_API_PROXY",
        "APP_ENV",
        "CORS_ALLOWED_ORIGINS",
        "CORS_ALLOW_PRIVATE_NETWORK_DEV",
        "AI_QUOTA_MODE",
      ])
    );
  });

  it("detects private IPv4 hostnames", () => {
    expect(isPrivateIpv4Hostname("10.0.0.12")).toBe(true);
    expect(isPrivateIpv4Hostname("172.16.0.12")).toBe(true);
    expect(isPrivateIpv4Hostname("172.31.255.1")).toBe(true);
    expect(isPrivateIpv4Hostname("192.168.1.10")).toBe(true);
    expect(isPrivateIpv4Hostname("172.32.0.1")).toBe(false);
    expect(isPrivateIpv4Hostname("8.8.8.8")).toBe(false);
  });

  it("validates production health payloads without accepting staging", () => {
    expect(
      hasFailures(validateHealthPayload({ ok: true, service: "ai-backend", appEnv: "prod" }))
    ).toBe(false);
    expect(
      validateHealthPayload({ ok: true, service: "ai-backend", appEnv: "staging" }).some(
        (entry) => entry.status === "FAIL" && entry.name === "health.appEnv"
      )
    ).toBe(true);
  });

  it("redacts secret scanner findings", () => {
    const secret = `sk-proj-${"a".repeat(36)}`;
    const [finding] = findSecretTokensInLine(`OPENAI_API_KEY=${secret}`);
    const formatted = formatSecretViolation({
      kind: finding.type,
      name: finding.name,
      file: ".env.local",
      line: 1,
    });

    expect(formatted).toContain("OPENAI_API_KEY");
    expect(formatted).toContain("[redacted]");
    expect(formatted).not.toContain(secret);
  });

  it("does not fail a production bundle for harmless gated source strings", () => {
    const root = mkdtempSync(path.join(tmpdir(), "discip-release-"));
    try {
      mkdirSync(path.join(root, "dist", "assets"), { recursive: true });
      writeFileSync(path.join(root, "dist", "assets", "app.js"), 'const gate = "VITE_USE_DEV_API_PROXY";');

      const result = scanProductionBundle({ root, distDir: "dist" });

      expect(result.ok).toBe(true);
      expect(result.findings.some((finding) => finding.severity === "NOTICE")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails a production bundle that contains local env targets or secret-like tokens", () => {
    const root = mkdtempSync(path.join(tmpdir(), "discip-release-"));
    try {
      mkdirSync(path.join(root, "dist"), { recursive: true });
      writeFileSync(
        path.join(root, "dist", "index.js"),
        `const env = { VITE_APP_ENV: "local", VITE_AI_BACKEND_URL: "http://localhost:3001" }; const token = "sk-proj-${"b".repeat(36)}";`
      );

      const result = scanProductionBundle({ root, distDir: "dist" });

      expect(result.ok).toBe(false);
      expect(result.findings.map((finding) => finding.pattern)).toEqual(
        expect.arrayContaining(["vite-app-env", "vite-ai-backend-url", "secret-prefix"])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips authenticated smoke routes safely unless explicitly enabled with a token", () => {
    expect(resolveAuthenticatedSmokeRoutes({ authToken: "", requestedRoutes: "coach" })).toMatchObject({
      skipped: true,
      routes: [],
    });

    const selection = resolveAuthenticatedSmokeRoutes({
      authToken: "redacted-token",
      requestedRoutes: "coach,unknown,session-guidance",
    });

    expect(selection.skipped).toBe(false);
    expect(selection.routes).toEqual(["coach", "session-guidance"]);
    expect(selection.invalidRoutes).toEqual(["unknown"]);
  });
});
