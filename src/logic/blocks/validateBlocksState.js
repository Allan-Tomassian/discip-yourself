import { PAGE_BLOCKS } from "./registry";

export function validateBlocksState(data) {
  const issues = [];
  const ui = data && typeof data === "object" ? data.ui || {} : {};
  const blocksByPage = ui.blocksByPage;

  if (!blocksByPage || typeof blocksByPage !== "object") {
    issues.push("ui.blocksByPage missing or invalid");
  }

  for (const [pageId, ids] of Object.entries(PAGE_BLOCKS)) {
    const raw = blocksByPage && typeof blocksByPage === "object" ? blocksByPage[pageId] : null;
    if (!Array.isArray(raw)) {
      issues.push(`ui.blocksByPage.${pageId} missing`);
      continue;
    }
    const seen = new Set();
    for (const entry of raw) {
      const id = typeof entry === "string" ? entry : entry?.id;
      if (!id || !ids.includes(id)) {
        issues.push(`ui.blocksByPage.${pageId} unknown id`);
        continue;
      }
      if (seen.has(id)) issues.push(`ui.blocksByPage.${pageId} duplicate ${id}`);
      seen.add(id);
    }
    for (const id of ids) {
      if (!seen.has(id)) issues.push(`ui.blocksByPage.${pageId} missing ${id}`);
    }
  }

  return { ok: issues.length === 0, issues };
}
