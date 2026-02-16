import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { E2E_AUTH_SESSION_KEY } from "../auth/constants";
import { migrate, initialData } from "../logic/state";
import { loadState, saveState } from "../utils/storage";
import { isRemoteUserDataEnabled, loadUserData, upsertUserData } from "./userDataApi";

export const USER_DATA_SAVE_DEBOUNCE_MS = 500;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEmptyObject(value) {
  return !isPlainObject(value) || Object.keys(value).length === 0;
}

function hasMeaningfulLocalData(value) {
  if (!isPlainObject(value)) return false;

  const goals = Array.isArray(value.goals) ? value.goals : [];
  const habits = Array.isArray(value.habits) ? value.habits : [];
  const occurrences = Array.isArray(value.occurrences) ? value.occurrences : [];
  const reminders = Array.isArray(value.reminders) ? value.reminders : [];
  const sessions = Array.isArray(value.sessions) ? value.sessions : [];
  const sessionHistory = Array.isArray(value.sessionHistory) ? value.sessionHistory : [];
  const categories = Array.isArray(value.categories) ? value.categories : [];
  const profile = isPlainObject(value.profile) ? value.profile : {};
  const ui = isPlainObject(value.ui) ? value.ui : {};

  if (goals.length || habits.length || occurrences.length || reminders.length || sessions.length || sessionHistory.length) {
    return true;
  }

  const nonSystemCategories = categories.filter((category) => category?.id && category.id !== "sys_inbox");
  if (nonSystemCategories.length > 0) return true;

  if ((profile.name || "").trim()) return true;
  if ((profile.lastName || "").trim()) return true;
  if ((profile.whyText || "").trim()) return true;
  if ((profile.whyImage || "").trim()) return true;
  if (Boolean(ui.onboardingCompleted)) return true;

  return false;
}

function toSafeState(value) {
  if (!isPlainObject(value)) return migrate(initialData());
  return migrate(value);
}

function logSaveError(error) {
  // Keep UI stable; log only.
  // eslint-disable-next-line no-console
  console.error("[user-data] save failed", error);
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

export function createDebouncedSave({ delayMs = USER_DATA_SAVE_DEBOUNCE_MS, onSave, onError } = {}) {
  let timerId = null;
  let lastPayload;

  const cancel = () => {
    if (!timerId) return;
    clearTimeout(timerId);
    timerId = null;
  };

  const schedule = (payload) => {
    lastPayload = payload;
    cancel();
    timerId = setTimeout(async () => {
      timerId = null;
      try {
        await onSave(lastPayload);
      } catch (error) {
        if (typeof onError === "function") onError(error);
      }
    }, delayMs);
  };

  return { schedule, cancel };
}

export function useUserData() {
  const { user } = useAuth();
  const userId = user?.id || null;

  const [data, setDataState] = useState(() => toSafeState(loadState() || initialData()));
  const [loading, setLoading] = useState(true);

  const skipNextRemoteSaveRef = useRef(true);
  const saverRef = useRef(null);
  const useDebounceRef = useRef(false);

  const setData = useCallback((next) => {
    setDataState((prev) => (typeof next === "function" ? next(prev) : next));
  }, []);

  useEffect(() => {
    skipNextRemoteSaveRef.current = true;
    if (saverRef.current) saverRef.current.cancel();

    if (!userId) {
      setDataState(toSafeState(loadState() || initialData()));
      setLoading(false);
      return undefined;
    }

    useDebounceRef.current = isRemoteUserDataEnabled && !isUsingE2EMockedSession(userId);

    if (useDebounceRef.current) {
      saverRef.current = createDebouncedSave({
        delayMs: USER_DATA_SAVE_DEBOUNCE_MS,
        onSave: async (nextData) => {
          await upsertUserData(userId, nextData);
        },
        onError: logSaveError,
      });
    } else {
      saverRef.current = null;
    }

    let active = true;

    (async () => {
      setLoading(true);
      try {
        const [remoteRaw, localRaw] = await Promise.all([loadUserData(userId), Promise.resolve(loadState())]);
        const remoteIsEmpty = isEmptyObject(remoteRaw);
        const localCandidate = localRaw ? toSafeState(localRaw) : null;

        let sourceData = remoteRaw;
        if (remoteIsEmpty && hasMeaningfulLocalData(localCandidate)) {
          await upsertUserData(userId, localCandidate);
          sourceData = localCandidate;
        }

        const next = toSafeState(sourceData);
        if (!active) return;

        skipNextRemoteSaveRef.current = true;
        setDataState(next);
        saveState(next);
      } catch (error) {
        if (!active) return;
        // eslint-disable-next-line no-console
        console.error("[user-data] load failed", error);
        const fallback = toSafeState(loadState() || initialData());
        skipNextRemoteSaveRef.current = true;
        setDataState(fallback);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (saverRef.current) saverRef.current.cancel();
    };
  }, [userId]);

  useEffect(() => {
    if (loading || !userId) return;

    const safeData = toSafeState(data);
    saveState(safeData);

    if (skipNextRemoteSaveRef.current) {
      skipNextRemoteSaveRef.current = false;
      return;
    }

    if (!isRemoteUserDataEnabled || !useDebounceRef.current) {
      upsertUserData(userId, safeData).catch(logSaveError);
      return;
    }

    if (saverRef.current) saverRef.current.schedule(safeData);
  }, [data, loading, userId]);

  return useMemo(
    () => ({
      data,
      setData,
      loading,
    }),
    [data, loading, setData]
  );
}
