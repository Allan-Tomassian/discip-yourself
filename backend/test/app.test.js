import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

const TEST_CONFIG = {
  PORT: 3001,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "gpt-4.1-mini",
  LOG_LEVEL: "silent",
};

test("app boots", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  await app.ready();
  assert.equal(app.initialConfig.bodyLimit, 16 * 1024);
  await app.close();
});

test("GET /health returns ok", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  await app.close();
});

test("POST /ai/now without bearer returns 401", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: null,
      surface: "today",
      trigger: "manual",
    },
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "UNAUTHORIZED");
  await app.close();
});
