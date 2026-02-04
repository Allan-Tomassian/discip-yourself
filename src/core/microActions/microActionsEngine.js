import { MICRO_ACTIONS_LIBRARY } from "./microActionsLibrary";

const BUCKET_MS = 30 * 60 * 1000;

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function resolveCategoryKey(categoryId, categoryName) {
  const key = normalizeKey(categoryId);
  const nameKey = normalizeKey(categoryName);
  const source = key || nameKey;
  if (!source) return "general";
  if (source.includes("sante") || source.includes("health") || source.includes("sport")) return "sante";
  if (source.includes("business") || source.includes("travail") || source.includes("work") || source.includes("finance")) {
    return "business";
  }
  return source === "general" ? "general" : "general";
}

function safeNumber(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function hashString(value) {
  const str = String(value || "");
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededValue(seed, salt) {
  const rng = mulberry32(seed ^ hashString(salt));
  return rng();
}

function timeMatches(template, hourNow) {
  if (!template?.timeOfDay || !Number.isFinite(hourNow)) return 0;
  const h = hourNow;
  if (template.timeOfDay === "morning") return h >= 5 && h < 12 ? 1 : -1;
  if (template.timeOfDay === "afternoon") return h >= 12 && h < 18 ? 1 : -1;
  if (template.timeOfDay === "evening") return h >= 18 && h < 23 ? 1 : -1;
  return 0;
}

function computeScore(template, ctx) {
  let score = 0;
  const duration = safeNumber(template?.durationMin, 0);
  if (duration >= 2 && duration <= 5) score += 3;
  else if (duration <= 7) score += 1;
  else score -= 1;
  if (template?.categoryId === ctx.categoryKey) score += 2;
  score += timeMatches(template, ctx.hourNow);
  return score;
}

function buildRankMap(library, ctx, seed) {
  const map = new Map();
  for (const template of library) {
    if (!template?.id) continue;
    map.set(template.id, {
      score: computeScore(template, ctx),
      tie: seededValue(seed, template.id),
    });
  }
  return map;
}

function sortByRank(list, rankMap) {
  return list
    .slice()
    .sort((a, b) => {
      const ra = rankMap.get(a.id) || { score: 0, tie: 0 };
      const rb = rankMap.get(b.id) || { score: 0, tie: 0 };
      if (ra.score !== rb.score) return rb.score - ra.score;
      if (ra.tie !== rb.tie) return rb.tie - ra.tie;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
}

function getTemplateTags(template) {
  if (!template) return [];
  if (Array.isArray(template.tags) && template.tags.length) return template.tags;
  return [];
}

function appendRanked(list, limit, state, rankMap, options = {}) {
  const { relaxTags = false } = options;
  const ordered = sortByRank(list, rankMap);
  for (const item of ordered) {
    if (!item || !item.id) continue;
    if (state.used.has(item.id)) continue;
    if (state.seenIds.has(item.id)) continue;
    const tags = getTemplateTags(item);
    if (!relaxTags && tags.some((tag) => state.usedTags.has(tag))) continue;
    state.out.push(item);
    state.used.add(item.id);
    tags.forEach((tag) => state.usedTags.add(tag));
    if (state.out.length >= limit) break;
  }
}

export function getMicroActionsForToday(context = {}, limit = 3) {
  const safeLimit = Math.max(1, Number.isFinite(limit) ? limit : 3);
  const library = Array.isArray(context.library) ? context.library : MICRO_ACTIONS_LIBRARY;
  const nowMs = safeNumber(context.nowMs, Date.now());
  const bucket = Math.floor(nowMs / BUCKET_MS);
  const seedOffset = safeNumber(context.seedOffset, 0);
  const hourNow = safeNumber(context.hourNow, null);
  const categoryKey = resolveCategoryKey(context.categoryId, context.categoryName);
  const contextKey = [
    normalizeKey(context.categoryId),
    normalizeKey(context.categoryName),
    String(hourNow ?? ""),
  ].join("|");
  const seed = (hashString(contextKey) ^ (bucket + seedOffset)) >>> 0;
  const ctx = {
    categoryKey,
    hourNow,
  };
  const seenIds =
    context.seenIds instanceof Set
      ? context.seenIds
      : new Set(Array.isArray(context.seenIds) ? context.seenIds : []);
  const state = { out: [], used: new Set(), usedTags: new Set(), seenIds };
  const rankMap = buildRankMap(library, ctx, seed);

  const categoryCandidates = library.filter((t) => t && t.categoryId === categoryKey);
  const generalCandidates = library.filter((t) => t && t.categoryId === "general");
  const base = categoryCandidates.length ? categoryCandidates : generalCandidates;

  const clarityCandidates = base.filter((t) => {
    const tags = getTemplateTags(t);
    return tags.includes("clarify") || tags.includes("focus");
  });
  const prepCandidates = base.filter((t) => t.intent === "prep");
  const execCandidates = base.filter((t) => t.intent === "execute");

  appendRanked(clarityCandidates.length ? clarityCandidates : prepCandidates, 1, state, rankMap);
  appendRanked(prepCandidates, safeLimit, state, rankMap);
  appendRanked(execCandidates, safeLimit, state, rankMap);
  if (state.out.length < safeLimit) {
    appendRanked(base, safeLimit, state, rankMap, { relaxTags: true });
  }

  return state.out.slice(0, safeLimit);
}
