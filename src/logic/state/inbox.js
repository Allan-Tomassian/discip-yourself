export const SYSTEM_INBOX_ID = "sys_inbox";
export const DEFAULT_CATEGORY_ID = SYSTEM_INBOX_ID;

function normalizeInboxCategory(rawCat, index = 0) {
  const c = rawCat && typeof rawCat === "object" ? { ...rawCat } : {};
  if (!c.id) c.id = SYSTEM_INBOX_ID;
  if (c.id === SYSTEM_INBOX_ID) {
    c.name = "Général";
    c.system = true;
  }
  if (typeof c.name !== "string" || !c.name.trim()) c.name = `Catégorie ${index + 1}`;
  if (typeof c.color !== "string" || !c.color.trim()) c.color = "#7C3AED";
  if (typeof c.wallpaper !== "string") c.wallpaper = "";
  if (typeof c.whyText !== "string") c.whyText = "";
  if (typeof c.templateId !== "string" || !c.templateId.trim()) c.templateId = null;
  c.mainGoalId = typeof c.mainGoalId === "string" && c.mainGoalId.trim() ? c.mainGoalId : null;
  c.system = Boolean(c.system);
  if (typeof c.createdAt !== "string") c.createdAt = "";
  return c;
}

export function ensureSystemInboxCategory(state) {
  const next = state && typeof state === "object" ? { ...state } : {};
  const categories = Array.isArray(next.categories) ? next.categories : [];
  const existing = categories.find((cat) => cat && (cat.id === SYSTEM_INBOX_ID || cat.system)) || null;
  if (existing) return { state: { ...next, categories }, category: existing };
  const createdAt = new Date().toISOString();
  const inbox = normalizeInboxCategory(
    {
      id: SYSTEM_INBOX_ID,
      name: "Général",
      color: "#64748B",
      system: true,
      createdAt,
    },
    categories.length
  );
  return { state: { ...next, categories: [...categories, inbox] }, category: inbox };
}
