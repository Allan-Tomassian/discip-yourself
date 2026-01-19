export function isProcessLinkedToOutcome(processGoal, outcomeId) {
  if (!processGoal || !outcomeId) return false;
  return processGoal.parentId === outcomeId || processGoal.primaryGoalId === outcomeId;
}

export function splitProcessByLink(processGoals, outcomeId) {
  const linked = [];
  const unlinked = [];
  const list = Array.isArray(processGoals) ? processGoals : [];
  for (const g of list) {
    if (isProcessLinkedToOutcome(g, outcomeId)) linked.push(g);
    else unlinked.push(g);
  }
  return { linked, unlinked };
}

export function linkProcessToOutcome(state, processId, outcomeId) {
  if (!state || !processId || !outcomeId) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  let changed = false;
  const nextGoals = goals.map((g) => {
    if (!g || g.id !== processId) return g;
    if (g.parentId === outcomeId) return g;
    changed = true;
    return { ...g, parentId: outcomeId };
  });
  if (!changed) return state;
  return { ...state, goals: nextGoals };
}
