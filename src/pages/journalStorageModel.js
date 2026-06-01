function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildJournalStorageScope(userId) {
  const normalizedUserId = safeString(userId);
  return normalizedUserId ? `user:${normalizedUserId}` : "anonymous";
}

export function buildJournalStorageModel({ userId = "", categoryId = "", dateKey = "" } = {}) {
  const scope = buildJournalStorageScope(userId);
  const safeCategoryId = safeString(categoryId);
  const safeDateKey = safeString(dateKey);
  const noteKeyPrefix = safeCategoryId ? `dailyNote:${scope}:${safeCategoryId}:` : `dailyNote:${scope}:`;
  const noteMetaKeyPrefix = safeCategoryId
    ? `dailyNoteMeta:${scope}:${safeCategoryId}:`
    : `dailyNoteMeta:${scope}:`;
  const noteHistoryStorageKey = safeCategoryId
    ? `dailyNoteHistory:${scope}:${safeCategoryId}`
    : `dailyNoteHistory:${scope}`;

  return {
    scope,
    noteKeyPrefix,
    noteMetaKeyPrefix,
    noteStorageKey: `${noteKeyPrefix}${safeDateKey}`,
    noteMetaStorageKey: `${noteMetaKeyPrefix}${safeDateKey}`,
    noteHistoryStorageKey,
  };
}

function listStorageKeys(storage) {
  if (!storage) return [];
  if (Number.isInteger(storage.length) && typeof storage.key === "function") {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (typeof key === "string") keys.push(key);
    }
    return keys;
  }
  return Object.keys(storage).filter((key) => typeof storage.getItem !== "function" || storage.getItem(key) !== null);
}

export function clearJournalStorageForUser({
  userId = "",
  localStorageRef = typeof window !== "undefined" ? window.localStorage : null,
} = {}) {
  const scope = buildJournalStorageScope(userId);
  const prefixes = [`dailyNote:${scope}:`, `dailyNoteMeta:${scope}:`, `dailyNoteHistory:${scope}`];
  const removed = [];
  for (const key of listStorageKeys(localStorageRef)) {
    if (!prefixes.some((prefix) => key.startsWith(prefix))) continue;
    try {
      localStorageRef.removeItem(key);
      removed.push(key);
    } catch {
      // Best-effort cleanup only.
    }
  }
  return removed;
}
