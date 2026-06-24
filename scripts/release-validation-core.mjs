import fs from "node:fs";
import path from "node:path";

export const DEFAULT_BACKEND_URL = "https://discip-yourself-backend.onrender.com";
export const CAPACITOR_IOS_ORIGIN = "capacitor://localhost";
export const SUPPORTED_AUTH_SMOKE_ROUTES = Object.freeze([
  "coach",
  "session-guidance",
  "day-analysis",
  "system-analysis",
]);

const TEXT_BUNDLE_EXTENSIONS = new Set([".html", ".js", ".css", ".json", ".map", ".txt"]);
const SECRET_PREFIX_PATTERNS = [
  { type: "openai-key", pattern: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}\b/g },
  { type: "supabase-secret", pattern: /\bsb_secret_[A-Za-z0-9._-]{20,}\b/g },
  { type: "apple-private-key", pattern: new RegExp("-----BEGIN (?:EC |RSA )?" + "PRIVATE KEY-----", "g") },
  { type: "apple-p8", pattern: new RegExp("-----BEGIN " + "PRIVATE KEY-----", "g") },
  { type: "jwt-token", pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g },
];

export function parseDotenv(source = "") {
  const result = {};
  String(source || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) return;
      const [, rawName, rawValue] = match;
      const name = rawName.trim();
      let value = String(rawValue || "").trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[name] = value;
    });
  return result;
}

export function readEnvFile(filePath) {
  if (!filePath) return {};
  const absPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) return {};
  return parseDotenv(fs.readFileSync(absPath, "utf8"));
}

export function parseList(raw) {
  return String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseBooleanFlag(raw) {
  if (typeof raw === "boolean") return raw;
  const value = String(raw || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function isPrivateIpv4Hostname(hostname) {
  const parts = String(hostname || "").trim().split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

export function isLoopbackHostname(hostname) {
  const value = String(hostname || "").trim().toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1" || value === "[::1]";
}

export function isLocalOrPrivateUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return isLoopbackHostname(url.hostname) || isPrivateIpv4Hostname(url.hostname);
  } catch {
    return false;
  }
}

export function isHttpsUrl(rawUrl) {
  try {
    return new URL(rawUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export function isProductionEnv(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "prod" || normalized === "production";
}

export function isPlaceholderValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return true;
  const lower = normalized.toLowerCase();
  return (
    lower.includes("<") ||
    lower.includes(">") ||
    lower.startsWith("your-") ||
    lower.startsWith("example") ||
    lower.includes("example-") ||
    lower.includes("placeholder") ||
    lower.includes("replace") ||
    lower.includes("changeme") ||
    lower.includes("server-only")
  );
}

function publicEnvValue(env, primaryName, legacyName = null) {
  const primary = String(env?.[primaryName] || "").trim();
  if (primary) return { name: primaryName, value: primary };
  if (legacyName) {
    const legacy = String(env?.[legacyName] || "").trim();
    if (legacy) return { name: legacyName, value: legacy };
  }
  return { name: primaryName, value: "" };
}

function result(status, name, reason) {
  return { status, name, reason };
}

function pass(name, reason = "shape accepted") {
  return result("PASS", name, reason);
}

function fail(name, reason) {
  return result("FAIL", name, reason);
}

export function validateProductionEnvironment({
  frontendEnv = {},
  backendEnv = {},
  productionWebOrigin = "",
} = {}) {
  const results = [];
  const frontend = frontendEnv || {};
  const backend = backendEnv || {};
  const webOrigin = String(productionWebOrigin || frontend.PRODUCTION_WEB_ORIGIN || backend.PRODUCTION_WEB_ORIGIN || "").trim();
  const supabasePublicKey = publicEnvValue(
    frontend,
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY"
  );

  results.push(
    isProductionEnv(frontend.VITE_APP_ENV)
      ? pass("VITE_APP_ENV", "production value accepted")
      : fail("VITE_APP_ENV", "must be prod or production")
  );

  const backendUrl = String(frontend.VITE_AI_BACKEND_URL || "").trim();
  results.push(
    backendUrl
      ? pass("VITE_AI_BACKEND_URL", "present")
      : fail("VITE_AI_BACKEND_URL", "required for production")
  );
  if (backendUrl) {
    results.push(
      isHttpsUrl(backendUrl)
        ? pass("VITE_AI_BACKEND_URL", "https URL")
        : fail("VITE_AI_BACKEND_URL", "must be an https URL")
    );
    results.push(
      !isLocalOrPrivateUrl(backendUrl)
        ? pass("VITE_AI_BACKEND_URL", "not local/private")
        : fail("VITE_AI_BACKEND_URL", "must not target localhost or private LAN")
    );
  }

  const frontendSupabaseUrl = String(frontend.VITE_SUPABASE_URL || "").trim();
  results.push(
    frontendSupabaseUrl ? pass("VITE_SUPABASE_URL", "present") : fail("VITE_SUPABASE_URL", "required")
  );
  if (frontendSupabaseUrl) {
    results.push(
      isHttpsUrl(frontendSupabaseUrl)
        ? pass("VITE_SUPABASE_URL", "https URL")
        : fail("VITE_SUPABASE_URL", "must be an https URL")
    );
  }

  results.push(
    supabasePublicKey.value && !isPlaceholderValue(supabasePublicKey.value)
      ? pass(supabasePublicKey.name, "public key present")
      : fail("VITE_SUPABASE_PUBLISHABLE_KEY", "required public key missing or placeholder")
  );

  const devProxyEnabled = parseBooleanFlag(frontend.VITE_USE_DEV_API_PROXY);
  results.push(
    !devProxyEnabled
      ? pass("VITE_USE_DEV_API_PROXY", "not active")
      : fail("VITE_USE_DEV_API_PROXY", "must be false or unset for production")
  );

  results.push(
    isProductionEnv(backend.APP_ENV)
      ? pass("APP_ENV", "production value accepted")
      : fail("APP_ENV", "must be prod or production")
  );

  const backendSupabaseUrl = String(backend.SUPABASE_URL || "").trim();
  results.push(backendSupabaseUrl ? pass("SUPABASE_URL", "present") : fail("SUPABASE_URL", "required"));
  if (backendSupabaseUrl) {
    results.push(
      isHttpsUrl(backendSupabaseUrl)
        ? pass("SUPABASE_URL", "https URL")
        : fail("SUPABASE_URL", "must be an https URL")
    );
  }

  ["SUPABASE_SECRET_KEY", "OPENAI_API_KEY"].forEach((name) => {
    const value = String(backend[name] || "").trim();
    results.push(
      value && !isPlaceholderValue(value)
        ? pass(name, "secret present")
        : fail(name, "required secret missing or placeholder")
    );
  });

  const corsOrigins = parseList(backend.CORS_ALLOWED_ORIGINS);
  results.push(
    corsOrigins.length ? pass("CORS_ALLOWED_ORIGINS", "present") : fail("CORS_ALLOWED_ORIGINS", "required")
  );
  if (webOrigin) {
    results.push(
      corsOrigins.includes(webOrigin)
        ? pass("CORS_ALLOWED_ORIGINS", "production web origin allowed")
        : fail("CORS_ALLOWED_ORIGINS", "configured production web origin missing")
    );
  } else {
    results.push(fail("PRODUCTION_WEB_ORIGIN", "required to validate CORS pairing"));
  }
  results.push(
    corsOrigins.includes(CAPACITOR_IOS_ORIGIN)
      ? pass("CORS_ALLOWED_ORIGINS", "capacitor iOS origin allowed")
      : fail("CORS_ALLOWED_ORIGINS", "capacitor://localhost missing")
  );

  const unsafeCorsOrigin = corsOrigins.find((origin) => {
    if (origin === CAPACITOR_IOS_ORIGIN) return false;
    return isLocalOrPrivateUrl(origin);
  });
  results.push(
    unsafeCorsOrigin
      ? fail("CORS_ALLOWED_ORIGINS", "must not include localhost or private LAN in production")
      : pass("CORS_ALLOWED_ORIGINS", "no localhost/private LAN origin")
  );

  results.push(
    !parseBooleanFlag(backend.CORS_ALLOW_PRIVATE_NETWORK_DEV)
      ? pass("CORS_ALLOW_PRIVATE_NETWORK_DEV", "false")
      : fail("CORS_ALLOW_PRIVATE_NETWORK_DEV", "must be false in production")
  );

  results.push(
    String(backend.AI_QUOTA_MODE || "").trim() === "normal"
      ? pass("AI_QUOTA_MODE", "normal")
      : fail("AI_QUOTA_MODE", "must be normal")
  );

  return results;
}

export function hasFailures(results = []) {
  return results.some((entry) => entry.status === "FAIL");
}

export function formatValidationResults(results = []) {
  return results.map((entry) => `${entry.status} ${entry.name} - ${entry.reason}`).join("\n");
}

function safeKeyNameFromLine(line) {
  const envMatch = String(line || "").match(/\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PRIVATE|PASSWORD)[A-Z0-9_]*)\b/);
  if (envMatch) return envMatch[1];
  return "inline-secret";
}

export function findSecretTokensInLine(line = "") {
  const findings = [];
  for (const { type, pattern } of SECRET_PREFIX_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(String(line || ""));
    while (match) {
      findings.push({
        type,
        name: safeKeyNameFromLine(line),
      });
      match = pattern.exec(String(line || ""));
    }
  }
  return findings;
}

export function formatSecretViolation(violation = {}) {
  const file = violation.file || "unknown";
  const line = Number.isInteger(violation.line) ? violation.line : "?";
  const name = violation.name || "unknown";
  const kind = violation.kind || violation.type || "secret-match";
  return `- ${kind}: ${file}:${line} -> ${name} [redacted]`;
}

function walkFiles(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "." || entry.name === "..") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(abs, output);
      continue;
    }
    output.push(abs);
  }
  return output;
}

function addFinding(findings, severity, file, pattern, reason) {
  findings.push({ severity, file, pattern, reason });
}

export function scanProductionBundle({ root = process.cwd(), distDir = "dist" } = {}) {
  const bundleRoot = path.resolve(root, distDir);
  const findings = [];
  const files = walkFiles(bundleRoot).filter((file) => TEXT_BUNDLE_EXTENSIONS.has(path.extname(file)));

  if (!fs.existsSync(bundleRoot)) {
    return {
      ok: false,
      findings: [{ severity: "FAIL", file: distDir, pattern: "dist", reason: "bundle directory missing" }],
    };
  }

  for (const file of files) {
    const rel = path.relative(root, file);
    const source = fs.readFileSync(file, "utf8");
    if (/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])/i.test(source)) {
      addFinding(findings, "NOTICE", rel, "localhost-url", "localhost string present; verify it is not an active env target");
    }
    if (/https?:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})/i.test(source)) {
      addFinding(findings, "NOTICE", rel, "private-lan-url", "private LAN string present; verify it is not an active env target");
    }
    if (/\bVITE_APP_ENV\s*:\s*["'](?!prod["']|production["'])[^"']+["']/.test(source)) {
      addFinding(findings, "FAIL", rel, "vite-app-env", "production bundle must embed VITE_APP_ENV=prod");
    }
    if (/\bVITE_AI_BACKEND_URL\s*:\s*["']https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(source)) {
      addFinding(findings, "FAIL", rel, "vite-ai-backend-url", "production backend env points to local/private URL");
    }
    if (/\bVITE_USE_DEV_API_PROXY\s*:\s*["'](?:1|true|yes|on)["']/i.test(source)) {
      addFinding(findings, "FAIL", rel, "vite-dev-proxy-enabled", "production bundle embeds active dev proxy flag");
    }
    if (/\bcom\.company\.discipyourself\b/.test(source)) {
      addFinding(findings, "FAIL", rel, "placeholder-bundle-id", "placeholder bundle id found");
    }
    if (/\b(?:sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9._-]{20,})\b/.test(source)) {
      addFinding(findings, "FAIL", rel, "secret-prefix", "secret-looking token found");
    }
    if (/(?:fetch|XMLHttpRequest|axios|buildApiUrl)\s*\([^)]*["']\/api\//.test(source)) {
      addFinding(findings, "FAIL", rel, "vite-api-proxy-call", "runtime dev proxy API call found");
    }
    if (/\bVITE_USE_DEV_API_PROXY\b/.test(source)) {
      addFinding(findings, "NOTICE", rel, "vite-dev-proxy-string", "source string present; expected to be runtime-gated");
    }
    if (/\bE2E_AUTH_SESSION|e2e-user|test-user|mock-api\b/i.test(source)) {
      addFinding(findings, "NOTICE", rel, "test-string", "test string present; verify runtime gate if changed");
    }
    if (/reset local data|reinitialiser les donnees locales|reinitialiser les données locales/i.test(source)) {
      addFinding(findings, "NOTICE", rel, "dev-reset-string", "dev reset string present; expected to be hidden in production");
    }
  }

  return {
    ok: !findings.some((finding) => finding.severity === "FAIL"),
    findings,
  };
}

export function formatBundleFindings({ ok, findings = [] } = {}) {
  if (!findings.length) return "PASS production-bundle - no findings";
  const lines = findings.map(
    (finding) => `${finding.severity} ${finding.pattern} ${finding.file} - ${finding.reason}`
  );
  return `${ok ? "PASS" : "FAIL"} production-bundle - ${ok ? "no blocking findings" : "blocking findings"}\n${lines.join("\n")}`;
}

export function validateHealthPayload(payload = {}) {
  const results = [];
  results.push(payload?.ok === true ? pass("health.ok", "true") : fail("health.ok", "expected true"));
  results.push(payload?.service === "ai-backend" ? pass("health.service", "expected service") : fail("health.service", "expected ai-backend"));
  results.push(
    isProductionEnv(payload?.appEnv)
      ? pass("health.appEnv", "production value accepted")
      : fail("health.appEnv", "expected prod or production")
  );
  return results;
}

export function safeErrorCodeFromBody(body = {}) {
  if (!body || typeof body !== "object") return null;
  return String(body.error || body.code || body.errorCode || body.backendErrorCode || "").trim() || null;
}

export function buildMinimalSmokePayload(route, dateKey = "2026-06-24") {
  if (route === "coach") {
    return {
      path: "/ai/chat",
      body: {
        selectedDateKey: dateKey,
        activeCategoryId: null,
        message: "Smoke test: reponds tres brievement.",
        recentMessages: [],
        mode: "free",
        locale: "fr-FR",
        useCase: "general",
      },
    };
  }
  if (route === "session-guidance") {
    return {
      path: "/ai/session-guidance",
      body: {
        mode: "prepare",
        dateKey,
        occurrenceId: "release-smoke-occurrence",
        actionId: "release-smoke-action",
        categoryId: null,
        actionTitle: "Bloc smoke test",
        categoryName: "Systeme",
        protocolType: "generic",
        targetDurationMinutes: 10,
        blueprintSnapshot: {},
        fallbackRunbook: {
          version: 1,
          title: "Bloc smoke test",
          steps: [
            {
              id: "step-1",
              title: "Demarrer",
              description: "Action minimale de validation.",
              durationSec: 600,
              items: [],
            },
          ],
        },
        runtimeContext: {},
      },
    };
  }
  if (route === "day-analysis") {
    const snapshotHash = "release-smoke-day-analysis";
    return {
      path: "/ai/day-analysis",
      body: {
        snapshotHash,
        clientRequestId: "release-smoke",
        snapshot: {
          version: 1,
          dayKey: dateKey,
          nowIso: `${dateKey}T10:00:00.000Z`,
          timezone: "Europe/Paris",
          activeCategoryId: null,
          primaryGoal: null,
          whyText: "",
          firstRun: null,
          primaryAction: null,
          occurrences: [],
          sessionHistory: [],
          activeSession: null,
          systemSignals: [],
          deterministicActions: [
            {
              id: "release-smoke-action",
              type: "no_change",
              label: "Verifier",
              description: "Validation release.",
              targetType: "day",
              targetId: "release-smoke",
              supportStatus: "no_change",
              deterministicAction: null,
              confirmationRequired: false,
              preview: {},
            },
          ],
          dataLimitations: ["release-smoke-thin-data"],
        },
      },
    };
  }
  if (route === "system-analysis") {
    const snapshotHash = "release-smoke-system-analysis";
    return {
      path: "/ai/system-analysis",
      body: {
        version: 1,
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: dateKey,
        requestId: "release-smoke",
        allowThinDataForTest: true,
        snapshot: {
          version: 1,
          period: { startDateKey: dateKey, endDateKey: dateKey, days: 1 },
          generatedAt: `${dateKey}T10:00:00.000Z`,
          referenceDateKey: dateKey,
          userWhy: "",
          firstRunSummary: {},
          goalsSummary: {},
          actionsSummary: {},
          executionStats: {},
          sessionStats: {},
          timePatterns: {},
          frictionPatterns: {},
          objectiveSignals: {},
          planningLoadSignals: {},
          systemSignals: [],
          adjustDiagnosticSummary: {},
          coachThemes: {},
          profilePreferences: {},
          dataLimitations: [{ reason: "release-smoke-thin-data" }],
          sourceCounts: {},
          snapshotHash,
        },
      },
    };
  }
  return null;
}

export function resolveAuthenticatedSmokeRoutes({ authToken = "", requestedRoutes = "" } = {}) {
  const tokenPresent = Boolean(String(authToken || "").trim());
  const requested =
    Array.isArray(requestedRoutes) ? requestedRoutes
    : parseList(String(requestedRoutes || "").replace(/\s+/g, ","));
  const normalized = requested
    .map((route) => String(route || "").trim().toLowerCase())
    .filter(Boolean);

  if (!tokenPresent) {
    return {
      skipped: true,
      reason: "auth token missing",
      routes: [],
      invalidRoutes: [],
    };
  }
  if (!normalized.length) {
    return {
      skipped: true,
      reason: "no authenticated routes enabled",
      routes: [],
      invalidRoutes: [],
    };
  }

  const invalidRoutes = normalized.filter((route) => !SUPPORTED_AUTH_SMOKE_ROUTES.includes(route));
  const routes = Array.from(
    new Set(normalized.filter((route) => SUPPORTED_AUTH_SMOKE_ROUTES.includes(route)))
  );
  return {
    skipped: false,
    reason: "",
    routes,
    invalidRoutes,
  };
}
