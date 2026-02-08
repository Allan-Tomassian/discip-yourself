import { toLocalDateKey } from "../../utils/dateKey";
import { isFinalOccurrenceStatus } from "../metrics";

let lastInvariantSig = "";
let lastMissingBoundsSig = "";
let lastActiveSessionSig = "";

function isDev() {
  return typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
}

export function assertStateInvariants(state) {
  if (!isDev()) return state;
  if (!state || typeof state !== "object") return state;

  const scheduleRules = Array.isArray(state.scheduleRules) ? state.scheduleRules : [];
  const occurrences = Array.isArray(state.occurrences) ? state.occurrences : [];
  const sessionHistory = Array.isArray(state.sessionHistory) ? state.sessionHistory : [];
  const activeSession =
    state.ui && typeof state.ui.activeSession === "object" ? state.ui.activeSession : null;

  const duplicates = [];
  if (scheduleRules.length) {
    const seen = new Set();
    const dupKeys = [];
    for (const rule of scheduleRules) {
      if (!rule || typeof rule !== "object") continue;
      const actionId = typeof rule.actionId === "string" ? rule.actionId : "";
      const sourceKey = typeof rule.sourceKey === "string" ? rule.sourceKey : "";
      if (!actionId || !sourceKey) continue;
      const key = `${actionId}::${sourceKey}`;
      if (seen.has(key)) dupKeys.push(key);
      else seen.add(key);
    }
    if (dupKeys.length) duplicates.push({ type: "scheduleRules", count: dupKeys.length, sample: dupKeys.slice(0, 5) });
  }

  if (occurrences.length) {
    const seen = new Set();
    const dupKeys = [];
    for (const occ of occurrences) {
      if (!occ || typeof occ !== "object") continue;
      const ruleId = typeof occ.scheduleRuleId === "string" ? occ.scheduleRuleId : "";
      const date = typeof occ.date === "string" ? occ.date : "";
      if (!ruleId || !date) continue;
      const key = `${ruleId}::${date}`;
      if (seen.has(key)) dupKeys.push(key);
      else seen.add(key);
    }
    if (dupKeys.length) duplicates.push({ type: "occurrences", count: dupKeys.length, sample: dupKeys.slice(0, 5) });
  }

  if (sessionHistory.length) {
    const seen = new Set();
    const dupKeys = [];
    for (const s of sessionHistory) {
      if (!s || typeof s !== "object") continue;
      const occId = typeof s.occurrenceId === "string" ? s.occurrenceId : "";
      if (!occId) continue;
      if (seen.has(occId)) dupKeys.push(occId);
      else seen.add(occId);
    }
    if (dupKeys.length) duplicates.push({ type: "sessionHistory", count: dupKeys.length, sample: dupKeys.slice(0, 5) });
  }

  if (duplicates.length) {
    const sig = JSON.stringify(duplicates);
    if (sig !== lastInvariantSig) {
      lastInvariantSig = sig;
      // eslint-disable-next-line no-console
      console.warn("[invariants] duplicate keys detected", duplicates);
    }
  }

  if (activeSession && typeof activeSession === "object") {
    const occurrenceId = typeof activeSession.occurrenceId === "string" ? activeSession.occurrenceId : "";
    if (!occurrenceId) {
      const sig = typeof activeSession.id === "string" ? activeSession.id : "activeSession";
      if (sig !== lastActiveSessionSig) {
        lastActiveSessionSig = sig;
        // eslint-disable-next-line no-console
        console.warn("[invariants] activeSession missing occurrenceId", { id: sig });
      }
    } else if (activeSession.status === "partial") {
      const occurrence = occurrences.find((occ) => occ && occ.id === occurrenceId) || null;
      if (occurrence && isFinalOccurrenceStatus(occurrence.status)) {
        const sig = `${occurrenceId}:${occurrence.status}`;
        if (sig !== lastActiveSessionSig) {
          lastActiveSessionSig = sig;
          // eslint-disable-next-line no-console
          console.warn("[invariants] activeSession references final occurrence", { occurrenceId, status: occurrence.status });
        }
      }
    }
  }

  if (occurrences.length) {
    const today = toLocalDateKey(new Date());
    const missing = [];
    for (const occ of occurrences) {
      if (!occ || typeof occ !== "object") continue;
      if (occ.status !== "planned") continue;
      if (typeof occ.date !== "string" || !occ.date) continue;
      if (today && occ.date >= today) continue;
      if (occ.endAt || occ.windowEndAt) continue;
      missing.push(occ.id || `${occ.goalId || ""}:${occ.date}`);
    }
    if (missing.length) {
      const sig = missing.join("|");
      if (sig !== lastMissingBoundsSig) {
        lastMissingBoundsSig = sig;
        // eslint-disable-next-line no-console
        console.warn("[invariants] missing bounds for planned past occurrences", {
          count: missing.length,
          sample: missing.slice(0, 5),
        });
      }
    }
  }

  return state;
}
