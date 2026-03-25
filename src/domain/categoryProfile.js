const CATEGORY_PROFILES_VERSION = 1;
const SUBJECT_MAX_LENGTH = 120;
const MAIN_GOAL_MAX_LENGTH = 160;
const CURRENT_PRIORITY_MAX_LENGTH = 120;
const LIST_ITEM_MAX_LENGTH = 80;
const LIST_MAX_ITEMS = 5;
const NOTES_MAX_LENGTH = 500;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return typeof maxLength === "number" ? trimmed.slice(0, maxLength) : trimmed;
}

function normalizeList(values) {
  const list = Array.isArray(values) ? values : [];
  const output = [];
  const seen = new Set();

  for (const value of list) {
    const item = trimString(value, LIST_ITEM_MAX_LENGTH);
    if (!item) continue;
    const dedupeKey = item
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    output.push(item);
    if (output.length >= LIST_MAX_ITEMS) break;
  }

  return output;
}

function normalizeLevel(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 5 ? numeric : null;
}

function createEmptyCategoryProfile(categoryId = null) {
  return {
    categoryId: typeof categoryId === "string" && categoryId.trim() ? categoryId.trim() : null,
    subject: null,
    mainGoal: null,
    currentPriority: null,
    watchpoints: [],
    constraints: [],
    currentLevel: null,
    notes: null,
    updatedAt: null,
  };
}

function normalizeCategoryProfile(rawProfile, categoryId = null) {
  const source = isPlainObject(rawProfile) ? rawProfile : {};
  const resolvedCategoryId = trimString(source.categoryId, 200) || trimString(categoryId, 200) || null;

  return {
    categoryId: resolvedCategoryId,
    subject: trimString(source.subject, SUBJECT_MAX_LENGTH),
    mainGoal: trimString(source.mainGoal, MAIN_GOAL_MAX_LENGTH),
    currentPriority: trimString(source.currentPriority, CURRENT_PRIORITY_MAX_LENGTH),
    watchpoints: normalizeList(source.watchpoints),
    constraints: normalizeList(source.constraints),
    currentLevel: normalizeLevel(source.currentLevel),
    notes: trimString(source.notes, NOTES_MAX_LENGTH),
    updatedAt: trimString(source.updatedAt, 64),
  };
}

export function createEmptyCategoryProfilesState() {
  return {
    version: CATEGORY_PROFILES_VERSION,
    byCategoryId: {},
  };
}

export function hasMeaningfulCategoryProfile(profile) {
  const normalized = normalizeCategoryProfile(profile, profile?.categoryId || null);
  return Boolean(
    normalized.subject ||
      normalized.mainGoal ||
      normalized.currentPriority ||
      normalized.watchpoints.length ||
      normalized.constraints.length ||
      normalized.currentLevel != null ||
      normalized.notes
  );
}

export function normalizeCategoryProfilesV1(raw, categories) {
  const source = isPlainObject(raw) ? raw : {};
  const byCategoryId = isPlainObject(source.byCategoryId) ? source.byCategoryId : {};
  const allowedCategoryIds = Array.isArray(categories)
    ? new Set(categories.map((category) => trimString(category?.id, 200)).filter(Boolean))
    : null;
  const normalizedByCategoryId = {};

  for (const [key, rawProfile] of Object.entries(byCategoryId)) {
    const categoryId =
      trimString(rawProfile?.categoryId, 200) ||
      trimString(key, 200);
    if (!categoryId) continue;
    if (allowedCategoryIds && !allowedCategoryIds.has(categoryId)) continue;
    normalizedByCategoryId[categoryId] = normalizeCategoryProfile(rawProfile, categoryId);
  }

  return {
    version: CATEGORY_PROFILES_VERSION,
    byCategoryId: normalizedByCategoryId,
  };
}

export function getCategoryProfile(userData, categoryId) {
  const normalizedCategoryId = trimString(categoryId, 200);
  if (!normalizedCategoryId) return createEmptyCategoryProfile(null);
  const normalizedProfiles = normalizeCategoryProfilesV1(
    userData?.category_profiles_v1,
    userData?.categories
  );
  return normalizedProfiles.byCategoryId[normalizedCategoryId] || createEmptyCategoryProfile(normalizedCategoryId);
}

export function getCategoryProfileSummary(userData, categoryId) {
  const profile = getCategoryProfile(userData, categoryId);
  const categories = Array.isArray(userData?.categories) ? userData.categories : [];
  const category = categories.find((entry) => entry?.id === profile.categoryId) || null;

  return {
    categoryId: profile.categoryId,
    categoryLabel: category?.name || null,
    subject: profile.subject,
    mainGoal: profile.mainGoal,
    currentPriority: profile.currentPriority,
    watchpoints: profile.watchpoints,
    constraints: profile.constraints,
    currentLevel: profile.currentLevel,
    hasProfile: hasMeaningfulCategoryProfile(profile),
  };
}
