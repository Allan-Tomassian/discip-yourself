import { addDaysLocal, todayLocalKey } from "../../utils/datetime";

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function simplify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ");
}

function countMatches(text, patterns) {
  return patterns.reduce((count, pattern) => {
    if (pattern instanceof RegExp) {
      return count + (pattern.test(text) ? 1 : 0);
    }
    return count + (text.includes(pattern) ? 1 : 0);
  }, 0);
}

function countRegex(text, regex) {
  const matches = text.match(regex);
  return Array.isArray(matches) ? matches.length : 0;
}

function resolveExplicitDate(simplifiedText) {
  if (simplifiedText.includes("demain")) {
    return {
      dateKey: addDaysLocal(todayLocalKey(), 1),
      label: "Demain",
    };
  }
  if (simplifiedText.includes("aujourd hui") || simplifiedText.includes("aujourdhui") || simplifiedText.includes("ce soir")) {
    return {
      dateKey: todayLocalKey(),
      label: "Aujourd’hui",
    };
  }
  return null;
}

function resolveFallbackCoachRoute(signals, scores) {
  if (
    signals.cadenceHits > 0 ||
    signals.structuringHits > 0 ||
    signals.hasMultipleClauses ||
    scores.coach_structuring >= scores.coach_clarify + 2
  ) {
    return "coach_structuring";
  }
  return "coach_clarify";
}

function buildActionPreview({ normalizedText, signals, context }) {
  const explicitDate = resolveExplicitDate(signals.simplifiedText);
  const categoryId = typeof context?.categoryId === "string" ? context.categoryId : null;
  const categoryLabel = typeof context?.categoryLabel === "string" ? context.categoryLabel : "";

  return {
    kind: "action",
    title: normalizedText,
    categoryId,
    categoryLabel: categoryLabel || null,
    actionDraft: {
      title: normalizedText,
      categoryId,
      priority: "secondaire",
      repeat: "none",
      oneOffDate: explicitDate?.dateKey || "",
      timeMode: "NONE",
      startTime: "",
      durationMinutes: null,
      daysOfWeek: [],
      notes: "",
    },
    outcomeDraft: null,
    meta: {
      categoryLabel: categoryLabel || "",
      dateLabel: explicitDate?.label || "",
    },
  };
}

function buildGoalPreview({ normalizedText, context }) {
  const categoryId = typeof context?.categoryId === "string" ? context.categoryId : null;
  const categoryLabel = typeof context?.categoryLabel === "string" ? context.categoryLabel : "";

  return {
    kind: "goal",
    title: normalizedText,
    categoryId,
    categoryLabel: categoryLabel || null,
    actionDraft: null,
    outcomeDraft: {
      title: normalizedText,
      categoryId,
      priority: "secondaire",
      startDate: "",
      deadline: "",
      notes: "",
    },
    meta: {
      categoryLabel: categoryLabel || "",
      dateLabel: "",
    },
  };
}

function resolveDirectActionConfidence(signals, scores) {
  const explicitDate = resolveExplicitDate(signals.simplifiedText);
  const dominantEnough = scores.direct_action >= scores.direct_goal + 2;
  const simpleSingleIntent =
    !signals.hasMultipleClauses &&
    signals.structuringHits === 0 &&
    !signals.isShortVagueTopic &&
    !signals.lacksStrongVerb &&
    signals.wordCount >= 3 &&
    signals.wordCount <= 8;

  if (dominantEnough && simpleSingleIntent && signals.cadenceHits === 0 && explicitDate) {
    return "high";
  }

  if (scores.direct_action >= 4) {
    return "medium";
  }

  return "low";
}

function resolveDirectGoalConfidence(signals, scores) {
  const dominantEnough = scores.direct_goal >= scores.direct_action + 2;
  const simpleSingleIntent =
    !signals.hasMultipleClauses &&
    signals.structuringHits === 0 &&
    !signals.isShortVagueTopic &&
    signals.wordCount >= 3 &&
    signals.wordCount <= 8;

  if (dominantEnough && simpleSingleIntent && signals.cadenceHits === 0 && signals.nearTermHits === 0) {
    return "high";
  }

  if (scores.direct_goal >= 4) {
    return "medium";
  }

  return "low";
}

const ACTION_PATTERNS = [
  /\bappeler\b/,
  /\benvoyer\b/,
  /\bpreparer\b/,
  /\bfinaliser\b/,
  /\bfinir\b/,
  /\bcorriger\b/,
  /\bverifier\b/,
  /\bplanifier\b/,
  /\breserver\b/,
  /\bpayer\b/,
  /\blire\b/,
  /\becrire\b/,
  /\brevoir\b/,
  /\bfaire\b/,
];

const GOAL_PATTERNS = [
  /\blancer\b/,
  /\bdevelopper\b/,
  /\bconstruire\b/,
  /\batteindre\b/,
  /\bdeployer\b/,
  /\bouvrir\b/,
  /\bcreer\b/,
];

const STRUCTURING_PATTERNS = [
  "structurer",
  "organiser",
  "planifier mes semaines",
  "planifier mon trimestre",
  "mettre de l ordre",
  "remettre de l ordre",
  "prioriser",
  "cadence",
  "routine",
  "rythme",
];

const OUTCOME_OBJECT_PATTERNS = [
  "page d accueil",
  "offre",
  "business",
  "site",
  "projet",
  "lancement",
  "trimestre",
];

const VAGUE_TOPICS = new Set([
  "sport",
  "travail",
  "business",
  "sante",
  "perso",
  "projet",
  "objectif",
]);

function buildSignals(normalizedText) {
  const simplifiedText = simplify(normalizedText);
  const words = simplifiedText.split(" ").filter(Boolean);
  const wordCount = words.length;
  const actionHits = countMatches(simplifiedText, ACTION_PATTERNS);
  const goalHits = countMatches(simplifiedText, GOAL_PATTERNS);
  const structuringHits = countMatches(simplifiedText, STRUCTURING_PATTERNS);
  const connectorCount = countRegex(simplifiedText, /\bet\b|,|;|\bpuis\b/g);
  const cadenceHits = countMatches(simplifiedText, [
    "par semaine",
    "par jour",
    "par mois",
    "chaque jour",
    "chaque semaine",
    "quotidien",
    "hebdomadaire",
  ]);
  const nearTermHits = countMatches(simplifiedText, [
    "demain",
    "aujourd hui",
    "aujourdhui",
    "ce soir",
    "cette semaine",
  ]);
  const outcomeObjectHits = countMatches(simplifiedText, OUTCOME_OBJECT_PATTERNS);
  const hasMultipleClauses = connectorCount > 0;
  const strongVerbCount = actionHits + goalHits + structuringHits;
  const isShortVagueTopic = wordCount <= 2 && VAGUE_TOPICS.has(words.join(" "));
  const lacksStrongVerb = strongVerbCount === 0;

  return {
    simplifiedText,
    wordCount,
    actionHits,
    goalHits,
    structuringHits,
    connectorCount,
    cadenceHits,
    nearTermHits,
    outcomeObjectHits,
    hasMultipleClauses,
    isShortVagueTopic,
    lacksStrongVerb,
  };
}

export function buildUniversalCaptureCoachPrefill({ route, text }) {
  const normalizedText = normalizeWhitespace(text);
  if (route === "coach_structuring") {
    return `Aide-moi à structurer ce que je veux faire avancer à partir de cette intention : "${normalizedText}"`;
  }
  return `Aide-moi à clarifier cette intention et à en faire le prochain pas utile : "${normalizedText}"`;
}

export function resolveUniversalCaptureDecision(rawText, context = {}) {
  const normalizedText = normalizeWhitespace(rawText);
  const signals = buildSignals(normalizedText);

  const scores = {
    direct_action: 0,
    direct_goal: 0,
    coach_clarify: 0,
    coach_structuring: 0,
  };

  if (signals.structuringHits > 0) scores.coach_structuring += 4 + signals.structuringHits;
  if (signals.hasMultipleClauses && signals.wordCount >= 8) scores.coach_structuring += 4;
  if (signals.connectorCount >= 2) scores.coach_structuring += 2;

  if (signals.wordCount <= 2 && signals.lacksStrongVerb) scores.coach_clarify += 5;
  if (signals.isShortVagueTopic) scores.coach_clarify += 3;
  if (signals.wordCount <= 4 && signals.lacksStrongVerb && signals.cadenceHits === 0) scores.coach_clarify += 2;

  if (signals.actionHits > 0) scores.direct_action += 2 + signals.actionHits;
  if (signals.cadenceHits > 0) scores.direct_action += 3;
  if (signals.nearTermHits > 0) scores.direct_action += 2;
  if (!signals.hasMultipleClauses && signals.wordCount >= 3 && signals.wordCount <= 10) scores.direct_action += 1;

  if (signals.goalHits > 0) scores.direct_goal += 2 + signals.goalHits;
  if (signals.outcomeObjectHits > 0) scores.direct_goal += 2;
  if (signals.cadenceHits > 0 || signals.nearTermHits > 0) scores.direct_goal -= 2;

  const fallbackCoachRoute = resolveFallbackCoachRoute(signals, scores);

  if (scores.coach_structuring >= 5 && scores.coach_structuring >= scores.direct_action + 2) {
    return {
      route: "coach_structuring",
      normalizedText,
      confidence: "low",
      fallbackCoachRoute: "coach_structuring",
      preview: null,
      scores,
    };
  }

  if (scores.coach_clarify >= 5 && scores.coach_clarify >= Math.max(scores.direct_action, scores.direct_goal)) {
    return {
      route: "coach_clarify",
      normalizedText,
      confidence: "low",
      fallbackCoachRoute: "coach_clarify",
      preview: null,
      scores,
    };
  }

  const topDirectRoute = scores.direct_action >= scores.direct_goal ? "direct_action" : "direct_goal";
  const topDirectScore = Math.max(scores.direct_action, scores.direct_goal);
  const secondDirectScore = Math.min(scores.direct_action, scores.direct_goal);

  if (topDirectScore < 4) {
    return {
      route: fallbackCoachRoute,
      normalizedText,
      confidence: "low",
      fallbackCoachRoute,
      preview: null,
      scores,
    };
  }

  if (topDirectScore - secondDirectScore <= 1 && secondDirectScore >= 3) {
    return {
      route: topDirectRoute,
      normalizedText,
      confidence: "medium",
      fallbackCoachRoute,
      preview: null,
      scores,
    };
  }

  if (topDirectRoute === "direct_action") {
    const confidence = resolveDirectActionConfidence(signals, scores);
    return {
      route: "direct_action",
      normalizedText,
      confidence,
      fallbackCoachRoute,
      preview: confidence === "high" ? buildActionPreview({ normalizedText, signals, context }) : null,
      scores,
    };
  }

  const confidence = resolveDirectGoalConfidence(signals, scores);
  return {
    route: "direct_goal",
    normalizedText,
    confidence,
    fallbackCoachRoute,
    preview: confidence === "high" ? buildGoalPreview({ normalizedText, context }) : null,
    scores,
  };
}
