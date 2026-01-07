export function getDominantGoalForDate({
  dateKey,
  goals,
  categories,
  occurrences,
  activeSession
}) {
  // 1. Session en cours = priorité absolue
  if (activeSession?.goalId) {
    return goals.find(g => g.id === activeSession.goalId) || null;
  }

  // 2. Occurrences planifiées ce jour
  const todays = occurrences.filter(o => o.date === dateKey);

  if (todays.length === 0) return null;

  // 3. Objectif prioritaire s’il existe
  const primary = todays
    .map(o => goals.find(g => g.id === o.goalId))
    .find(g => g?.priority === "primary");

  return primary || goals.find(g => g.id === todays[0].goalId) || null;
}