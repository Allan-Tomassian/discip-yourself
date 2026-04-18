export const MANUAL_AI_LOADING_STAGES = Object.freeze({
  default: [
    "Analyse du contexte",
    "Lecture des signaux utiles",
    "Recherche de la meilleure action",
    "Finalisation de la recommandation",
  ],
  today: [
    "Analyse du contexte",
    "Analyse de la catégorie",
    "Recherche d’action pertinente",
    "Vérification cohérence planning",
  ],
  planning: [
    "Analyse du contexte",
    "Lecture du planning",
    "Recherche d’ajustement prioritaire",
    "Vérification cohérence planning",
  ],
  objectives: [
    "Analyse des objectifs",
    "Lecture des tensions utiles",
    "Recherche du meilleur arbitrage",
    "Formulation du recentrage",
  ],
  pilotage: [
    "Analyse du contexte",
    "Lecture des métriques",
    "Recherche du signal principal",
    "Formulation de la recommandation",
  ],
  coach: [
    "Analyse du contexte",
    "Lecture des catégories",
    "Recherche suggestion utile",
    "Formulation réponse",
  ],
});

export function getManualAiLoadingStages(surface) {
  const key = typeof surface === "string" ? surface.trim().toLowerCase() : "";
  return MANUAL_AI_LOADING_STAGES[key] || MANUAL_AI_LOADING_STAGES.default;
}
