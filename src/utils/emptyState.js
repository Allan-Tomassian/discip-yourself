
import { resolveGoalType } from "../domain/goalType";

function isActiveGoal(g) {
  if (!g || typeof g !== "object") return false;
  // Be conservative: only ignore goals explicitly marked as removed/archived.
  const status = typeof g.status === "string" ? g.status.toLowerCase() : "";
  if (status === "deleted" || status === "removed" || status === "archived") return false;
  return true;
}

function safeGoalType(g) {
  try {
    return resolveGoalType(g);
  } catch {
    // Fallbacks for legacy/partial objects
    const t = typeof g?.type === "string" ? g.type : "";
    const gt = typeof g?.goalType === "string" ? g.goalType : "";
    const pt = typeof g?.planType === "string" ? g.planType : "";
    const v = (t || gt || pt).toUpperCase();
    if (v.includes("OUTCOME")) return "OUTCOME";
    if (v.includes("PROCESS") || v.includes("HABIT")) return "PROCESS";
    return "";
  }
}

/**
 * App is considered "empty" when there is no actionable content to display.
 * We only consider goals that are not explicitly archived/deleted.
 */
export function isAppEmpty(data) {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const activeGoals = goals.filter(isActiveGoal);

  const hasOutcome = activeGoals.some((g) => safeGoalType(g) === "OUTCOME");
  const hasProcess = activeGoals.some((g) => safeGoalType(g) === "PROCESS");

  return !hasOutcome && !hasProcess;
}
