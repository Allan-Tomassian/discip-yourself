import { resolveGoalType } from "./goalType";
import { resolveVisibleCategoryId } from "./categoryVisibility";

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finalizeActionCandidate(candidate, categoryId) {
  return {
    ...candidate,
    title: asString(candidate?.title),
    categoryId,
    type: "PROCESS",
  };
}

export function isActionGoal(goal) {
  return resolveGoalType(goal) === "PROCESS";
}

export function validateActionCandidate(candidate, { categories } = {}) {
  const errors = [];
  const title = asString(candidate?.title);
  if (!title) errors.push("title");
  const categoryId = resolveVisibleCategoryId(candidate?.categoryId, categories);
  if (!categoryId) errors.push("categoryId");
  return {
    ok: errors.length === 0,
    title,
    categoryId,
    errors,
  };
}

export function createActionModel(candidate, options = {}) {
  const validation = validateActionCandidate(candidate, options);
  if (!validation.ok) return { ok: false, errors: validation.errors, value: null };
  return {
    ok: true,
    errors: [],
    value: finalizeActionCandidate(
      {
        ...(candidate && typeof candidate === "object" ? candidate : {}),
        title: validation.title,
      },
      validation.categoryId
    ),
  };
}

export function updateActionModel(existingAction, updates, options = {}) {
  const existing = existingAction && typeof existingAction === "object" ? existingAction : {};
  const merged = { ...existing, ...(updates && typeof updates === "object" ? updates : {}) };
  const validation = validateActionCandidate(merged, options);
  if (!validation.ok) return { ok: false, errors: validation.errors, value: null };
  return {
    ok: true,
    errors: [],
    value: finalizeActionCandidate(
      {
        ...merged,
        title: validation.title,
      },
      validation.categoryId
    ),
  };
}
