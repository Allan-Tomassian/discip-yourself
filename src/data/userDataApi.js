import { supabase } from "../infra/supabaseClient";
import { E2E_AUTH_SESSION_KEY } from "../auth/constants";
import {
  hasMeaningfulFirstRunState,
  isFirstRunDone,
  normalizeFirstRunV1,
} from "../features/first-run/firstRunModel";
import { canUseLocalPersistenceFallback, mapUserDataPersistenceError } from "../infra/supabasePersistenceErrors";

const LOCAL_USER_DATA_PREFIX = "e2e.supabase.user_data.";
export const USER_DATA_STORAGE_SCOPE = Object.freeze({
  CLOUD: "cloud",
  LOCAL_FALLBACK: "local_fallback",
});

function safeParse(raw) {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasObjectKeys(value) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

const CLOUD_SAFE_ACTIVE_SESSION_KEYS = Object.freeze([
  "id",
  "occurrenceId",
  "objectiveId",
  "habitIds",
  "dateKey",
  "date",
  "runtimePhase",
  "status",
  "timerRunning",
  "timerStartedAt",
  "timerAccumulatedSec",
  "isOpen",
]);

function normalizeDateKey(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function normalizeActiveSessionDateKey(session) {
  if (!isPlainObject(session)) return "";
  return normalizeDateKey(session.dateKey || session.date);
}

function isOpenRuntimeSession(session) {
  if (!isPlainObject(session)) return false;
  const runtimePhase = String(session.runtimePhase || "").trim();
  const status = String(session.status || "").trim();
  return (
    runtimePhase === "in_progress" ||
    runtimePhase === "paused" ||
    (status === "partial" &&
      runtimePhase !== "done" &&
      runtimePhase !== "canceled" &&
      runtimePhase !== "blocked" &&
      runtimePhase !== "reported")
  );
}

function hasGuidedRuntimeSnapshot(session) {
  return isPlainObject(session) && (session.experienceMode === "guided" || isPlainObject(session.guidedRuntimeV1));
}

function areActiveSessionsCompatibleForGuidedRuntime(remoteSession, localSession) {
  if (!isOpenRuntimeSession(remoteSession) || !isOpenRuntimeSession(localSession) || !hasGuidedRuntimeSnapshot(localSession)) {
    return false;
  }

  const remoteId = String(remoteSession.id || "").trim();
  const localId = String(localSession.id || "").trim();
  const remoteOccurrenceId = String(remoteSession.occurrenceId || "").trim();
  const localOccurrenceId = String(localSession.occurrenceId || "").trim();
  const sameId = remoteId && localId && remoteId === localId;
  const sameOccurrenceId = remoteOccurrenceId && localOccurrenceId && remoteOccurrenceId === localOccurrenceId;

  if (!sameId && !sameOccurrenceId) return false;

  const remoteDateKey = normalizeActiveSessionDateKey(remoteSession);
  const localDateKey = normalizeActiveSessionDateKey(localSession);
  if (remoteDateKey && localDateKey && remoteDateKey !== localDateKey) return false;

  return true;
}

function shouldUseLocalOpenGuidedSession(remoteSession, localSession) {
  return !isOpenRuntimeSession(remoteSession) && isOpenRuntimeSession(localSession) && hasGuidedRuntimeSnapshot(localSession);
}

function shouldUseLocalFirstRunState(remoteUi, localUi) {
  const safeRemoteUi = isPlainObject(remoteUi) ? remoteUi : {};
  const safeLocalUi = isPlainObject(localUi) ? localUi : {};
  const remoteFirstRun = isPlainObject(safeRemoteUi.firstRunV1) ? safeRemoteUi.firstRunV1 : null;
  const localFirstRun = isPlainObject(safeLocalUi.firstRunV1) ? safeLocalUi.firstRunV1 : null;
  const remoteDone = isFirstRunDone(safeRemoteUi);
  const localDone = isFirstRunDone(safeLocalUi);
  const remoteMeaningful = hasMeaningfulFirstRunState(remoteFirstRun);
  const localMeaningful = hasMeaningfulFirstRunState(localFirstRun);

  if (localDone && !remoteDone) return true;
  if (localMeaningful && !remoteMeaningful) return true;
  if (!localMeaningful || !remoteMeaningful) return false;

  const remoteUpdatedAt = normalizeFirstRunV1(remoteFirstRun).lastUpdatedAt || "";
  const localUpdatedAt = normalizeFirstRunV1(localFirstRun).lastUpdatedAt || "";
  if (!localUpdatedAt) return false;
  if (!remoteUpdatedAt) return true;
  return localUpdatedAt > remoteUpdatedAt;
}

function sanitizeActiveSessionForCloud(activeSession) {
  const source = isPlainObject(activeSession) ? activeSession : null;
  if (!source) return null;
  const next = {};
  CLOUD_SAFE_ACTIVE_SESSION_KEYS.forEach((key) => {
    if (key in source) next[key] = source[key];
  });
  return hasObjectKeys(next) ? next : null;
}

export function sanitizeUserDataForCloudSync(data) {
  const source = isPlainObject(data) ? data : {};
  const sourceUi = isPlainObject(source.ui) ? source.ui : null;
  const nextActiveSession = sanitizeActiveSessionForCloud(sourceUi?.activeSession);

  if (!sourceUi) return source;

  const { sessionPremiumPrepareCacheV1: _sessionPremiumPrepareCacheV1, ...safeUi } = sourceUi;
  const nextUi = { ...safeUi, activeSession: nextActiveSession };
  return {
    ...source,
    ui: nextUi,
  };
}

export function rehydrateUserDataWithLocalGuidedRuntime({ data, localData } = {}) {
  const remoteData = isPlainObject(data) ? data : {};
  const localSnapshot = isPlainObject(localData) ? localData : {};
  const remoteUi = isPlainObject(remoteData.ui) ? remoteData.ui : null;
  const localUi = isPlainObject(localSnapshot.ui) ? localSnapshot.ui : null;
  const remoteActiveSession = isPlainObject(remoteUi?.activeSession) ? remoteUi.activeSession : null;
  const localActiveSession = isPlainObject(localUi?.activeSession) ? localUi.activeSession : null;
  const localPremiumPrepareCache = isPlainObject(localUi?.sessionPremiumPrepareCacheV1)
    ? localUi.sessionPremiumPrepareCacheV1
    : null;

  if (shouldUseLocalOpenGuidedSession(remoteActiveSession, localActiveSession)) {
    return {
      ...remoteData,
      ui: {
        ...(remoteUi || {}),
        activeSession: { ...localActiveSession },
        ...(localPremiumPrepareCache ? { sessionPremiumPrepareCacheV1: localPremiumPrepareCache } : {}),
      },
    };
  }

  if (shouldUseLocalFirstRunState(remoteUi, localUi)) {
    return {
      ...remoteData,
      ui: {
        ...(remoteUi || {}),
        ...(isPlainObject(localUi?.firstRunV1) ? { firstRunV1: localUi.firstRunV1 } : {}),
        onboardingCompleted: localUi?.onboardingCompleted === true,
        ...(localPremiumPrepareCache ? { sessionPremiumPrepareCacheV1: localPremiumPrepareCache } : {}),
      },
    };
  }

  if (!areActiveSessionsCompatibleForGuidedRuntime(remoteActiveSession, localActiveSession)) {
    if (!localPremiumPrepareCache) return remoteData;
    return {
      ...remoteData,
      ui: {
        ...(remoteUi || {}),
        sessionPremiumPrepareCacheV1: localPremiumPrepareCache,
      },
    };
  }

  const nextActiveSession = { ...remoteActiveSession };
  if (localActiveSession.experienceMode === "guided") {
    nextActiveSession.experienceMode = "guided";
  }
  if (isPlainObject(localActiveSession.guidedRuntimeV1)) {
    nextActiveSession.guidedRuntimeV1 = localActiveSession.guidedRuntimeV1;
  }

  return {
    ...remoteData,
    ui: {
      ...(remoteUi || {}),
      activeSession: nextActiveSession,
      ...(localPremiumPrepareCache ? { sessionPremiumPrepareCacheV1: localPremiumPrepareCache } : {}),
    },
  };
}

function isUsingE2EMockedSession(userId) {
  if (!userId || typeof window === "undefined") return false;
  if (!import.meta.env.DEV) return false;
  try {
    const raw = window.localStorage.getItem(E2E_AUTH_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.user?.id === userId;
  } catch {
    return false;
  }
}

export function buildLocalUserDataKey(userId) {
  return `${LOCAL_USER_DATA_PREFIX}${String(userId || "")}`;
}

export const isRemoteUserDataEnabled = Boolean(supabase);

function loadLocalUserData(userId) {
  if (typeof window === "undefined") return {};
  return safeParse(window.localStorage.getItem(buildLocalUserDataKey(userId)));
}

function saveLocalUserData(userId, data) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildLocalUserDataKey(userId), JSON.stringify(data || {}));
}

export async function loadUserData(userId) {
  const result = await loadUserDataWithMeta(userId);
  return result.data;
}

export async function loadUserDataWithMeta(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return {
      data: {},
      storageScope: USER_DATA_STORAGE_SCOPE.LOCAL_FALLBACK,
    };
  }

  if (isUsingE2EMockedSession(normalizedUserId)) {
    return {
      data: loadLocalUserData(normalizedUserId),
      storageScope: USER_DATA_STORAGE_SCOPE.LOCAL_FALLBACK,
    };
  }

  const localSnapshot = loadLocalUserData(normalizedUserId);

  if (!supabase) {
    return {
      data: localSnapshot,
      storageScope: USER_DATA_STORAGE_SCOPE.LOCAL_FALLBACK,
    };
  }

  const { data, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (error) {
    const mappedError = mapUserDataPersistenceError(error);
    if (canUseLocalPersistenceFallback(mappedError)) {
      return {
        data: localSnapshot,
        storageScope: USER_DATA_STORAGE_SCOPE.LOCAL_FALLBACK,
      };
    }
    throw mappedError;
  }
  const payload = data?.data;
  const safePayload = payload && typeof payload === "object" ? payload : {};
  if (!hasObjectKeys(safePayload)) {
    if (hasObjectKeys(localSnapshot)) {
      return {
        data: localSnapshot,
        storageScope: USER_DATA_STORAGE_SCOPE.LOCAL_FALLBACK,
      };
    }
  }
  const hydratedPayload = rehydrateUserDataWithLocalGuidedRuntime({
    data: safePayload,
    localData: localSnapshot,
  });
  saveLocalUserData(normalizedUserId, hydratedPayload);
  return {
    data: hydratedPayload,
    storageScope: USER_DATA_STORAGE_SCOPE.CLOUD,
  };
}

export async function upsertUserData(userId, data) {
  const result = await upsertUserDataWithMeta(userId, data);
  if (result.error) throw result.error;
  return result.data;
}

export async function upsertUserDataWithMeta(userId, data) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("userId requis");
  const payload = data && typeof data === "object" ? data : {};
  const remotePayload = sanitizeUserDataForCloudSync(payload);

  if (isUsingE2EMockedSession(normalizedUserId)) {
    saveLocalUserData(normalizedUserId, payload);
    return {
      data: payload,
      storageScope: USER_DATA_STORAGE_SCOPE.LOCAL_FALLBACK,
      error: null,
    };
  }

  if (!supabase) {
    saveLocalUserData(normalizedUserId, payload);
    return {
      data: payload,
      storageScope: USER_DATA_STORAGE_SCOPE.LOCAL_FALLBACK,
      error: null,
    };
  }

  const { error } = await supabase
    .from("user_data")
    .upsert(
      {
        user_id: normalizedUserId,
        data: remotePayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    const mappedError = mapUserDataPersistenceError(error);
    if (canUseLocalPersistenceFallback(mappedError)) {
      saveLocalUserData(normalizedUserId, payload);
      return {
        data: payload,
        storageScope: USER_DATA_STORAGE_SCOPE.LOCAL_FALLBACK,
        error: mappedError,
      };
    }
    throw mappedError;
  }
  saveLocalUserData(normalizedUserId, payload);
  return {
    data: payload,
    storageScope: USER_DATA_STORAGE_SCOPE.CLOUD,
    error: null,
  };
}
