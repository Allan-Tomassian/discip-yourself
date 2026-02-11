function isObjectLike(value) {
  return value !== null && typeof value === "object";
}

function isPlainObject(value) {
  if (!isObjectLike(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneValue(value) {
  if (!isObjectLike(value)) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through
    }
  }
  if (Array.isArray(value)) return value.map((item) => cloneValue(item));
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = cloneValue(item);
    return out;
  }
  return value;
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!isObjectLike(a) || !isObjectLike(b)) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let idx = 0; idx < a.length; idx += 1) {
      if (!deepEqual(a[idx], b[idx])) return false;
    }
    return true;
  }

  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function mergePatch(currentWorking, patch) {
  const base = cloneValue(currentWorking);
  const nextRaw = typeof patch === "function" ? patch(base) : patch;
  if (isPlainObject(base) && isPlainObject(nextRaw)) {
    return { ...base, ...nextRaw };
  }
  return cloneValue(nextRaw);
}

function getPathValue(obj, path) {
  if (!path || !isObjectLike(obj)) return undefined;
  const parts = String(path).split(".");
  let cursor = obj;
  for (const part of parts) {
    if (!isObjectLike(cursor) && !Array.isArray(cursor)) return undefined;
    cursor = cursor?.[part];
    if (cursor === undefined) return undefined;
  }
  return cursor;
}

function setPathValue(obj, path, value) {
  const parts = String(path).split(".");
  if (!parts.length) return obj;
  const root = isObjectLike(obj) ? cloneValue(obj) : {};
  let cursor = root;
  for (let idx = 0; idx < parts.length - 1; idx += 1) {
    const part = parts[idx];
    const nextPart = parts[idx + 1];
    const current = cursor?.[part];
    if (!isObjectLike(current)) {
      cursor[part] = /^\d+$/.test(nextPart) ? [] : {};
    } else {
      cursor[part] = cloneValue(current);
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = cloneValue(value);
  return root;
}

function topLevelDiff(snapshot, working) {
  const left = isPlainObject(snapshot) ? snapshot : {};
  const right = isPlainObject(working) ? working : {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const patch = {};
  const changedPaths = [];
  for (const key of keys) {
    if (!deepEqual(left[key], right[key])) {
      patch[key] = cloneValue(right[key]);
      changedPaths.push(key);
    }
  }
  return { changed: changedPaths.length > 0, patch, changedPaths };
}

export function computeDiff(snapshot, working, knownPaths = null) {
  if (Array.isArray(knownPaths) && knownPaths.length > 0) {
    let patch = isPlainObject(working) ? {} : cloneValue(working);
    const changedPaths = [];
    for (const path of knownPaths) {
      const left = getPathValue(snapshot, path);
      const right = getPathValue(working, path);
      if (!deepEqual(left, right)) {
        changedPaths.push(path);
        patch = setPathValue(patch, path, right);
      }
    }
    return { changed: changedPaths.length > 0, patch, changedPaths };
  }
  if (isPlainObject(snapshot) && isPlainObject(working)) {
    return topLevelDiff(snapshot, working);
  }
  return {
    changed: !deepEqual(snapshot, working),
    patch: cloneValue(working),
    changedPaths: !deepEqual(snapshot, working) ? ["$"] : [],
  };
}

function normalizeRisk(raw) {
  const value = String(raw || "medium").trim().toLowerCase();
  if (value === "safe" || value === "high") return value;
  return "medium";
}

export function createDraftStore(options = {}) {
  const singleActiveScope = options.singleActiveScope === true;
  let version = 0;
  let activeScopeKey = null;
  const listeners = new Set();
  const drafts = new Map();

  const notify = () => {
    version += 1;
    for (const listener of listeners) listener();
  };

  const getDraft = (scopeKey) => {
    if (!scopeKey) return null;
    return drafts.get(scopeKey) || null;
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const beginDraft = (scopeKey, initialSnapshot, beginOptions = {}) => {
    if (!scopeKey) return null;
    const existing = drafts.get(scopeKey) || null;
    if (existing && beginOptions.reset !== true) {
      activeScopeKey = scopeKey;
      notify();
      return existing;
    }

    if (singleActiveScope && activeScopeKey && activeScopeKey !== scopeKey) {
      drafts.delete(activeScopeKey);
    }

    const now = Date.now();
    const snapshot = cloneValue(initialSnapshot);
    const draft = {
      scopeKey,
      snapshot,
      working: cloneValue(snapshot),
      dirty: false,
      touched: false,
      lastCommittedAt: existing?.lastCommittedAt || null,
      startedAt: now,
      risk: normalizeRisk(beginOptions.risk || existing?.risk),
      meta: beginOptions.meta || existing?.meta || null,
    };

    drafts.set(scopeKey, draft);
    activeScopeKey = scopeKey;
    notify();
    return draft;
  };

  const patchDraft = (scopeKey, patch) => {
    if (!scopeKey || !drafts.has(scopeKey)) return null;
    const current = drafts.get(scopeKey);
    const working = mergePatch(current.working, patch);
    const next = {
      ...current,
      working,
      touched: true,
      dirty: !deepEqual(current.snapshot, working),
    };
    drafts.set(scopeKey, next);
    activeScopeKey = scopeKey;
    notify();
    return next;
  };

  const commitDraft = (scopeKey, commitOptions = {}) => {
    if (!scopeKey || !drafts.has(scopeKey)) return null;
    const current = drafts.get(scopeKey);
    const diff = computeDiff(current.snapshot, current.working, commitOptions.knownPaths || null);
    const now = Date.now();
    const next = {
      ...current,
      snapshot: cloneValue(current.working),
      dirty: false,
      touched: false,
      lastCommittedAt: now,
    };
    if (commitOptions.clear === true) {
      drafts.delete(scopeKey);
      if (activeScopeKey === scopeKey) activeScopeKey = null;
    } else {
      drafts.set(scopeKey, next);
      activeScopeKey = scopeKey;
    }
    notify();
    return { draft: next, diff, committedAt: now };
  };

  const cancelDraft = (scopeKey, cancelOptions = {}) => {
    if (!scopeKey || !drafts.has(scopeKey)) return null;
    const current = drafts.get(scopeKey);
    if (cancelOptions.clear === true) {
      drafts.delete(scopeKey);
      if (activeScopeKey === scopeKey) activeScopeKey = null;
      notify();
      return { ...current, canceled: true };
    }
    const next = {
      ...current,
      working: cloneValue(current.snapshot),
      dirty: false,
      touched: false,
    };
    drafts.set(scopeKey, next);
    activeScopeKey = scopeKey;
    notify();
    return next;
  };

  const clearDraft = (scopeKey) => {
    if (!scopeKey) return false;
    const existed = drafts.delete(scopeKey);
    if (activeScopeKey === scopeKey) activeScopeKey = null;
    if (existed) notify();
    return existed;
  };

  const clearAllDrafts = () => {
    if (!drafts.size) return;
    drafts.clear();
    activeScopeKey = null;
    notify();
  };

  const listDrafts = () => Array.from(drafts.values());
  const hasDirtyDrafts = (predicate = null) =>
    Array.from(drafts.values()).some((draft) => draft?.dirty && (typeof predicate === "function" ? predicate(draft) : true));

  return {
    subscribe,
    getVersion: () => version,
    getDraft,
    getActiveScopeKey: () => activeScopeKey,
    beginDraft,
    patchDraft,
    commitDraft,
    cancelDraft,
    clearDraft,
    clearAllDrafts,
    listDrafts,
    hasDirtyDrafts,
  };
}

