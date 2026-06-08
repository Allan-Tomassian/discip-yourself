import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_FEATURE_IDS,
  AI_MODEL_CLASSES,
  AI_FEATURE_POLICY,
} from "../../src/domain/aiPolicy.js";
import { resolveAiModelConfig } from "../src/services/aiModelRouting.js";

test("resolveAiModelConfig resolves every active feature to its policy model class", () => {
  for (const [featureId, policy] of Object.entries(AI_FEATURE_POLICY)) {
    const resolved = resolveAiModelConfig({ featureId, config: { OPENAI_MODEL: "global-model" } });
    assert.equal(resolved.featureId, featureId);
    assert.equal(resolved.modelClass, policy.modelClass);
    assert.ok(resolved.model);
  }
});

test("route-specific model overrides model-class and global envs", () => {
  const resolved = resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    config: {
      OPENAI_MODEL: "global-model",
      AI_MODEL_PREMIUM_DEEP_ANALYSIS: "class-model",
    },
    routeOverride: {
      model: "route-model",
      timeoutMs: 88_000,
      defaultModel: "default-model",
      defaultTimeoutMs: 65_000,
      maxTimeoutMs: 90_000,
      allowGlobalFallback: false,
    },
  });

  assert.equal(resolved.modelClass, AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS);
  assert.equal(resolved.model, "route-model");
  assert.equal(resolved.source.model, "route_override");
  assert.equal(resolved.timeoutMs, 88_000);
  assert.equal(resolved.source.timeout, "route_override");
});

test("route-specific model class can select reasoning medium without changing the feature policy", () => {
  const resolved = resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.TODAY_AI_INSIGHT,
    config: {
      OPENAI_MODEL: "global-model",
      AI_MODEL_FAST_LOW_COST_TEXT: "fast-class-model",
      AI_MODEL_REASONING_MEDIUM: "reasoning-class-model",
      AI_TIMEOUT_REASONING_MEDIUM_MS: 34_000,
    },
    routeOverride: {
      modelClass: AI_MODEL_CLASSES.REASONING_MEDIUM,
      defaultTimeoutMs: 35_000,
    },
  });

  assert.equal(AI_FEATURE_POLICY[AI_FEATURE_IDS.TODAY_AI_INSIGHT].modelClass, AI_MODEL_CLASSES.FAST_LOW_COST_TEXT);
  assert.equal(resolved.modelClass, AI_MODEL_CLASSES.REASONING_MEDIUM);
  assert.equal(resolved.model, "reasoning-class-model");
  assert.equal(resolved.timeoutMs, 34_000);
});

test("model-class env overrides the global fallback", () => {
  const resolved = resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.COACH_CHAT_FREE,
    config: {
      OPENAI_MODEL: "global-model",
      AI_MODEL_FAST_LOW_COST_TEXT: "fast-class-model",
      AI_TIMEOUT_FAST_LOW_COST_TEXT_MS: 12_000,
    },
    routeOverride: {
      defaultModel: "default-model",
      defaultTimeoutMs: 15_000,
    },
  });

  assert.equal(resolved.modelClass, AI_MODEL_CLASSES.FAST_LOW_COST_TEXT);
  assert.equal(resolved.model, "fast-class-model");
  assert.equal(resolved.source.model, "model_class");
  assert.equal(resolved.timeoutMs, 12_000);
  assert.equal(resolved.source.timeout, "model_class");
});

test("unknown features fail safely", () => {
  const resolved = resolveAiModelConfig({
    featureId: "unknown_feature",
    config: {
      OPENAI_MODEL: "global-model",
    },
  });

  assert.deepEqual(resolved, {
    featureId: "unknown_feature",
    modelClass: null,
    model: null,
    timeoutMs: null,
    promptVersion: null,
    source: {
      model: null,
      timeout: null,
    },
  });
});

test("timeout clamping follows model-class bands", () => {
  const structured = resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.WHY_CLARIFICATION,
    config: {
      AI_TIMEOUT_STRUCTURED_JSON_SMALL_MS: 30_000,
    },
  });
  const premium = resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    config: {
      AI_TIMEOUT_PREMIUM_DEEP_ANALYSIS_MS: 120_000,
    },
    routeOverride: {
      allowGlobalFallback: false,
    },
  });

  assert.equal(structured.timeoutMs, 12_000);
  assert.equal(premium.timeoutMs, 90_000);
});

test("system analysis resolves to premium deep analysis", () => {
  const resolved = resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    config: {},
    routeOverride: {
      defaultModel: "gpt-5.4",
      defaultTimeoutMs: 65_000,
      maxTimeoutMs: 90_000,
      allowGlobalFallback: false,
    },
  });

  assert.equal(resolved.modelClass, AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS);
  assert.equal(resolved.model, "gpt-5.4");
  assert.equal(resolved.timeoutMs, 65_000);
});

test("cheap and starter features do not resolve to premium deep analysis", () => {
  for (const featureId of [
    AI_FEATURE_IDS.COACH_CHAT_FREE,
    AI_FEATURE_IDS.WHY_CLARIFICATION,
    AI_FEATURE_IDS.FIRST_RUN_STARTER_HINTS,
  ]) {
    const resolved = resolveAiModelConfig({ featureId, config: { OPENAI_MODEL: "global-model" } });
    assert.notEqual(resolved.modelClass, AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS);
  }
});

test("starter hints do not inherit the first-run full plan route model", () => {
  const resolved = resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.FIRST_RUN_STARTER_HINTS,
    config: {
      OPENAI_MODEL: "global-model",
      FIRST_RUN_PLAN_OPENAI_MODEL: "deep-plan-route-model",
      AI_MODEL_STRUCTURED_JSON_SMALL: "structured-class-model",
    },
    routeOverride: {
      model: "",
      timeoutMs: 10_000,
      defaultModel: "gpt-4.1-mini",
      defaultTimeoutMs: 10_000,
      maxTimeoutMs: 12_000,
      allowGlobalFallback: true,
    },
  });

  assert.equal(resolved.modelClass, AI_MODEL_CLASSES.STRUCTURED_JSON_SMALL);
  assert.equal(resolved.model, "structured-class-model");
  assert.notEqual(resolved.model, "deep-plan-route-model");
});
