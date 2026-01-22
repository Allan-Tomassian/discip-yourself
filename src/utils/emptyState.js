import { resolveGoalType } from "../domain/goalType";

export function isAppEmpty(data) {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const hasOutcome = goals.some((g) => resolveGoalType(g) === "OUTCOME");
  const hasProcess = goals.some((g) => resolveGoalType(g) === "PROCESS");
  return !hasOutcome && !hasProcess;
}
