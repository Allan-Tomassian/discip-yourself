export function getDominantGoalForDate({
  dateKey,
  goals,
  categories,
  occurrences,
  activeSession,
}) {
  const safeGoals = Array.isArray(goals) ? goals : [];
  const safeOccurrences = Array.isArray(occurrences) ? occurrences : [];

  const goalById = new Map(safeGoals.map((g) => [g?.id, g]));

  const resolveObjectiveForGoal = (g) => {
    if (!g) return null;
    const type = (g.type || g.kind || "").toString().toUpperCase();
    if (type === "OUTCOME" || type === "STATE") return g;
    const parentId = typeof g.parentId === "string" ? g.parentId : null;
    if (!parentId) return null;
    const parent = goalById.get(parentId) || null;
    const parentType = (parent?.type || parent?.kind || "").toString().toUpperCase();
    if (parent && (parentType === "OUTCOME" || parentType === "STATE")) return parent;
    return null;
  };

  const normalizePriority = (p) => {
    const raw = (p || "").toString().toLowerCase();
    if (raw === "prioritaire" || raw === "primary") return "prioritaire";
    if (raw === "secondaire" || raw === "secondary") return "secondaire";
    if (raw === "bonus") return "bonus";
    return "";
  };

  // 1) Session en cours = priorité absolue
  const activeId =
    (typeof activeSession?.objectiveId === "string" && activeSession.objectiveId) ||
    (typeof activeSession?.goalId === "string" && activeSession.goalId) ||
    null;
  if (activeId) {
    const activeGoal = goalById.get(activeId) || null;
    return resolveObjectiveForGoal(activeGoal) || activeGoal || null;
  }

  // 2) Occurrences planifiées ce jour
  const todays = safeOccurrences.filter((o) => o && o.date === dateKey);
  if (!todays.length) return null;

  // 3) Construire la liste des objectifs (OUTCOME) liés aux occurrences du jour (dans l'ordre)
  const objectives = [];
  const seen = new Set();
  for (const occ of todays) {
    const g = goalById.get(occ.goalId) || null;
    const obj = resolveObjectiveForGoal(g);
    if (!obj || !obj.id || seen.has(obj.id)) continue;
    seen.add(obj.id);
    objectives.push(obj);
  }

  if (!objectives.length) {
    // Fallback: retourner le premier goal rencontré (utile si occurrences pointent déjà sur un OUTCOME)
    const g = goalById.get(todays[0].goalId) || null;
    return resolveObjectiveForGoal(g) || g || null;
  }

  // 4) Objectif prioritaire s’il existe (prioritaire/primary)
  const primary = objectives.find((g) => normalizePriority(g?.priority) === "prioritaire");
  return primary || objectives[0] || null;
}