import { SYSTEM_INBOX_ID } from "./state";

export function canCreate({ activeCategoryId, categories } = {}) {
  const list = Array.isArray(categories) ? categories : [];
  const activeId = typeof activeCategoryId === "string" ? activeCategoryId.trim() : "";
  if (!activeId) return false;
  const exists = list.some((c) => c && c.id === activeId);
  if (!exists) return false;
  if (activeId !== SYSTEM_INBOX_ID) return true;
  const hasNonSystem = list.some((c) => c && c.id !== SYSTEM_INBOX_ID);
  return !hasNonSystem;
}
