import {
  AI_MODEL_CLASSES,
  getAiFeaturePolicy,
} from "../../../src/domain/aiPolicy.js";

const MODEL_ENV_BY_CLASS = Object.freeze({
  [AI_MODEL_CLASSES.FAST_LOW_COST_TEXT]: "AI_MODEL_FAST_LOW_COST_TEXT",
  [AI_MODEL_CLASSES.STRUCTURED_JSON_SMALL]: "AI_MODEL_STRUCTURED_JSON_SMALL",
  [AI_MODEL_CLASSES.REASONING_MEDIUM]: "AI_MODEL_REASONING_MEDIUM",
  [AI_MODEL_CLASSES.REASONING_DEEP]: "AI_MODEL_REASONING_DEEP",
  [AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS]: "AI_MODEL_PREMIUM_DEEP_ANALYSIS",
  [AI_MODEL_CLASSES.MULTIMODAL_VISION]: "AI_MODEL_MULTIMODAL_VISION",
  [AI_MODEL_CLASSES.DOCUMENT_SUMMARY]: "AI_MODEL_DOCUMENT_SUMMARY",
});

const TIMEOUT_ENV_BY_CLASS = Object.freeze({
  [AI_MODEL_CLASSES.FAST_LOW_COST_TEXT]: "AI_TIMEOUT_FAST_LOW_COST_TEXT_MS",
  [AI_MODEL_CLASSES.STRUCTURED_JSON_SMALL]: "AI_TIMEOUT_STRUCTURED_JSON_SMALL_MS",
  [AI_MODEL_CLASSES.REASONING_MEDIUM]: "AI_TIMEOUT_REASONING_MEDIUM_MS",
  [AI_MODEL_CLASSES.REASONING_DEEP]: "AI_TIMEOUT_REASONING_DEEP_MS",
  [AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS]: "AI_TIMEOUT_PREMIUM_DEEP_ANALYSIS_MS",
  [AI_MODEL_CLASSES.MULTIMODAL_VISION]: "AI_TIMEOUT_MULTIMODAL_VISION_MS",
  [AI_MODEL_CLASSES.DOCUMENT_SUMMARY]: "AI_TIMEOUT_DOCUMENT_SUMMARY_MS",
});

const DEFAULT_MODEL_BY_CLASS = Object.freeze({
  [AI_MODEL_CLASSES.FAST_LOW_COST_TEXT]: "gpt-4.1-mini",
  [AI_MODEL_CLASSES.STRUCTURED_JSON_SMALL]: "gpt-4.1-mini",
  [AI_MODEL_CLASSES.REASONING_MEDIUM]: "gpt-4.1-mini",
  [AI_MODEL_CLASSES.REASONING_DEEP]: "gpt-5.4",
  [AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS]: "gpt-5.4",
  [AI_MODEL_CLASSES.MULTIMODAL_VISION]: "gpt-5.4",
  [AI_MODEL_CLASSES.DOCUMENT_SUMMARY]: "gpt-4.1-mini",
});

const TIMEOUT_BOUNDS_BY_CLASS = Object.freeze({
  [AI_MODEL_CLASSES.FAST_LOW_COST_TEXT]: Object.freeze({ min: 8_000, max: 15_000, fallback: 15_000 }),
  [AI_MODEL_CLASSES.STRUCTURED_JSON_SMALL]: Object.freeze({ min: 8_000, max: 12_000, fallback: 10_000 }),
  [AI_MODEL_CLASSES.REASONING_MEDIUM]: Object.freeze({ min: 20_000, max: 45_000, fallback: 35_000 }),
  [AI_MODEL_CLASSES.REASONING_DEEP]: Object.freeze({ min: 45_000, max: 65_000, fallback: 60_000 }),
  [AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS]: Object.freeze({ min: 65_000, max: 90_000, fallback: 65_000 }),
  [AI_MODEL_CLASSES.MULTIMODAL_VISION]: Object.freeze({ min: 30_000, max: 90_000, fallback: 60_000 }),
  [AI_MODEL_CLASSES.DOCUMENT_SUMMARY]: Object.freeze({ min: 20_000, max: 60_000, fallback: 45_000 }),
});

function cleanString(value) {
  return String(value || "").trim();
}

function readPositiveInteger(value) {
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number);
}

function clampTimeout(value, { min = 1_000, max = 90_000 } = {}) {
  const number = readPositiveInteger(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, number));
}

function readConfigValue(config, key) {
  if (!key) return "";
  return config?.[key];
}

function resolveModel({ config, modelClass, routeOverride = {} }) {
  const classEnvName = MODEL_ENV_BY_CLASS[modelClass];
  const routeModel = cleanString(routeOverride.model);
  if (routeModel) return { model: routeModel, source: "route_override" };

  const classModel = cleanString(readConfigValue(config, classEnvName));
  if (classModel) return { model: classModel, source: "model_class" };

  const allowGlobalFallback = routeOverride.allowGlobalFallback !== false;
  const globalModel = allowGlobalFallback ? cleanString(config?.OPENAI_MODEL) : "";
  if (globalModel) return { model: globalModel, source: "global" };

  const defaultModel = cleanString(routeOverride.defaultModel) || DEFAULT_MODEL_BY_CLASS[modelClass] || "";
  return {
    model: defaultModel || null,
    source: defaultModel ? "default" : null,
  };
}

function resolveTimeout({ config, modelClass, routeOverride = {} }) {
  const classBounds = TIMEOUT_BOUNDS_BY_CLASS[modelClass] || { min: 1_000, max: 90_000, fallback: null };
  const routeBounds = {
    min: Number.isFinite(routeOverride.minTimeoutMs) ? routeOverride.minTimeoutMs : classBounds.min,
    max: Number.isFinite(routeOverride.maxTimeoutMs) ? routeOverride.maxTimeoutMs : classBounds.max,
  };
  const routeTimeout = clampTimeout(routeOverride.timeoutMs, routeBounds);
  if (Number.isFinite(routeTimeout)) return { timeoutMs: routeTimeout, source: "route_override" };

  const classEnvName = TIMEOUT_ENV_BY_CLASS[modelClass];
  const classTimeout = clampTimeout(readConfigValue(config, classEnvName), classBounds);
  if (Number.isFinite(classTimeout)) return { timeoutMs: classTimeout, source: "model_class" };

  const defaultTimeout = clampTimeout(
    Number.isFinite(routeOverride.defaultTimeoutMs) ? routeOverride.defaultTimeoutMs : classBounds.fallback,
    routeBounds
  );
  return {
    timeoutMs: Number.isFinite(defaultTimeout) ? defaultTimeout : null,
    source: Number.isFinite(defaultTimeout) ? "default" : null,
  };
}

export function resolveAiModelConfig({
  featureId,
  config = {},
  routeOverride = {},
} = {}) {
  const normalizedFeatureId = cleanString(featureId);
  const featurePolicy = getAiFeaturePolicy(normalizedFeatureId);
  if (!featurePolicy?.modelClass) {
    return {
      featureId: normalizedFeatureId || null,
      modelClass: null,
      model: null,
      timeoutMs: null,
      promptVersion: cleanString(routeOverride.promptVersion) || null,
      source: {
        model: null,
        timeout: null,
      },
    };
  }

  const modelClass = featurePolicy.modelClass;
  const model = resolveModel({ config, modelClass, routeOverride });
  const timeout = resolveTimeout({ config, modelClass, routeOverride });

  return {
    featureId: normalizedFeatureId,
    modelClass,
    model: model.model,
    timeoutMs: timeout.timeoutMs,
    promptVersion: cleanString(routeOverride.promptVersion) || null,
    source: {
      model: model.source,
      timeout: timeout.source,
    },
  };
}

export function getAiModelClassEnvName(modelClass) {
  return MODEL_ENV_BY_CLASS[modelClass] || null;
}

export function getAiTimeoutClassEnvName(modelClass) {
  return TIMEOUT_ENV_BY_CLASS[modelClass] || null;
}
