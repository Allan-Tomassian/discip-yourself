export const FIRST_RUN_WHY_INSPIRATION_CHIPS = Object.freeze([
  { id: "project", label: "Projet", prompt: "Je veux lancer ou finir un projet important." },
  { id: "sport", label: "Sport", prompt: "Je veux reprendre une routine sportive réaliste." },
  { id: "bad-habit", label: "Mauvaise habitude", prompt: "Je veux sortir d’une mauvaise habitude qui me freine." },
  { id: "energy", label: "Énergie", prompt: "Je veux retrouver de l’énergie et un rythme plus stable." },
  { id: "discipline", label: "Discipline", prompt: "Je veux stabiliser une discipline qui tient dans le temps." },
  { id: "career", label: "Carrière", prompt: "Je veux avancer dans ma carrière avec plus de constance." },
  { id: "skill", label: "Compétence", prompt: "Je veux apprendre une compétence et pratiquer régulièrement." },
  { id: "product", label: "Produit", prompt: "Je veux créer un produit concret et le terminer." },
  { id: "organization", label: "Organisation", prompt: "Je veux organiser ma vie personnelle et reprendre le contrôle." },
]);

const WHY_CLARIFY_MIN_LENGTH = 28;

function trimString(value, maxLength = 1200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function getFirstRunWhyAiMode(value) {
  return trimString(value, 1200).length >= WHY_CLARIFY_MIN_LENGTH ? "clarify" : "inspiration";
}

export function getFirstRunWhyAiCta(value) {
  return getFirstRunWhyAiMode(value) === "clarify" ? "Clarifier avec l’IA" : "M’aider à formuler";
}

export function resolveFirstRunWhySuggestionText(response) {
  const clarification = response?.clarification || {};
  const clarifiedWhy = trimString(clarification.clarifiedWhy, 700);
  if (clarifiedWhy) return clarifiedWhy;
  const firstDraft = Array.isArray(response?.drafts) ? response.drafts.find((draft) => trimString(draft?.whyText, 700)) : null;
  return trimString(firstDraft?.whyText, 700);
}
