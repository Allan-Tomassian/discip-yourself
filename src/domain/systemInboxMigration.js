import { SYSTEM_INBOX_ID } from "../logic/state";
import { getVisibleCategories, isSystemCategoryId } from "./categoryVisibility";
import { resolveGoalType } from "./goalType";

const PILOTAGE_TOKEN_RE = /(organisation|organis|review|revue|retro|r[ée]trospective|priorit|agenda|planning|planification|clarifier|admin|bilan|journal|weekly|hebdo)/;
const CATEGORY_HINTS = Object.freeze({
  health: ["sante", "health", "sport", "fitness", "run", "course", "marche", "stretch", "etire"],
  business: ["business", "travail", "work", "vente", "client", "prospect", "pitch", "meeting", "appel", "email"],
  learning: ["apprentissage", "learning", "learn", "etud", "study", "lecture", "cours", "notes"],
  personal: ["personnel", "personal", "maison", "rangement", "famille", "message", "administratif perso"],
  finance: ["finance", "budget", "depense", "compta", "epargne", "revenu"],
  productivity: ["productivite", "productivity", "focus", "execution", "deep work"],
});

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCategoryTokens(category) {
  const base = normalizeText(category?.name);
  const tokens = new Set(base.split(/\s+/).filter(Boolean));
  if (tokens.has("sante")) CATEGORY_HINTS.health.forEach((token) => tokens.add(token));
  if (tokens.has("business")) CATEGORY_HINTS.business.forEach((token) => tokens.add(token));
  if (tokens.has("apprentissage")) CATEGORY_HINTS.learning.forEach((token) => tokens.add(token));
  if (tokens.has("personnel")) CATEGORY_HINTS.personal.forEach((token) => tokens.add(token));
  if (tokens.has("finance")) CATEGORY_HINTS.finance.forEach((token) => tokens.add(token));
  if (tokens.has("productivite")) CATEGORY_HINTS.productivity.forEach((token) => tokens.add(token));
  return tokens;
}

export function isSystemInboxGoal(goal, inboxId = SYSTEM_INBOX_ID) {
  return Boolean(goal?.id) && (goal?.categoryId === inboxId || isSystemCategoryId(goal?.categoryId));
}

export function classifySystemInboxGoal(goal, inboxId = SYSTEM_INBOX_ID) {
  if (!isSystemInboxGoal(goal, inboxId)) return "visible";
  const tokenSource = normalizeText(`${goal?.title || ""} ${goal?.templateId || ""} ${goal?.habitNotes || ""}`);
  if (resolveGoalType(goal) === "PROCESS" && PILOTAGE_TOKEN_RE.test(tokenSource)) {
    return "pilotage_ritual";
  }
  return "reclassify";
}

export function inferVisibleCategoryIdFromGoal(goal, categories, inboxId = SYSTEM_INBOX_ID) {
  if (!isSystemInboxGoal(goal, inboxId)) return null;
  if (classifySystemInboxGoal(goal, inboxId) !== "reclassify") return null;
  const visibleCategories = getVisibleCategories(categories);
  if (!visibleCategories.length) return null;
  const text = normalizeText(`${goal?.title || ""} ${goal?.habitNotes || ""} ${goal?.notes || ""}`);
  if (!text) return null;

  let bestId = null;
  let bestScore = 0;
  let tie = false;
  for (const category of visibleCategories) {
    const tokens = getCategoryTokens(category);
    let score = 0;
    tokens.forEach((token) => {
      if (token && text.includes(token)) score += 1;
    });
    if (score > bestScore) {
      bestId = category.id;
      bestScore = score;
      tie = false;
    } else if (score > 0 && score === bestScore) {
      tie = true;
    }
  }

  if (!bestId || bestScore === 0 || tie) return null;
  return bestId;
}

export function collectSystemInboxBuckets({ goals, categories, inboxId = SYSTEM_INBOX_ID } = {}) {
  const pilotageRituals = [];
  const reclassifyCandidates = [];
  for (const goal of Array.isArray(goals) ? goals : []) {
    if (!isSystemInboxGoal(goal, inboxId)) continue;
    if (classifySystemInboxGoal(goal, inboxId) === "pilotage_ritual") pilotageRituals.push(goal);
    else reclassifyCandidates.push(goal);
  }
  return {
    pilotageRituals,
    reclassifyCandidates: reclassifyCandidates.map((goal) => ({
      goal,
      inferredCategoryId: inferVisibleCategoryIdFromGoal(goal, categories, inboxId),
    })),
  };
}

export function autoReclassifySystemGoals(goals, categories, inboxId = SYSTEM_INBOX_ID) {
  let changed = false;
  const nextGoals = (Array.isArray(goals) ? goals : []).map((goal) => {
    const inferredCategoryId = inferVisibleCategoryIdFromGoal(goal, categories, inboxId);
    if (!inferredCategoryId || goal?.categoryId === inferredCategoryId) return goal;
    changed = true;
    return { ...goal, categoryId: inferredCategoryId };
  });
  return { goals: nextGoals, changed };
}
