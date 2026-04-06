const DEFAULT_COACH_BEHAVIOR = Object.freeze({
  mode: "normal",
  overlays: [],
  horizon: "now",
  intensity: "soft",
});

const SIMPLE_GREETING_TERMS = new Set([
  "bonjour",
  "salut",
  "hello",
  "coucou",
  "bonsoir",
  "hey",
  "bonjour coach",
  "salut coach",
  "hello coach",
  "coucou coach",
]);

const AMBIGUOUS_RECENT_SUPPORT_TERMS = new Set([
  "oui",
  "non",
  "ok",
  "plutot",
  "les deux",
  "et demain",
  "du coup",
  "laquelle",
  "lequel",
]);

const RESET_TERMS = [
  "epuise",
  "epuisee",
  "je n en peux plus",
  "crame",
  "creve",
  "fatigue",
  "sature",
  "submerge",
  "brouillard",
  "decourage",
  "a bout",
];

const CLARITY_TERMS = [
  "organiser",
  "structurer",
  "clarifier",
  "prioriser",
  "choisir",
  "hesite",
  "je ne sais pas",
  "confus",
  "perdu",
  "quoi faire",
  "quelle option",
  "arbitrer",
];

const ACTION_TERMS = [
  "me concentrer",
  "concentrer",
  "procrastine",
  "demarrer",
  "commencer",
  "m y mettre",
  "executer",
  "bloque",
  "friction",
  "passer a l action",
];

const HONEST_AUDIT_TERMS = [
  "franchement",
  "honnete",
  "sans filtre",
  "ce qui ne va pas",
  "ce qui cloche",
  "analyse honnete",
  "audit honnete",
];

const PLAN_BUILDER_VERBS = ["organiser", "planifier", "structurer", "prevoir"];
const PLAN_BUILDER_SPANS = [
  "demain",
  "prochains jours",
  "deux prochains jours",
  "2 jours",
  "3 jours",
  "7 jours",
  "semaine",
  "week end",
  "weekend",
];

const CHOICE_NARROWING_TERMS = [
  "je ne sais pas laquelle",
  "je ne sais pas lequel",
  "quoi choisir",
  "hesite",
  "quelle option",
  "lequel choisir",
];

const PATTERN_TERMS = ["toujours", "encore", "routine", "habitude", "chaque fois", "tous les soirs", "tous les jours"];
const SHORT_PLAN_TERMS = ["demain", "prochains jours", "semaine", "week end", "weekend"];
const TODAY_TERMS = ["aujourd hui", "cet apres midi", "ce matin", "cet aprem"];
const NOW_TERMS = ["maintenant", "tout de suite", "dans l immediat", "ce soir"];
const EXPLICIT_HELP_TERMS = ["aide moi", "dis moi", "que dois je", "comment", "quoi faire"];

export function normalizeCoachBehaviorText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyPhrase(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function findLastRecentUserMessage(recentMessages) {
  const messages = Array.isArray(recentMessages) ? recentMessages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (entry?.role !== "user") continue;
    const normalized = normalizeCoachBehaviorText(entry.content);
    if (normalized) return normalized;
  }
  return "";
}

function isShortOrAmbiguousMessage(normalizedMessage) {
  if (!normalizedMessage) return false;
  if (AMBIGUOUS_RECENT_SUPPORT_TERMS.has(normalizedMessage)) return true;
  return normalizedMessage.split(" ").filter(Boolean).length <= 3;
}

function buildSignalText(message, recentMessages) {
  const normalizedMessage = normalizeCoachBehaviorText(message);
  if (!normalizedMessage) return "";
  if (!isShortOrAmbiguousMessage(normalizedMessage)) return normalizedMessage;
  const previousUserMessage = findLastRecentUserMessage(recentMessages);
  if (!previousUserMessage) return normalizedMessage;
  return `${normalizedMessage} ${previousUserMessage}`.trim();
}

export function isSimpleGreetingMessage(message) {
  const normalizedMessage = normalizeCoachBehaviorText(message);
  return SIMPLE_GREETING_TERMS.has(normalizedMessage);
}

function detectOverlays(signalText) {
  const overlays = [];
  const hasHonestAudit = hasAnyPhrase(signalText, HONEST_AUDIT_TERMS);
  const hasPlanBuilder =
    hasAnyPhrase(signalText, PLAN_BUILDER_VERBS) && hasAnyPhrase(signalText, PLAN_BUILDER_SPANS);
  const hasChoiceNarrowing =
    hasAnyPhrase(signalText, CHOICE_NARROWING_TERMS) || (signalText.includes(" entre ") && signalText.includes(" et "));

  if (hasHonestAudit) overlays.push("honest_audit");
  if (hasPlanBuilder) overlays.push("plan_builder");
  else if (hasChoiceNarrowing) overlays.push("choice_narrowing");
  return overlays;
}

function detectMode(signalText, overlays) {
  if (hasAnyPhrase(signalText, RESET_TERMS)) return "reset";
  if (hasAnyPhrase(signalText, CLARITY_TERMS)) return "clarity";
  if (hasAnyPhrase(signalText, ACTION_TERMS)) return "action";
  if (overlays.length > 0) return "clarity";
  return "normal";
}

function detectHorizon(signalText) {
  if (hasAnyPhrase(signalText, PATTERN_TERMS)) return "pattern";
  if (hasAnyPhrase(signalText, SHORT_PLAN_TERMS)) return "short_plan";
  if (hasAnyPhrase(signalText, TODAY_TERMS)) return "today";
  if (hasAnyPhrase(signalText, NOW_TERMS)) return "now";
  return "now";
}

function detectIntensity(signalText, mode, overlays) {
  if (overlays.includes("honest_audit")) return "direct";
  if (mode === "reset") return "soft";
  if (mode === "action" || mode === "clarity") return "standard";
  return hasAnyPhrase(signalText, EXPLICIT_HELP_TERMS) ? "standard" : "soft";
}

export function detectCoachBehavior({ message, recentMessages } = {}) {
  const signalText = buildSignalText(message, recentMessages);
  if (!signalText) return { ...DEFAULT_COACH_BEHAVIOR, overlays: [] };

  const overlays = detectOverlays(signalText);
  const mode = detectMode(signalText, overlays);
  const horizon = detectHorizon(signalText);
  const intensity = detectIntensity(signalText, mode, overlays);

  return {
    mode,
    overlays,
    horizon,
    intensity,
  };
}
