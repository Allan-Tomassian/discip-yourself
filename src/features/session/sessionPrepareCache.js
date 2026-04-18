import {
  normalizePreparedSessionRunbook,
  normalizeSessionBlueprintSnapshot,
  resolvePreparedSessionRunbookQuality,
} from "./sessionRunbook";
import { buildSessionToolPlan, normalizePreparedSessionToolPlan } from "./sessionTools";

export const SESSION_PREMIUM_PREPARE_CACHE_VERSION = 1;
export const SESSION_PREMIUM_PREPARE_CACHE_MAX_ENTRIES = 20;
export const SESSION_GUIDANCE_PREPARE_MODEL_FALLBACK = "gpt-5.4";
export const SESSION_GUIDANCE_PREPARE_PROMPT_VERSION = "session_guidance_prepare_v2";

export function canUseSessionPremiumPrepareCache(entitlementAccess = null) {
  return Boolean(entitlementAccess && entitlementAccess.canLaunchPremiumSession);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveMinutes(value, fallback = null) {
  const next = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Math.max(1, Math.round(next));
}

function normalizeTimestamp(value, fallback = null) {
  const next = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Math.max(1, Math.round(next));
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function hashString(value) {
  let hash = 5381;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function normalizeStoredSource(value) {
  return value === "ai_regenerated" ? "ai_regenerated" : "ai_fresh";
}

export function resolveSessionPremiumPrepareCacheIdentity({
  model = null,
  promptVersion = null,
} = {}) {
  return {
    model: asString(model) || SESSION_GUIDANCE_PREPARE_MODEL_FALLBACK,
    promptVersion: asString(promptVersion) || SESSION_GUIDANCE_PREPARE_PROMPT_VERSION,
  };
}

export function buildSessionPremiumPrepareBlueprintHash(blueprintSnapshot = null) {
  const normalizedBlueprint = normalizeSessionBlueprintSnapshot(blueprintSnapshot);
  if (!normalizedBlueprint) return "";
  return hashString(stableSerialize(normalizedBlueprint));
}

export function buildSessionPremiumPrepareCacheKey({
  preparePayload = null,
  occurrenceId = null,
  actionId = null,
  dateKey = null,
  protocolType = null,
  targetDurationMinutes = null,
  blueprintSnapshot = null,
  model = null,
  promptVersion = null,
} = {}) {
  const source = isPlainObject(preparePayload) ? preparePayload : {};
  const normalizedBlueprint = normalizeSessionBlueprintSnapshot(source.blueprintSnapshot || blueprintSnapshot);
  const resolvedOccurrenceId = asString(source.occurrenceId || occurrenceId);
  const resolvedActionId = asString(source.actionId || actionId);
  const resolvedDateKey = asString(source.dateKey || dateKey);
  const resolvedProtocolType = asString(source.protocolType || protocolType || normalizedBlueprint?.protocolType).toLowerCase();
  const resolvedDuration = normalizePositiveMinutes(
    source.targetDurationMinutes ?? targetDurationMinutes ?? normalizedBlueprint?.estimatedMinutes,
    null
  );
  const blueprintHash = buildSessionPremiumPrepareBlueprintHash(normalizedBlueprint);
  const identity = resolveSessionPremiumPrepareCacheIdentity({ model, promptVersion });

  if (
    !resolvedOccurrenceId ||
    !resolvedActionId ||
    !resolvedDateKey ||
    !resolvedProtocolType ||
    !resolvedDuration ||
    !blueprintHash
  ) {
    return "";
  }

  return [
    `v${SESSION_PREMIUM_PREPARE_CACHE_VERSION}`,
    resolvedOccurrenceId,
    resolvedActionId,
    resolvedDateKey,
    resolvedProtocolType,
    String(resolvedDuration),
    blueprintHash,
    identity.model,
    identity.promptVersion,
  ].join(":");
}

export function normalizeSessionPremiumPrepareCacheEntry(
  rawValue,
  {
    cacheKey = "",
    fallbackModel = null,
    fallbackPromptVersion = null,
  } = {}
) {
  const source = isPlainObject(rawValue) ? rawValue : null;
  if (!source) return null;
  const preparedRunbook = normalizePreparedSessionRunbook(source.preparedRunbook || null);
  if (!preparedRunbook) return null;
  if (!isPlainObject(source.quality)) return null;

  const quality = resolvePreparedSessionRunbookQuality({
    preparedRunbook,
    quality: source.quality,
  });
  if (!quality.isPremiumReady) return null;

  const requestId = asString(source.requestId);
  if (!requestId) return null;

  const identity = resolveSessionPremiumPrepareCacheIdentity({
    model: source.model || fallbackModel,
    promptVersion: source.promptVersion || fallbackPromptVersion,
  });
  const resolvedCacheKey = asString(source.cacheKey || cacheKey);
  const occurrenceId = asString(source.occurrenceId || preparedRunbook.occurrenceId);
  const actionId = asString(source.actionId || preparedRunbook.actionId);
  const dateKey = asString(source.dateKey || preparedRunbook.dateKey);
  const protocolType = asString(source.protocolType || preparedRunbook.protocolType).toLowerCase();
  const targetDurationMinutes = normalizePositiveMinutes(
    source.targetDurationMinutes ?? preparedRunbook.durationMinutes,
    null
  );
  const blueprintHash = asString(source.blueprintHash);
  if (!resolvedCacheKey || !occurrenceId || !actionId || !dateKey || !protocolType || !targetDurationMinutes || !blueprintHash) {
    return null;
  }

  const toolPlan =
    normalizePreparedSessionToolPlan(source.toolPlan || null, { sessionRunbook: preparedRunbook }) ||
    buildSessionToolPlan({ sessionRunbook: preparedRunbook });
  if (!toolPlan) return null;

  const preparedAt = normalizeTimestamp(source.preparedAt, Date.now());
  const lastUsedAt = normalizeTimestamp(source.lastUsedAt, preparedAt);

  return {
    cacheKey: resolvedCacheKey,
    occurrenceId,
    actionId,
    dateKey,
    protocolType,
    targetDurationMinutes,
    blueprintHash,
    preparedRunbook,
    toolPlan,
    quality,
    requestId,
    preparedAt,
    lastUsedAt,
    source: normalizeStoredSource(source.source),
    model: identity.model,
    promptVersion: identity.promptVersion,
  };
}

export function normalizeSessionPremiumPrepareCache(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  const rawEntries = isPlainObject(source.entriesByKey) ? source.entriesByKey : {};
  const entriesByKey = {};

  Object.entries(rawEntries).forEach(([cacheKey, entry]) => {
    const normalizedEntry = normalizeSessionPremiumPrepareCacheEntry(entry, { cacheKey });
    if (normalizedEntry) entriesByKey[cacheKey] = normalizedEntry;
  });

  const explicitOrder = Array.isArray(source.order) ? source.order.map((entry) => asString(entry)).filter(Boolean) : [];
  const remainingKeys = Object.keys(entriesByKey).filter((cacheKey) => !explicitOrder.includes(cacheKey));
  remainingKeys.sort((left, right) => {
    const leftUsedAt = entriesByKey[left]?.lastUsedAt || 0;
    const rightUsedAt = entriesByKey[right]?.lastUsedAt || 0;
    return rightUsedAt - leftUsedAt;
  });

  const order = [...explicitOrder, ...remainingKeys]
    .filter((cacheKey, index, list) => cacheKey && entriesByKey[cacheKey] && list.indexOf(cacheKey) === index)
    .slice(0, SESSION_PREMIUM_PREPARE_CACHE_MAX_ENTRIES);

  const prunedEntries = {};
  order.forEach((cacheKey) => {
    prunedEntries[cacheKey] = entriesByKey[cacheKey];
  });

  return {
    version: SESSION_PREMIUM_PREPARE_CACHE_VERSION,
    entriesByKey: prunedEntries,
    order,
  };
}

export function readSessionPremiumPrepareCacheEntry({
  cacheState = null,
  preparePayload = null,
  model = null,
  promptVersion = null,
} = {}) {
  const identity = resolveSessionPremiumPrepareCacheIdentity({ model, promptVersion });
  const cacheKey = buildSessionPremiumPrepareCacheKey({
    preparePayload,
    model: identity.model,
    promptVersion: identity.promptVersion,
  });
  if (!cacheKey) {
    return {
      cacheKey: "",
      cache: normalizeSessionPremiumPrepareCache(cacheState),
      entry: null,
    };
  }

  const cache = normalizeSessionPremiumPrepareCache(cacheState);
  const entry = normalizeSessionPremiumPrepareCacheEntry(cache.entriesByKey[cacheKey] || null, {
    cacheKey,
    fallbackModel: identity.model,
    fallbackPromptVersion: identity.promptVersion,
  });
  return {
    cacheKey,
    cache,
    entry,
  };
}

export function createSessionPremiumPrepareCacheEntry({
  preparePayload = null,
  preparedRunbook = null,
  toolPlan = null,
  quality = null,
  requestId = null,
  preparedAt = Date.now(),
  source = "ai_fresh",
  model = null,
  promptVersion = null,
} = {}) {
  if (!isPlainObject(preparePayload) || !isPlainObject(quality)) return null;
  const identity = resolveSessionPremiumPrepareCacheIdentity({ model, promptVersion });
  const cacheKey = buildSessionPremiumPrepareCacheKey({
    preparePayload,
    model: identity.model,
    promptVersion: identity.promptVersion,
  });
  if (!cacheKey) return null;

  const normalizedRunbook = normalizePreparedSessionRunbook(preparedRunbook || null);
  if (!normalizedRunbook) return null;

  const resolvedQuality = resolvePreparedSessionRunbookQuality({
    preparedRunbook: normalizedRunbook,
    quality,
  });
  if (!resolvedQuality.isPremiumReady) return null;

  const normalizedRequestId = asString(requestId);
  if (!normalizedRequestId) return null;

  const normalizedBlueprint = normalizeSessionBlueprintSnapshot(preparePayload.blueprintSnapshot);
  const blueprintHash = buildSessionPremiumPrepareBlueprintHash(normalizedBlueprint);
  const normalizedToolPlan =
    normalizePreparedSessionToolPlan(toolPlan || null, { sessionRunbook: normalizedRunbook }) ||
    buildSessionToolPlan({ sessionRunbook: normalizedRunbook });
  if (!normalizedToolPlan || !blueprintHash) return null;

  const preparedTimestamp = normalizeTimestamp(preparedAt, Date.now());

  return normalizeSessionPremiumPrepareCacheEntry(
    {
      cacheKey,
      occurrenceId: preparePayload.occurrenceId,
      actionId: preparePayload.actionId,
      dateKey: preparePayload.dateKey,
      protocolType: preparePayload.protocolType || normalizedBlueprint?.protocolType || normalizedRunbook.protocolType,
      targetDurationMinutes: preparePayload.targetDurationMinutes,
      blueprintHash,
      preparedRunbook: normalizedRunbook,
      toolPlan: normalizedToolPlan,
      quality: resolvedQuality,
      requestId: normalizedRequestId,
      preparedAt: preparedTimestamp,
      lastUsedAt: preparedTimestamp,
      source: normalizeStoredSource(source),
      model: identity.model,
      promptVersion: identity.promptVersion,
    },
    {
      cacheKey,
      fallbackModel: identity.model,
      fallbackPromptVersion: identity.promptVersion,
    }
  );
}

export function upsertSessionPremiumPrepareCacheEntry(cacheState, entry, { usedAt = Date.now() } = {}) {
  const cache = normalizeSessionPremiumPrepareCache(cacheState);
  const normalizedEntry = normalizeSessionPremiumPrepareCacheEntry(entry, {
    cacheKey: entry?.cacheKey || "",
    fallbackModel: entry?.model || null,
    fallbackPromptVersion: entry?.promptVersion || null,
  });
  if (!normalizedEntry) return cache;

  const lastUsedAt = normalizeTimestamp(usedAt, normalizedEntry.preparedAt);
  const nextEntry = { ...normalizedEntry, lastUsedAt };
  const nextEntriesByKey = {
    ...cache.entriesByKey,
    [nextEntry.cacheKey]: nextEntry,
  };
  const nextOrder = [nextEntry.cacheKey, ...cache.order.filter((cacheKey) => cacheKey !== nextEntry.cacheKey)]
    .slice(0, SESSION_PREMIUM_PREPARE_CACHE_MAX_ENTRIES);

  const prunedEntries = {};
  nextOrder.forEach((cacheKey) => {
    if (nextEntriesByKey[cacheKey]) prunedEntries[cacheKey] = nextEntriesByKey[cacheKey];
  });

  return {
    version: SESSION_PREMIUM_PREPARE_CACHE_VERSION,
    entriesByKey: prunedEntries,
    order: nextOrder,
  };
}

export function touchSessionPremiumPrepareCacheEntry(cacheState, cacheKey, { usedAt = Date.now() } = {}) {
  const normalizedCacheKey = asString(cacheKey);
  const cache = normalizeSessionPremiumPrepareCache(cacheState);
  if (!normalizedCacheKey || !cache.entriesByKey[normalizedCacheKey]) return cache;
  const nextEntry = {
    ...cache.entriesByKey[normalizedCacheKey],
    lastUsedAt: normalizeTimestamp(usedAt, cache.entriesByKey[normalizedCacheKey].lastUsedAt),
  };
  return upsertSessionPremiumPrepareCacheEntry(cache, nextEntry, {
    usedAt: nextEntry.lastUsedAt,
  });
}
