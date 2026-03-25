import { MICRO_ACTIONS_LIBRARY } from "../core/microActions/microActionsLibrary";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";

export const MICRO_ACTIONS_V1_ITEMS_COUNT = 3;
export const BASIC_MICRO_REROLL_LIMIT = 3;

const DEFAULT_CATEGORY_ID = "neutral";
const TODO_STATUS = "todo";
const DONE_STATUS = "done";

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function safeDateKey(value) {
  return normalizeLocalDateKey(value) || todayLocalKey();
}

function safeNowIso(nowIso) {
  const raw = asString(nowIso).trim();
  return raw || new Date().toISOString();
}

function toSearchToken(value) {
  return asString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hashString(value) {
  const str = asString(value);
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function toSafeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function resolvePoolCategoryKey(state, categoryId) {
  const safeState = asObject(state);
  const categories = Array.isArray(safeState.categories) ? safeState.categories : [];
  const currentCategory = categories.find((cat) => cat && cat.id === categoryId) || null;
  const token = `${toSearchToken(categoryId)} ${toSearchToken(currentCategory?.name)}`.trim();

  if (!token) return DEFAULT_CATEGORY_ID;

  if (/(business|travail|work|finance|vente|pro|prospect)/.test(token)) return "business";
  if (/(sante|health|sport|forme|fitness|wellness|run|course)/.test(token)) return "sante";
  if (/(planning|planification|organisation|organis|admin|agenda|study|etude)/.test(token)) return "planning";
  return DEFAULT_CATEGORY_ID;
}

function buildTemplatePool(state, categoryId) {
  const key = resolvePoolCategoryKey(state, categoryId);
  const library = Array.isArray(MICRO_ACTIONS_LIBRARY) ? MICRO_ACTIONS_LIBRARY : [];
  const byCategory = library.filter((item) => item && item.id && item.categoryId === key);
  if (byCategory.length) return byCategory;
  const neutral = library.filter((item) => item && item.id && item.categoryId === DEFAULT_CATEGORY_ID);
  if (neutral.length) return neutral;
  return library.filter((item) => item && item.id);
}

function normalizeStatus(value) {
  const status = asString(value).toLowerCase();
  if (status === DONE_STATUS) return DONE_STATUS;
  return TODO_STATUS;
}

function normalizeStoredItem(raw, fallbackCategoryId) {
  const item = asObject(raw);
  const id = asString(item.id).trim();
  if (!id) return null;
  const title = asString(item.title).trim();
  if (!title) return null;
  const status = normalizeStatus(item.status);
  return {
    id,
    title,
    subtitle: asString(item.subtitle).trim(),
    categoryId: asString(item.categoryId).trim() || fallbackCategoryId,
    status,
    createdAt: asString(item.createdAt).trim() || new Date().toISOString(),
    doneAt: status === DONE_STATUS ? asString(item.doneAt).trim() : "",
    templateId: asString(item.templateId).trim(),
    durationMin: toSafeInt(item.durationMin, 2) || 2,
  };
}

function buildMicroItem({ template, dateKey, categoryId, sequence, nowIso }) {
  const templateId = asString(template?.id).trim() || `micro_template_${sequence}`;
  const title = asString(template?.title).trim() || "Micro-action";
  return {
    id: `micro_${dateKey}_${sequence}_${templateId}`,
    title,
    subtitle: asString(template?.subtitle).trim(),
    categoryId,
    status: TODO_STATUS,
    createdAt: nowIso,
    doneAt: "",
    templateId,
    durationMin: toSafeInt(template?.durationMin, 2) || 2,
  };
}

function pickTemplate({ state, dateKey, categoryId, sequence, excludeTemplateIds = [] }) {
  const pool = buildTemplatePool(state, categoryId);
  if (!pool.length) {
    return {
      id: `fallback_${sequence}`,
      title: "Fais une action de moins de 2 minutes",
      subtitle: "Petit pas immédiat",
      durationMin: 2,
      categoryId: DEFAULT_CATEGORY_ID,
    };
  }

  const excluded = new Set((Array.isArray(excludeTemplateIds) ? excludeTemplateIds : []).map((value) => asString(value)));
  const available = pool.filter((item) => !excluded.has(asString(item.id)));
  const candidates = available.length ? available : pool;
  const seed = `${dateKey}|${categoryId}|${sequence}`;
  const ordered = candidates
    .slice()
    .sort((a, b) => {
      const scoreA = hashString(`${seed}|${asString(a?.id)}`);
      const scoreB = hashString(`${seed}|${asString(b?.id)}`);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return asString(a?.id).localeCompare(asString(b?.id));
    });

  const index = ordered.length ? sequence % ordered.length : 0;
  return ordered[index] || ordered[0] || candidates[0];
}

function normalizeStoredMicroActions(raw, fallbackDateKey, fallbackCategoryId) {
  const value = asObject(raw);
  const safeCategoryId = asString(value.categoryId).trim() || fallbackCategoryId;
  const uniqueIds = new Set();
  const items = [];
  const rawItems = Array.isArray(value.items) ? value.items : [];

  for (const candidate of rawItems) {
    const item = normalizeStoredItem(candidate, safeCategoryId);
    if (!item) continue;
    if (uniqueIds.has(item.id)) continue;
    uniqueIds.add(item.id);
    items.push(item);
    if (items.length >= MICRO_ACTIONS_V1_ITEMS_COUNT) break;
  }

  return {
    dateKey: safeDateKey(value.dateKey || fallbackDateKey),
    categoryId: safeCategoryId || fallbackCategoryId,
    items,
    rerollsUsed: toSafeInt(value.rerollsUsed, 0),
    rerollCredits: toSafeInt(value.rerollCredits, 0),
    sequence: toSafeInt(value.sequence, 0),
  };
}

function fillMissingItems({ state, microActions, nowIso }) {
  const nextItems = Array.isArray(microActions.items) ? [...microActions.items] : [];
  let nextSequence = toSafeInt(microActions.sequence, 0);

  while (nextItems.length < MICRO_ACTIONS_V1_ITEMS_COUNT) {
    const templateIds = nextItems.map((item) => asString(item.templateId)).filter(Boolean);
    const template = pickTemplate({
      state,
      dateKey: microActions.dateKey,
      categoryId: microActions.categoryId,
      sequence: nextSequence,
      excludeTemplateIds: templateIds,
    });
    const item = buildMicroItem({
      template,
      dateKey: microActions.dateKey,
      categoryId: microActions.categoryId,
      sequence: nextSequence,
      nowIso,
    });
    nextItems.push(item);
    nextSequence += 1;
  }

  return {
    ...microActions,
    items: nextItems.slice(0, MICRO_ACTIONS_V1_ITEMS_COUNT),
    sequence: nextSequence,
  };
}

function replaceInSlot({ state, microActions, slotIndex, nowIso }) {
  const safeIndex = Number(slotIndex);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= microActions.items.length) {
    return {
      microActions,
      replaced: false,
      replacedItem: null,
      nextItem: null,
    };
  }

  const replacedItem = microActions.items[safeIndex] || null;
  const otherTemplateIds = microActions.items
    .filter((_, index) => index !== safeIndex)
    .map((item) => asString(item?.templateId))
    .filter(Boolean);
  if (replacedItem?.templateId) otherTemplateIds.push(replacedItem.templateId);

  const template = pickTemplate({
    state,
    dateKey: microActions.dateKey,
    categoryId: microActions.categoryId,
    sequence: microActions.sequence,
    excludeTemplateIds: otherTemplateIds,
  });

  const nextItem = buildMicroItem({
    template,
    dateKey: microActions.dateKey,
    categoryId: microActions.categoryId,
    sequence: microActions.sequence,
    nowIso,
  });

  const nextItems = microActions.items.map((item, index) => (index === safeIndex ? nextItem : item));

  return {
    microActions: {
      ...microActions,
      items: nextItems,
      sequence: microActions.sequence + 1,
    },
    replaced: true,
    replacedItem,
    nextItem,
  };
}

function chooseDefaultRerollIndices(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const index = items.findIndex((item) => normalizeStatus(item?.status) !== DONE_STATUS);
  if (index >= 0) return [index];
  return [0];
}

function sanitizeRerollIndices(indices, itemCount) {
  const max = Number.isFinite(itemCount) ? Math.max(0, itemCount) : 0;
  const unique = new Set();
  for (const value of Array.isArray(indices) ? indices : []) {
    const idx = Number(value);
    if (!Number.isInteger(idx) || idx < 0 || idx >= max) continue;
    unique.add(idx);
  }
  return Array.from(unique.values()).sort((a, b) => a - b);
}

export function getDefaultMicroCategoryId(state) {
  const safeState = asObject(state);
  const categories = Array.isArray(safeState.categories)
    ? safeState.categories.filter((category) => category && category.id && !category.system && !category.isSystem)
    : [];
  const selected =
    asString(safeState.ui?.selectedCategoryByView?.today).trim() ||
    asString(safeState.ui?.selectedCategoryByView?.home).trim() ||
    asString(safeState.ui?.selectedCategoryId).trim();
  if (selected && categories.some((cat) => cat && cat.id === selected)) return selected;
  if (categories[0]?.id) return categories[0].id;

  return DEFAULT_CATEGORY_ID;
}

export function getMicroActionPoolByCategory(state, categoryId) {
  return buildTemplatePool(state, categoryId);
}

export function pickNextMicroAction(state, categoryId, excludeTemplateIds = [], options = {}) {
  const safeState = asObject(state);
  const dateKey = safeDateKey(options.dateKey);
  const sequence = toSafeInt(options.sequence, 0);
  return pickTemplate({
    state: safeState,
    dateKey,
    categoryId: asString(categoryId).trim() || getDefaultMicroCategoryId(safeState),
    sequence,
    excludeTemplateIds,
  });
}

export function ensureMicroActionsV1(state, dateKey, categoryId, options = {}) {
  const safeState = asObject(state);
  const safeUi = asObject(safeState.ui);
  const safeDate = safeDateKey(dateKey);
  const fallbackCategoryId = asString(categoryId).trim() || getDefaultMicroCategoryId(safeState);
  const nowIso = safeNowIso(options.nowIso);

  const existing = normalizeStoredMicroActions(safeUi.microActionsV1, safeDate, fallbackCategoryId);
  const isNewDay = existing.dateKey !== safeDate;
  const shouldResetOnCategoryChange = options.resetItemsOnCategoryChange !== false;
  const requestedCategory = asString(categoryId).trim() || existing.categoryId || fallbackCategoryId;
  const categoryChanged = requestedCategory && existing.categoryId !== requestedCategory;

  let next = {
    ...existing,
    dateKey: safeDate,
    categoryId: requestedCategory || fallbackCategoryId,
  };

  if (isNewDay) {
    next = {
      ...next,
      dateKey: safeDate,
      categoryId: requestedCategory || fallbackCategoryId,
      items: [],
      rerollsUsed: 0,
      rerollCredits: 0,
      sequence: 0,
    };
  } else if (categoryChanged && shouldResetOnCategoryChange) {
    next = {
      ...next,
      categoryId: requestedCategory || fallbackCategoryId,
      items: [],
      sequence: 0,
    };
  }

  next = fillMissingItems({ state: safeState, microActions: next, nowIso });
  return next;
}

export function replaceMicroAction(state, slotIndex, options = {}) {
  const safeState = asObject(state);
  const nowIso = safeNowIso(options.nowIso);
  const base = ensureMicroActionsV1(safeState, options.dateKey, options.categoryId, {
    nowIso,
    resetItemsOnCategoryChange: false,
  });
  return replaceInSlot({ state: safeState, microActions: base, slotIndex, nowIso });
}

export function completeMicroAction(state, slotIndex, options = {}) {
  const safeState = asObject(state);
  const nowIso = safeNowIso(options.nowIso);
  const base = ensureMicroActionsV1(safeState, options.dateKey, options.categoryId, {
    nowIso,
    resetItemsOnCategoryChange: false,
  });

  const safeIndex = Number(slotIndex);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= base.items.length) {
    return {
      microActions: base,
      doneItem: null,
      replaced: false,
      nextItem: null,
    };
  }

  const rawDone = base.items[safeIndex] || null;
  const doneItem = rawDone
    ? {
        ...rawDone,
        status: DONE_STATUS,
        doneAt: nowIso,
      }
    : null;

  const replacement = replaceInSlot({
    state: safeState,
    microActions: base,
    slotIndex: safeIndex,
    nowIso,
  });

  return {
    microActions: replacement.microActions,
    doneItem,
    replaced: replacement.replaced,
    nextItem: replacement.nextItem,
  };
}

export function rerollMicroActions(state, indices = [], options = {}) {
  const safeState = asObject(state);
  const nowIso = safeNowIso(options.nowIso);
  const base = ensureMicroActionsV1(safeState, options.dateKey, options.categoryId, {
    nowIso,
    resetItemsOnCategoryChange: false,
  });

  const selected = sanitizeRerollIndices(indices, base.items.length);
  const targets = selected.length ? selected : chooseDefaultRerollIndices(base.items);

  let working = base;
  const replacedItems = [];
  const replacedIndices = [];

  for (const index of targets) {
    const replaced = replaceInSlot({
      state: safeState,
      microActions: working,
      slotIndex: index,
      nowIso,
    });
    if (!replaced.replaced) continue;
    working = replaced.microActions;
    replacedItems.push(replaced.replacedItem);
    replacedIndices.push(index);
  }

  if (replacedIndices.length && options.incrementUsage !== false) {
    working = {
      ...working,
      rerollsUsed: toSafeInt(working.rerollsUsed, 0) + 1,
    };
  }

  return {
    microActions: working,
    replacedCount: replacedIndices.length,
    replacedIndices,
    replacedItems,
  };
}
