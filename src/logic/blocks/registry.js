export const BLOCKS_SCHEMA_VERSION = 1;

export const PAGE_BLOCKS = {
  home: ["focus", "calendar", "micro", "notes"],
  pilotage: ["pilotage.categories", "pilotage.charge", "pilotage.discipline"],
  library: ["list"],
};

export function getDefaultBlockIds(pageId) {
  return PAGE_BLOCKS[pageId] ? [...PAGE_BLOCKS[pageId]] : [];
}

export function getDefaultBlocksByPage() {
  const out = {};
  for (const [pageId, ids] of Object.entries(PAGE_BLOCKS)) {
    out[pageId] = ids.map((id) => ({ id, enabled: true }));
  }
  return out;
}
