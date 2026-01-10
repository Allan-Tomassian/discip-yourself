import { PAGE_BLOCKS, getDefaultBlocksByPage } from "./registry";

const coerceId = (entry) => {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && typeof entry.id === "string") return entry.id;
  return "";
};

export function ensureBlocksConfig(blocksByPage) {
  const defaults = getDefaultBlocksByPage();
  const base = blocksByPage && typeof blocksByPage === "object" ? blocksByPage : {};
  const next = { ...base };

  for (const [pageId, ids] of Object.entries(PAGE_BLOCKS)) {
    const raw = Array.isArray(base[pageId]) ? base[pageId] : [];
    const seen = new Set();
    const sanitized = [];

    for (const entry of raw) {
      const id = coerceId(entry);
      if (!id || !ids.includes(id) || seen.has(id)) continue;
      seen.add(id);
      if (entry && typeof entry === "object") {
        sanitized.push({ ...entry, id, enabled: entry.enabled !== false });
      } else {
        sanitized.push({ id, enabled: true });
      }
    }

    for (const id of ids) {
      if (!seen.has(id)) sanitized.push({ id, enabled: true });
    }

    next[pageId] = sanitized;
  }

  // Ensure defaults exist if nothing was provided.
  for (const [pageId, configs] of Object.entries(defaults)) {
    if (!Array.isArray(next[pageId])) next[pageId] = configs;
  }

  return next;
}
