function stableSerialize(value) {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(",")}}`;
}

function fnv1aHash(input) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function pickHashRelevantSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return {
    version: snapshot.version,
    dayKey: snapshot.dayKey,
    activeCategoryId: snapshot.activeCategoryId || null,
    primaryGoal: snapshot.primaryGoal || null,
    whyText: snapshot.whyText || "",
    primaryAction: snapshot.primaryAction || null,
    occurrences: snapshot.occurrences || [],
    sessionHistory: snapshot.sessionHistory || [],
    activeSession: snapshot.activeSession || null,
    systemSignals: snapshot.systemSignals || [],
    deterministicActions: (snapshot.deterministicActions || []).map((action) => ({
      id: action.id,
      type: action.type,
      targetType: action.targetType,
      targetId: action.targetId,
      supportStatus: action.supportStatus,
      confirmationRequired: action.confirmationRequired,
      deterministicAction: action.deterministicAction,
    })),
    dataLimitations: snapshot.dataLimitations || [],
  };
}

export function buildDayAnalysisSnapshotHash(snapshot) {
  return `dah_${fnv1aHash(stableSerialize(pickHashRelevantSnapshot(snapshot)))}`;
}

export function buildDayAnalysisCacheKey({ userId = "anonymous", snapshot } = {}) {
  const dayKey = snapshot?.dayKey || "unknown-day";
  return `day-analysis:v1:${userId || "anonymous"}:${dayKey}:${buildDayAnalysisSnapshotHash(snapshot)}`;
}

export { stableSerialize as stableDayAnalysisSerialize };
