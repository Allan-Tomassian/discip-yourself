export const BEHAVIOR_FEEDBACK_KIND = Object.freeze({
  immediate: "immediate",
  structure: "structure",
  continuity: "continuity",
  momentum: "momentum",
});

export const BEHAVIOR_FEEDBACK_MOTION = Object.freeze({
  enterMs: 180,
  exitMs: 160,
  visibleMs: 2050,
  cooldownMs: 8000,
});

const DEFAULT_PRIORITY_BY_KIND = Object.freeze({
  [BEHAVIOR_FEEDBACK_KIND.immediate]: 40,
  [BEHAVIOR_FEEDBACK_KIND.structure]: 30,
  [BEHAVIOR_FEEDBACK_KIND.continuity]: 20,
  [BEHAVIOR_FEEDBACK_KIND.momentum]: 10,
});

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getBehaviorFeedbackPriority(kind) {
  return DEFAULT_PRIORITY_BY_KIND[kind] || DEFAULT_PRIORITY_BY_KIND[BEHAVIOR_FEEDBACK_KIND.momentum];
}

export function isBehaviorFeedbackSignal(value) {
  return Boolean(value && typeof value === "object" && asString(value.message));
}

export function createBehaviorFeedbackSignal(input = {}) {
  if (!input || typeof input !== "object") return null;
  const message = asString(input.message);
  if (!message) return null;
  const kind = asString(input.kind) || BEHAVIOR_FEEDBACK_KIND.immediate;
  return {
    kind,
    message,
    tone: asString(input.tone) || kind,
    scope: asString(input.scope) || "execution",
    categoryId: asString(input.categoryId) || null,
    priority: Number.isFinite(input.priority)
      ? Number(input.priority)
      : getBehaviorFeedbackPriority(kind),
    cooldownKey: asString(input.cooldownKey) || `${kind}:${message}`,
    surface: asString(input.surface) || null,
    cueKind: asString(input.cueKind) || null,
  };
}

export function createBehaviorCue(input = {}) {
  if (!input || typeof input !== "object") return null;
  const message = asString(input.message);
  if (!message) return null;
  return {
    cueKind: asString(input.cueKind) || "structure",
    message,
  };
}
