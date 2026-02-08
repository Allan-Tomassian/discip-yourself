import { ensureSystemInboxCategory } from "../logic/state/inbox";

export function getInboxId(state) {
  const list = Array.isArray(state?.categories) ? state.categories : [];
  const found = list.find(
    (c) =>
      c &&
      (c.id === "sys_inbox" ||
        c.isSystem === true ||
        c.isInbox === true ||
        c.system === true ||
        c.inbox === true)
  );
  if (found?.id) return found.id;
  try {
    const ensured = ensureSystemInboxCategory(state || {});
    if (ensured?.category?.id) return ensured.category.id;
  } catch {
    // ignore
  }
  return "sys_inbox";
}
