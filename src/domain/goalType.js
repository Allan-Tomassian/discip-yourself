import { LABELS } from "../ui/labels";

export function resolveGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  if (raw === "STATE") return "OUTCOME";
  if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
  const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
  if (legacy === "OUTCOME") return "OUTCOME";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  const planType = typeof goal?.planType === "string" ? goal.planType.toUpperCase() : "";
  if (planType === "STATE") return "OUTCOME";
  if (planType === "ACTION" || planType === "ONE_OFF") return "PROCESS";
  return "PROCESS";
}

export function isOutcome(goal) {
  return resolveGoalType(goal) === "OUTCOME";
}

export function isProcess(goal) {
  return resolveGoalType(goal) === "PROCESS";
}

export function labelForGoalType(goal) {
  const type = resolveGoalType(goal);
  if (type === "OUTCOME") return LABELS.goal;
  if (type === "PROCESS") return LABELS.action;
  return "";
}
