import { canCreateCategory } from "./entitlements";
import { updateGoal } from "./goals";
import { SYSTEM_INBOX_ID } from "./state";

export function safeUpdateGoal(state, goalId, patch, options = {}) {
  const safeState = state && typeof state === "object" ? state : {};
  const { onOpenPaywall } = options || {};
  if (!goalId || !patch || typeof patch !== "object") {
    return { state: safeState, applied: false, blocked: false };
  }

  if ("categoryId" in patch) {
    const rawId = typeof patch.categoryId === "string" ? patch.categoryId.trim() : "";
    if (rawId && rawId !== SYSTEM_INBOX_ID) {
      const categories = Array.isArray(safeState.categories) ? safeState.categories : [];
      const exists = categories.some((c) => c && c.id === rawId);
      if (!exists) {
        if (!canCreateCategory(safeState)) {
          if (typeof onOpenPaywall === "function") onOpenPaywall("Limite de catégories atteinte.");
          return { state: safeState, applied: false, blocked: true };
        }
        return { state: safeState, applied: false, blocked: true };
      }
    }
  }

  return { state: updateGoal(safeState, goalId, patch), applied: true, blocked: false };
}
