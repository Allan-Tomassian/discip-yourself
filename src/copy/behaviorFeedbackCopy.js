export const BEHAVIOR_FEEDBACK_COPY = Object.freeze({
  immediate: Object.freeze({
    done: "C'est fait",
    progressLogged: "Progression enregistrée",
    planningUpdated: "Planification mise à jour",
    actionUpdated: "Action mise à jour",
    structureUpdated: "Structure mise à jour",
  }),
  structure: Object.freeze({
    addedToStructure: "Ajouté à ta structure",
    objectiveAdded: "Objectif ajouté à ta structure",
    priorityAligned: "Priorité active renforcée",
    structureClarified: "Structure clarifiée",
    structureCoherent: "Structure cohérente",
    systemReadable: "Système plus lisible",
  }),
  continuity: Object.freeze({
    continuityMaintained: "Continuité maintenue",
    continuityActive: "Continuité active",
    steadyRhythm: "Rythme stable",
    steadyProgress: "Progression constante",
  }),
  momentum: Object.freeze({
    nextStepReady: "Prochaine étape prête",
    coherentBlock: "Bloc cohérent en cours",
    structureActive: "Structure active",
    blockReady: "Bloc prêt",
    weekStructured: "Semaine structurée",
    planningAligned: "Planification alignée",
  }),
});

function normalizeDayCount(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function formatContinuityDaysLabel(value) {
  const days = normalizeDayCount(value);
  if (days <= 1) return BEHAVIOR_FEEDBACK_COPY.continuity.continuityMaintained;
  return `${days} jours de suite`;
}
