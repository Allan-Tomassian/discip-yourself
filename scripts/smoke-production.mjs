#!/usr/bin/env node
import {
  CAPACITOR_IOS_ORIGIN,
  DEFAULT_BACKEND_URL,
  buildMinimalSmokePayload,
  formatValidationResults,
  hasFailures,
  resolveAuthenticatedSmokeRoutes,
  safeErrorCodeFromBody,
  validateHealthPayload,
} from "./release-validation-core.mjs";

const DEFAULT_TIMEOUT_MS = 20000;
const REJECTED_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://192.168.1.10:5173",
  "https://malicious.example",
];

function parseArgs(argv) {
  const args = {
    backendUrl: "",
    origin: "",
    routes: "",
    dateKey: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--backend-url") {
      args.backendUrl = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg === "--origin") {
      args.origin = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg === "--routes") {
      args.routes = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg === "--date-key") {
      args.dateKey = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      args.timeoutMs = Number.parseInt(argv[index + 1] || "", 10) || DEFAULT_TIMEOUT_MS;
      index += 1;
    }
  }
  return args;
}

function normalizeBackendUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return {
      ok: true,
      response,
      body,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      response: null,
      body: null,
      elapsedMs: Date.now() - startedAt,
      errorCode: error?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runHealthCheck({ backendUrl, timeoutMs }) {
  const result = await fetchWithTimeout(`${backendUrl}/health`, { method: "GET" }, timeoutMs);
  if (!result.ok) {
    return [`FAIL health - ${result.errorCode} elapsedMs=${result.elapsedMs}`];
  }
  const statusLine =
    result.response.status === 200
      ? `PASS health.status - status=200 elapsedMs=${result.elapsedMs}`
      : `FAIL health.status - status=${result.response.status} elapsedMs=${result.elapsedMs}`;
  const payloadResults = validateHealthPayload(result.body);
  return [statusLine, formatValidationResults(payloadResults)].filter(Boolean);
}

async function runCorsCase({ backendUrl, origin, shouldAllow, timeoutMs }) {
  const result = await fetchWithTimeout(
    `${backendUrl}/health`,
    {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
      },
    },
    timeoutMs
  );
  if (!result.ok) {
    return `FAIL cors ${origin} - ${result.errorCode} elapsedMs=${result.elapsedMs}`;
  }
  const allowedOrigin = result.response.headers.get("access-control-allow-origin") || "";
  const actual = allowedOrigin === origin ? "allowed" : "rejected";
  const expected = shouldAllow ? "allowed" : "rejected";
  const passed = shouldAllow ? allowedOrigin === origin : allowedOrigin !== origin;
  return `${passed ? "PASS" : "FAIL"} cors ${origin} - expected=${expected} actual=${actual} status=${result.response.status}`;
}

async function runCorsChecks({ backendUrl, productionOrigin, timeoutMs }) {
  const lines = [];
  if (!productionOrigin) {
    lines.push("FAIL cors.PRODUCTION_WEB_ORIGIN - required");
  } else {
    lines.push(await runCorsCase({ backendUrl, origin: productionOrigin, shouldAllow: true, timeoutMs }));
  }
  lines.push(await runCorsCase({ backendUrl, origin: CAPACITOR_IOS_ORIGIN, shouldAllow: true, timeoutMs }));
  for (const origin of REJECTED_CORS_ORIGINS) {
    lines.push(await runCorsCase({ backendUrl, origin, shouldAllow: false, timeoutMs }));
  }
  return lines;
}

async function runAuthenticatedRoute({ backendUrl, token, route, dateKey, timeoutMs }) {
  const fixture = buildMinimalSmokePayload(route, dateKey);
  if (!fixture) return `FAIL auth.${route} - unsupported route`;
  const result = await fetchWithTimeout(
    `${backendUrl}${fixture.path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Discip-Surface": "release-smoke",
      },
      body: JSON.stringify(fixture.body),
    },
    timeoutMs
  );
  if (!result.ok) {
    return `FAIL auth.${route} - ${result.errorCode} elapsedMs=${result.elapsedMs}`;
  }
  const errorCode = safeErrorCodeFromBody(result.body);
  const passed = result.response.status >= 200 && result.response.status < 300;
  return `${passed ? "PASS" : "FAIL"} auth.${route} - status=${result.response.status} elapsedMs=${result.elapsedMs}${errorCode ? ` error=${errorCode}` : ""}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backendUrl = normalizeBackendUrl(
    args.backendUrl ||
      process.env.PRODUCTION_BACKEND_URL ||
      process.env.VITE_AI_BACKEND_URL ||
      DEFAULT_BACKEND_URL
  );
  const productionOrigin = String(args.origin || process.env.PRODUCTION_WEB_ORIGIN || "").trim();
  const routeSelection = resolveAuthenticatedSmokeRoutes({
    authToken: process.env.PRODUCTION_SMOKE_AUTH_TOKEN,
    requestedRoutes: args.routes || process.env.PRODUCTION_SMOKE_AI_ROUTES,
  });
  const dateKey = args.dateKey || process.env.PRODUCTION_SMOKE_DATE_KEY || todayKey();
  const timeoutMs = Math.max(1000, args.timeoutMs);

  const lines = [];
  lines.push(...(await runHealthCheck({ backendUrl, timeoutMs })));
  lines.push(...(await runCorsChecks({ backendUrl, productionOrigin, timeoutMs })));

  if (routeSelection.invalidRoutes.length) {
    lines.push(`FAIL auth.routes - unsupported routes requested: ${routeSelection.invalidRoutes.join(",")}`);
  }
  if (routeSelection.skipped) {
    lines.push(`PASS auth-smoke - skipped (${routeSelection.reason})`);
  } else {
    for (const route of routeSelection.routes) {
      lines.push(
        await runAuthenticatedRoute({
          backendUrl,
          token: process.env.PRODUCTION_SMOKE_AUTH_TOKEN,
          route,
          dateKey,
          timeoutMs,
        })
      );
    }
  }

  console.log(lines.join("\n"));
  process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
}

main();
