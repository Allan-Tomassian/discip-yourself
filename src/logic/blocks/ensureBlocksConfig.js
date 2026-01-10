import { PAGE_BLOCKS, getDefaultBlocksByPage } from "./registry";

const coerceId = (entry) => {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && typeof entry.id === "string") return entry.id;
  return "";
};

export function ensureBlocksConfig(blocksByPage) {
  const defaults = getDefaultBlocksByPage();
  const base = blocksByPage && typeof blocksByPage === "object" ? blocksByPage : null;
  if (!base) return defaults;
  let changed = false;
  const next = { ...base };

  for (const [pageId, ids] of Object.entries(PAGE_BLOCKS)) {
    const raw = Array.isArray(base[pageId]) ? base[pageId] : null;
    if (!raw) {
      next[pageId] = defaults[pageId];
      changed = true;
      continue;
    }
    const seen = new Set();
    const sanitized = [];
    let pageChanged = false;

    for (const entry of raw) {
      const id = coerceId(entry);
      if (!id || !ids.includes(id) || seen.has(id)) {
        pageChanged = true;
        continue;
      }
      seen.add(id);
      if (entry && typeof entry === "object") {
        if (typeof entry.enabled === "boolean") {
          sanitized.push(entry);
        } else {
          pageChanged = true;
          sanitized.push({ ...entry, id, enabled: true });
        }
      } else {
        sanitized.push({ id, enabled: true });
        pageChanged = true;
      }
    }

    for (const id of ids) {
      if (!seen.has(id)) {
        sanitized.push({ id, enabled: true });
        pageChanged = true;
      }
    }

    if (pageChanged || sanitized.length !== raw.length) {
      next[pageId] = sanitized;
      changed = true;
    } else {
      next[pageId] = raw;
    }
  }

  // Ensure defaults exist if nothing was provided.
  for (const [pageId, configs] of Object.entries(defaults)) {
    if (!Array.isArray(next[pageId])) {
      next[pageId] = configs;
      changed = true;
    }
  }

  return changed ? next : base;
}
