function normalizeRisk(raw) {
  const value = String(raw || "medium").trim().toLowerCase();
  if (value === "safe" || value === "high") return value;
  return "medium";
}

function isWorkingValid(validate, draft) {
  if (typeof validate !== "function") return true;
  return Boolean(validate(draft?.working, draft));
}

function commitScope({ store, scopeKey, knownPaths, onCommit, clearAfterCommit }) {
  const result = store.commitDraft(scopeKey, { knownPaths, clear: Boolean(clearAfterCommit) });
  if (!result) return { handled: false, action: "none", blocked: false };
  if (typeof onCommit === "function") onCommit(result);
  return { handled: true, action: "commit", blocked: false, result };
}

function cancelScope({ store, scopeKey, onCancel, clearAfterCancel }) {
  const result = store.cancelDraft(scopeKey, { clear: Boolean(clearAfterCancel) });
  if (!result) return { handled: false, action: "none", blocked: false };
  if (typeof onCancel === "function") onCancel(result);
  return { handled: true, action: "cancel", blocked: false, result };
}

export function shouldConfirmOnLeave({ risk, dirty }) {
  return Boolean(dirty) && normalizeRisk(risk) === "high";
}

export function onBeforeLeaveScope({
  store,
  scopeKey,
  risk = "medium",
  validate,
  knownPaths = null,
  onCommit,
  onCancel,
  confirmLeave,
  clearAfterCommit = true,
  clearAfterCancel = true,
}) {
  if (!store || !scopeKey) return { handled: false, action: "none", blocked: false };
  const draft = store.getDraft(scopeKey);
  if (!draft) return { handled: false, action: "none", blocked: false };
  if (!draft.dirty) {
    if (clearAfterCancel) store.clearDraft(scopeKey);
    return { handled: true, action: "none", blocked: false };
  }

  const normalizedRisk = normalizeRisk(risk || draft.risk);
  if (normalizedRisk === "safe") {
    return commitScope({ store, scopeKey, knownPaths, onCommit, clearAfterCommit });
  }

  if (normalizedRisk === "medium") {
    if (!isWorkingValid(validate, draft)) {
      return cancelScope({ store, scopeKey, onCancel, clearAfterCancel });
    }
    return commitScope({ store, scopeKey, knownPaths, onCommit, clearAfterCommit });
  }

  if (typeof confirmLeave !== "function") {
    return { handled: false, action: "confirm", blocked: true };
  }
  const decision = confirmLeave({ scopeKey, draft, risk: normalizedRisk });
  if (decision === "save") {
    if (!isWorkingValid(validate, draft)) {
      return { handled: false, action: "invalid", blocked: true };
    }
    return commitScope({ store, scopeKey, knownPaths, onCommit, clearAfterCommit });
  }
  if (decision === "discard") {
    return cancelScope({ store, scopeKey, onCancel, clearAfterCancel });
  }
  return { handled: false, action: "stay", blocked: true };
}

export function flushDraftScopes({
  store,
  scopeKeys,
  strategy = "medium",
  resolveRisk,
  resolveValidate,
  resolveKnownPaths,
  resolveOnCommit,
  resolveOnCancel,
  confirmLeave,
}) {
  if (!store || !Array.isArray(scopeKeys) || !scopeKeys.length) return [];
  const results = [];
  for (const scopeKey of scopeKeys) {
    const risk = typeof resolveRisk === "function" ? resolveRisk(scopeKey) : strategy;
    const validate = typeof resolveValidate === "function" ? resolveValidate(scopeKey) : null;
    const knownPaths = typeof resolveKnownPaths === "function" ? resolveKnownPaths(scopeKey) : null;
    const onCommit = typeof resolveOnCommit === "function" ? resolveOnCommit(scopeKey) : null;
    const onCancel = typeof resolveOnCancel === "function" ? resolveOnCancel(scopeKey) : null;
    const result = onBeforeLeaveScope({
      store,
      scopeKey,
      risk,
      validate,
      knownPaths,
      onCommit,
      onCancel,
      confirmLeave,
      clearAfterCommit: true,
      clearAfterCancel: true,
    });
    results.push({ scopeKey, ...result });
  }
  return results;
}

