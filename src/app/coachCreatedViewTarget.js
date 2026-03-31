import { resolveGoalType } from "../domain/goalType";

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeActionIds(value) {
  return Array.isArray(value)
    ? value.map((entry) => trimString(entry)).filter(Boolean).slice(0, 6)
    : [];
}

export function normalizeLibraryFocusTarget(rawTarget) {
  const source = rawTarget && typeof rawTarget === "object" ? rawTarget : {};
  const type = trimString(source.type);
  if (type !== "library-focus" && type !== "library-category") return null;
  return {
    type: "library-focus",
    categoryId: trimString(source.categoryId) || null,
    section:
      source.section === "objectives" || source.focusSection === "objectives"
        ? "objectives"
        : "actions",
    outcomeId: trimString(source.outcomeId) || null,
    actionIds: normalizeActionIds(source.actionIds),
  };
}

export function resolveCoachCreatedViewTarget(rawTarget, goals = []) {
  const target = rawTarget && typeof rawTarget === "object" ? rawTarget : null;
  if (!target) return null;

  const normalizedLibraryTarget = normalizeLibraryFocusTarget(target);
  if (normalizedLibraryTarget) return normalizedLibraryTarget;

  if (trimString(target.type) !== "edit-item") return null;

  const itemId = trimString(target.itemId);
  if (!itemId) return null;
  const goal = Array.isArray(goals) ? goals.find((entry) => entry?.id === itemId) || null : null;
  const goalType = goal ? resolveGoalType(goal) : null;

  return {
    type: "library-focus",
    categoryId: trimString(goal?.categoryId) || trimString(target.categoryId) || null,
    section: goalType === "OUTCOME" ? "objectives" : "actions",
    outcomeId: goalType === "OUTCOME" ? itemId : null,
    actionIds: goalType === "PROCESS" ? [itemId] : [],
  };
}
