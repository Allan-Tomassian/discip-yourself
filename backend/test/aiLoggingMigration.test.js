import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AI_COST_CLASSES,
  AI_FEATURE_IDS,
  AI_MODEL_CLASSES,
  AI_TIERS,
} from "../../src/domain/aiPolicy.js";

const migrationSql = readFileSync(
  resolve("../supabase/migrations/20260520190000_expand_ai_request_logs_feature_policy.sql"),
  "utf8"
);

test("AI logging migration adds feature-scoped usage columns with safe defaults", () => {
  for (const column of [
    "feature_id",
    "cost_class",
    "model_class",
    "model",
    "prompt_version",
    "counts_for_quota boolean not null default false",
    "usage_units integer not null default 0",
    "cache_hit boolean not null default false",
    "input_bytes",
    "output_bytes",
    "provider_input_tokens",
    "provider_output_tokens",
    "route_name",
  ]) {
    assert.match(migrationSql, new RegExp(column.replace(/[()]/g, "\\$&")));
  }
});

test("AI logging migration accepts planned policy values and widens plan tiers", () => {
  for (const featureId of Object.values(AI_FEATURE_IDS)) {
    assert.match(migrationSql, new RegExp(`'${featureId}'`));
  }
  for (const costClass of Object.values(AI_COST_CLASSES)) {
    assert.match(migrationSql, new RegExp(`'${costClass}'`));
  }
  for (const modelClass of Object.values(AI_MODEL_CLASSES)) {
    assert.match(migrationSql, new RegExp(`'${modelClass}'`));
  }
  for (const tier of Object.values(AI_TIERS)) {
    assert.match(migrationSql, new RegExp(`'${tier}'`));
  }
});

test("AI logging migration keeps legacy logs compatible and adds quota indexes", () => {
  assert.match(migrationSql, /drop constraint if exists ai_request_logs_coach_kind_check/i);
  assert.match(migrationSql, /case coach_kind/i);
  assert.match(migrationSql, /status_code >= 200/i);
  assert.match(migrationSql, /status_code < 300/i);
  assert.match(migrationSql, /coalesce\(cache_hit, false\) = false/i);
  assert.match(migrationSql, /ai_request_logs_user_feature_created_at_idx/i);
  assert.match(migrationSql, /ai_request_logs_user_counts_created_at_idx/i);
  assert.match(migrationSql, /ai_request_logs_feature_created_at_idx/i);
  assert.match(migrationSql, /ai_request_logs_request_hash_idx/i);
});
