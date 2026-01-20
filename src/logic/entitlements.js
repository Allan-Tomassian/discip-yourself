import { resolveGoalType } from "../domain/goalType";

export function isPremium(data) {
  const entitlements = data?.profile?.entitlements;
  if (entitlements && typeof entitlements === "object") {
    if (entitlements.premium === true) return true;
  }
  return data?.profile?.plan === "premium";
}

export function getPlanLimits() {
  return {
    categories: 2,
    outcomes: 3,
    actions: 6,
    planningHorizonDays: 7,
    historyDays: 7,
    export: false,
  };
}

export function getGenerationWindowDays(data) {
  if (isPremium(data)) return 90;
  return getPlanLimits().planningHorizonDays;
}

export function isPlanningUnlimited(data) {
  return isPremium(data);
}

function countOutcomes(data) {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  return goals.filter((g) => resolveGoalType(g) === "OUTCOME").length;
}

function countActions(data) {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  return goals.filter((g) => resolveGoalType(g) === "PROCESS").length;
}

export function canCreateCategory(data) {
  if (isPremium(data)) return true;
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  return categories.length < getPlanLimits().categories;
}

export function canCreateOutcome(data) {
  if (isPremium(data)) return true;
  return countOutcomes(data) < getPlanLimits().outcomes;
}

export function canCreateAction(data) {
  if (isPremium(data)) return true;
  return countActions(data) < getPlanLimits().actions;
}
