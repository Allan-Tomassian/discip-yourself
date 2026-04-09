import { deriveActionProtocol } from "./actionProtocol";

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value) {
  const next = asString(value);
  return next || null;
}

function normalizeEstimatedMinutes(value) {
  const next = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(next) || next <= 0) return null;
  return Math.max(1, Math.round(next));
}

function normalizeProtocolType(value, fallback = "generic") {
  const next = asString(value).toLowerCase();
  if (next === "sport") return "sport";
  if (next === "deep_work") return "deep_work";
  if (next === "admin") return "admin";
  if (next === "routine") return "routine";
  if (next === "generic") return "generic";
  return fallback;
}

export function normalizePrimaryActionRef(rawValue, actionDrafts = []) {
  const safeDrafts = Array.isArray(actionDrafts) ? actionDrafts : [];
  if (!safeDrafts.length) return null;
  const rawIndex = Number(rawValue?.index);
  const index =
    Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < safeDrafts.length
      ? rawIndex
      : 0;
  return { index };
}

export function buildSessionBlueprintDraft({ actionDraft = null, categoryName = "" } = {}) {
  const title = asString(actionDraft?.title);
  if (!title) return null;

  const protocol = deriveActionProtocol({
    title,
    categoryName: asString(categoryName),
    durationMinutes: normalizeEstimatedMinutes(actionDraft?.durationMinutes) || 0,
    isHabitLike: actionDraft?.repeat === "daily" || actionDraft?.repeat === "weekly",
  });

  return {
    version: 1,
    source: "action_protocol_v1",
    protocolType: normalizeProtocolType(protocol.type),
    why: protocol.why,
    firstStep: protocol.firstStep,
    ifBlocked: protocol.ifBlocked,
    successDefinition: protocol.successDefinition,
    estimatedMinutes: normalizeEstimatedMinutes(actionDraft?.durationMinutes),
  };
}

export function normalizeSessionBlueprintDraft(rawValue, { fallback = null } = {}) {
  const source =
    rawValue && typeof rawValue === "object"
      ? rawValue
      : fallback && typeof fallback === "object"
        ? fallback
        : null;
  if (!source) return null;

  const why = asString(source.why || fallback?.why);
  const firstStep = asString(source.firstStep || fallback?.firstStep);
  const ifBlocked = asString(source.ifBlocked || fallback?.ifBlocked);
  const successDefinition = asString(source.successDefinition || fallback?.successDefinition);
  if (!why || !firstStep || !ifBlocked || !successDefinition) return null;

  return {
    version: 1,
    source: "action_protocol_v1",
    protocolType: normalizeProtocolType(source.protocolType || source.type || fallback?.protocolType, "generic"),
    why,
    firstStep,
    ifBlocked,
    successDefinition,
    estimatedMinutes: normalizeEstimatedMinutes(
      source.estimatedMinutes ?? source.durationMinutes ?? fallback?.estimatedMinutes
    ),
  };
}

export function buildPersistedSessionBlueprint({
  actionDraft = null,
  categoryName = "",
  conversationId = null,
} = {}) {
  const blueprintDraft = buildSessionBlueprintDraft({ actionDraft, categoryName });
  if (!blueprintDraft) return null;

  return {
    version: 1,
    status: "validated",
    source: "coach_plan",
    protocolType: blueprintDraft.protocolType,
    why: blueprintDraft.why,
    firstStep: blueprintDraft.firstStep,
    ifBlocked: blueprintDraft.ifBlocked,
    successDefinition: blueprintDraft.successDefinition,
    estimatedMinutes: blueprintDraft.estimatedMinutes,
    conversationId: asNullableString(conversationId),
  };
}
