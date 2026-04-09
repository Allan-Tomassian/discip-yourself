function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function countMatches(text, signals) {
  if (!text) return 0;
  return signals.reduce((score, signal) => (text.includes(signal) ? score + 1 : score), 0);
}

const ACTION_PROTOCOL_TYPES = ["sport", "deep_work", "admin", "routine"];

const CATEGORY_SIGNALS = Object.freeze({
  sport: ["sport", "fitness", "gym", "cardio", "muscu", "workout", "training", "run", "course", "yoga"],
  deep_work: ["business", "travail", "work", "deep", "focus", "product", "dev", "code", "build", "design"],
  admin: ["admin", "ops", "inbox", "emails", "email", "docs", "documents", "paperwork", "finance", "factures"],
  routine: ["routine", "rituel", "habitude", "habitudes", "wellness", "bien etre", "self care", "lecture", "journal"],
});

const TITLE_SIGNALS = Object.freeze({
  sport: [
    "sport",
    "gym",
    "workout",
    "training",
    "run",
    "course",
    "upper body",
    "lower body",
    "muscu",
    "velo",
    "bike",
    "swim",
    "natation",
    "yoga",
    "pilates",
    "cardio",
    "stretch",
    "marche",
    "walk",
  ],
  deep_work: [
    "build",
    "ship",
    "deploy",
    "launch",
    "mvp",
    "code",
    "coder",
    "debug",
    "fix",
    "bug",
    "app",
    "feature",
    "spec",
    "architecture",
    "design",
    "write",
    "ecrire",
    "draft",
    "research",
    "recherche",
    "analysis",
    "analyse",
    "presentation",
    "deck",
    "pitch",
    "copy",
    "livrable",
    "onboarding",
    "product",
    "business",
    "projet",
  ],
  admin: [
    "mail",
    "email",
    "inbox",
    "appel",
    "call",
    "facture",
    "invoice",
    "document",
    "docs",
    "rdv",
    "rendez vous",
    "meeting",
    "calendar",
    "booking",
    "reservation",
    "organiser",
    "organisation",
    "tri",
    "paperwork",
    "contrat",
    "tax",
    "expense",
  ],
  routine: [
    "routine",
    "habit",
    "habitude",
    "lecture",
    "reading",
    "meditation",
    "meditation",
    "sleep",
    "sommeil",
    "journal",
    "breath",
    "respiration",
    "gratitude",
    "reset",
    "review",
    "revue",
  ],
});

export function resolveActionProtocolType({
  title = "",
  categoryName = "",
  isHabitLike = false,
} = {}) {
  const normalizedTitle = normalizeText(title);
  const normalizedCategory = normalizeText(categoryName);

  const scores = ACTION_PROTOCOL_TYPES.reduce((result, type) => {
    const categoryScore = countMatches(normalizedCategory, CATEGORY_SIGNALS[type]) * 3;
    const titleScore = countMatches(normalizedTitle, TITLE_SIGNALS[type]) * 2;
    result[type] = categoryScore + titleScore;
    return result;
  }, {});

  if (isHabitLike) scores.routine += 2;

  let bestType = "generic";
  let bestScore = 0;

  for (const type of ACTION_PROTOCOL_TYPES) {
    const score = scores[type];
    if (score > bestScore) {
      bestType = type;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestType : "generic";
}

function asSafeDuration(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function buildProtocolCopy(type, durationMinutes) {
  const safeDuration = asSafeDuration(durationMinutes);
  const isShortBlock = safeDuration > 0 && safeDuration <= 20;

  if (type === "sport") {
    return {
      why: "activer ton énergie et tenir le rythme",
      firstStep: safeDuration >= 45 ? "commence par 5 min d’échauffement" : "commence par 3 min d’échauffement",
      ifBlocked: "fais la version courte",
      successDefinition: "séance tenue ou version courte assumée",
    };
  }

  if (type === "deep_work") {
    return {
      why: "avancer sur un levier concret",
      firstStep: isShortBlock ? "ouvre la sous-partie la plus concrète" : "ouvre la première sous-partie précise",
      ifBlocked: "réduis le scope à un sous-livrable",
      successDefinition: "une avancée visible est produite",
    };
  }

  if (type === "admin") {
    return {
      why: "retirer une friction",
      firstStep: "attaque l’item le plus simple à clôturer",
      ifBlocked: isShortBlock ? "fais 10 min nettes" : "ferme un seul item jusqu’au bout",
      successDefinition: "la tâche est fermée ou la prochaine étape est envoyée",
    };
  }

  if (type === "routine") {
    return {
      why: "renforcer la régularité",
      firstStep: "lance la version minimum",
      ifBlocked: "réduis à 5 minutes",
      successDefinition: "le bloc est tenu sans rupture",
    };
  }

  return {
    why: "faire avancer ce qui compte",
    firstStep: "commence par le plus petit pas concret",
    ifBlocked: "réduis le bloc à une version minimale",
    successDefinition: "un progrès visible existe",
  };
}

export function deriveActionProtocol({
  title = "",
  categoryName = "",
  durationMinutes = 0,
  isHabitLike = false,
} = {}) {
  const type = resolveActionProtocolType({ title, categoryName, isHabitLike });
  return {
    type,
    ...buildProtocolCopy(type, durationMinutes),
  };
}

export function deriveTodayActionProtocolBrief({ protocol = null, mode = "ready" } = {}) {
  if (!protocol) return [];

  if (mode === "session") {
    return [
      { label: "Cap", text: protocol.why },
      { label: "Blocage", text: protocol.ifBlocked },
    ];
  }

  return [
    { label: "Cap", text: protocol.why },
    { label: "Départ", text: protocol.firstStep },
  ];
}
