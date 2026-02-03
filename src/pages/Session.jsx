import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { AccentItem, Button, Card } from "../components/UI";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { setOccurrenceStatusById } from "../logic/occurrences";
import { isFinalOccurrenceStatus, resolveExecutableOccurrence } from "../logic/sessionResolver";
import { upsertSessionV2 } from "../logic/sessionsV2";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { resolveConflictNearest } from "../logic/occurrencePlanner";

function formatElapsed(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSec = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function resolvePreferredMinutes(session) {
  const raw = session?.timerStartedAt || session?.startedAt || "";
  const d = raw ? new Date(raw) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function pickClosestOccurrence(list, preferredMin) {
  if (!Array.isArray(list) || !Number.isFinite(preferredMin)) return null;
  let best = null;
  let bestDiff = Infinity;
  let bestMin = null;
  for (const occ of list) {
    if (!occ || typeof occ.start !== "string") continue;
    const occMin = parseTimeToMinutes(occ.start);
    if (occMin == null) continue;
    const diff = Math.abs(occMin - preferredMin);
    if (diff < bestDiff || (diff === bestDiff && (bestMin == null || occMin > bestMin))) {
      best = occ;
      bestDiff = diff;
      bestMin = occMin;
    }
  }
  return best;
}

export default function Session({ data, setData, onBack, onOpenLibrary, dateKey }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const activeSession =
    safeData.ui && typeof safeData.ui.activeSession === "object" ? safeData.ui.activeSession : null;
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlDateKey = urlParams?.get("date") || null;
  const effectiveDateKey =
    normalizeLocalDateKey(dateKey) ||
    normalizeLocalDateKey(urlDateKey) ||
    normalizeLocalDateKey(safeData.ui?.selectedDateKey) ||
    normalizeLocalDateKey(safeData.ui?.selectedDate) ||
    todayLocalKey();
  const [tick, setTick] = useState(Date.now());
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState(0);
  const [overrideStart, setOverrideStart] = useState("");
  const autoEndSigRef = useRef("");
  const session = useMemo(() => {
    if (!activeSession) return null;
    const key = activeSession.dateKey || activeSession.date;
    if (key && key !== effectiveDateKey) return null;
    return activeSession;
  }, [activeSession, effectiveDateKey]);
  const occurrenceId = typeof session?.occurrenceId === "string" ? session.occurrenceId : null;
  const isRunning = Boolean(session && session.status === "partial" && session.timerRunning);
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  const resolvedDateKey = session?.dateKey || session?.date || effectiveDateKey;
  const objectiveId = typeof session?.objectiveId === "string" ? session.objectiveId : null;
  const objective = objectiveId ? goals.find((g) => g.id === objectiveId) || null : null;
  const habitIds = useMemo(
    () => (Array.isArray(session?.habitIds) ? session.habitIds : []),
    [session?.habitIds]
  );
  const habits = habitIds.map((id) => goals.find((g) => g.id === id)).filter(Boolean);
  const hasHabits = habits.length > 0;
  const occurrences = useMemo(
    () => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []),
    [safeData.occurrences]
  );
  const occurrenceById = useMemo(() => {
    if (!occurrenceId) return null;
    return occurrences.find((occ) => occ && occ.id === occurrenceId) || null;
  }, [occurrences, occurrenceId]);
  const effectiveCategoryId = objective?.categoryId || habits[0]?.categoryId || null;
  const category = categories.find((c) => c.id === effectiveCategoryId) || null;
  const accent = category?.color || getAccentForPage(safeData, "home");
  const catAccentVars = getCategoryAccentVars(accent);

  const timerAccumulatedSec = Number.isFinite(session?.timerAccumulatedSec) ? session.timerAccumulatedSec : 0;
  const startedAtMs = session?.timerStartedAt ? new Date(session.timerStartedAt).getTime() : NaN;
  const runningDeltaSec =
    isRunning && Number.isFinite(startedAtMs) ? Math.max(0, Math.floor((tick - startedAtMs) / 1000)) : 0;
  const elapsedSec = Math.max(0, timerAccumulatedSec + runningDeltaSec);
  const elapsedLabel = formatElapsed(elapsedSec * 1000);
  const preferredMinutes = resolvePreferredMinutes(session);
  const resolution = useMemo(() => {
    if (occurrenceId) {
      if (!occurrenceById) return { occurrence: null, reason: "not_found" };
      const st = typeof occurrenceById.status === "string" ? occurrenceById.status : "planned";
      if (isFinalOccurrenceStatus(st)) return { occurrence: occurrenceById, reason: "final" };
      return { occurrence: occurrenceById, reason: "ok" };
    }

    const resolved = resolveExecutableOccurrence(
      { occurrences },
      { dateKey: resolvedDateKey, goalIds: habitIds }
    );
    if (resolved.kind !== "ok" || !resolved.occurrenceId) {
      return { occurrence: null, reason: resolved.kind === "final" ? "final" : "not_found" };
    }
    const occ = occurrences.find((o) => o && o.id === resolved.occurrenceId) || null;
    if (!occ) return { occurrence: null, reason: "not_found" };
    if (isFinalOccurrenceStatus(occ.status)) return { occurrence: occ, reason: "final" };
    return { occurrence: occ, reason: "ok" };
  }, [occurrenceId, occurrenceById, occurrences, resolvedDateKey, habitIds]);
  const candidateOccurrences = useMemo(() => {
    if (!habitIds.length) return [];
    return occurrences.filter((occ) => occ && habitIds.includes(occ.goalId) && occ.date === resolvedDateKey);
  }, [occurrences, habitIds, resolvedDateKey]);
  const selectedOccurrence = useMemo(() => {
    if (occurrenceId) return occurrenceById;
    return resolution.occurrence;
  }, [occurrenceId, occurrenceById, resolution.occurrence]);

  const availableStarts = useMemo(() => {
    const set = new Set();
    for (const occ of candidateOccurrences) {
      if (!occ || typeof occ.start !== "string" || !occ.start) continue;
      set.add(occ.start);
    }
    return Array.from(set).sort();
  }, [candidateOccurrences]);
  const occurrenceStart = (occurrenceId ? selectedOccurrence?.start : overrideStart || selectedOccurrence?.start) || "";
  const hasOccurrence = Boolean(selectedOccurrence);
  const resolvedDoneHabitIds = useMemo(() => {
    if (occurrenceId && selectedOccurrence?.goalId) return [selectedOccurrence.goalId];
    return habitIds;
  }, [occurrenceId, selectedOccurrence?.goalId, habitIds]);
  const occurrenceDuration = Number.isFinite(selectedOccurrence?.durationMinutes)
    ? selectedOccurrence.durationMinutes
    : hasOccurrence
      ? 30
      : null;
  const targetMinutes = occurrenceDuration != null ? occurrenceDuration + extraMinutes : null;
  const canRunTimer = hasHabits && hasOccurrence;
  const remainingSec =
    Number.isFinite(targetMinutes) && targetMinutes != null
      ? Math.max(0, Math.round(targetMinutes * 60 - elapsedSec))
      : null;
  const remainingLabel = remainingSec != null ? formatElapsed(remainingSec * 1000) : "";
  const isOccurrenceFinal = Boolean(selectedOccurrence && isFinalOccurrenceStatus(selectedOccurrence.status));
  const resolutionBlocked = resolution.reason !== "ok";
  const finalStatus =
    session && session.status && session.status !== "partial"
      ? session.status
      : isOccurrenceFinal || resolution.reason === "final"
        ? selectedOccurrence?.status || "canceled"
        : null;
  const isFinal = Boolean(finalStatus || resolutionBlocked);
  const isEditable = Boolean(session && session.status === "partial" && !isOccurrenceFinal && !resolutionBlocked);
  useEffect(() => {
    setExtraMinutes(0);
    setOverrideStart("");
    setShowEndConfirm(false);
  }, [session?.id]);

  const attachOccurrenceSigRef = useRef("");
  useEffect(() => {
    if (!session || occurrenceId) return;
    if (resolution.reason !== "ok" || !resolution.occurrence?.id) return;
    if (typeof setData !== "function") return;
    const sig = `${session.id || ""}:${resolution.occurrence.id}`;
    if (attachOccurrenceSigRef.current === sig) return;
    attachOccurrenceSigRef.current = sig;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
      if (!current || current.occurrenceId) return prev;
      if (session?.id && current.id && current.id !== session.id) return prev;
      if (current.occurrenceId === resolution.occurrence.id) return prev;
      const nextSession = { ...current, occurrenceId: resolution.occurrence.id };
      return { ...prev, ui: { ...prevUi, activeSession: nextSession } };
    });
  }, [occurrenceId, resolution.reason, resolution.occurrence?.id, session?.id, setData]);

  const ensureSessionHistorySigRef = useRef("");
  useEffect(() => {
    if (!session || session.status !== "partial" || !occurrenceId) return;
    if (typeof setData !== "function") return;
    const sig = `${session.id || ""}:${occurrenceId}:in_progress`;
    if (ensureSessionHistorySigRef.current === sig) return;
    ensureSessionHistorySigRef.current = sig;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
      if (!current || current.status !== "partial") return prev;
      if (current.occurrenceId && current.occurrenceId !== occurrenceId) return prev;
      const prevHistory = Array.isArray(prev?.sessionHistory) ? prev.sessionHistory : [];
      const prevOccurrences = Array.isArray(prev?.occurrences) ? prev.occurrences : [];
      const occurrence = prevOccurrences.find((occ) => occ && occ.id === occurrenceId) || null;
      const actionId =
        typeof occurrence?.goalId === "string"
          ? occurrence.goalId
          : typeof occurrence?.actionId === "string"
            ? occurrence.actionId
            : "";
      const dateKey = occurrence?.date || current.dateKey || current.date || resolvedDateKey;
      const record = {
        id: current.id || occurrenceId,
        occurrenceId,
        actionId,
        dateKey,
        startAt: current.startedAt || current.timerStartedAt || "",
        endAt: null,
        state: "in_progress",
        endedReason: null,
        timerSeconds: Number.isFinite(current.timerAccumulatedSec) ? current.timerAccumulatedSec : 0,
        notes: typeof current.notes === "string" ? current.notes : "",
      };
      const nextHistory = upsertSessionV2(prevHistory, record);
      if (nextHistory === prevHistory) return prev;
      return { ...prev, sessionHistory: nextHistory };
    });
  }, [session?.id, session?.status, occurrenceId, resolvedDateKey, setData]);

  useEffect(() => {
    if (!session || !isEditable) return;
    if (!isRunning) return;
    if (remainingSec == null) return;
    if (remainingSec > 0) return;
    if (!occurrenceId) return;
    const sig = `${session?.id || ""}:${occurrenceId || ""}:${resolvedDateKey}`;
    if (autoEndSigRef.current === sig) return;
    autoEndSigRef.current = sig;

    const durationSec = Math.max(0, Math.floor(elapsedSec));
    if (typeof setData === "function") {
      setData((prev) => {
        const goals = Array.isArray(prev?.goals) ? prev.goals : [];
        if (!occurrenceId) return prev;
        const prevOccurrences = Array.isArray(prev?.occurrences) ? prev.occurrences : [];
        const nextOccurrences = setOccurrenceStatusById(occurrenceId, "done", {
          occurrences: prevOccurrences,
          goals,
        });
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
        const nowIso = new Date().toISOString();
        const nextSession = current
          ? {
              ...current,
              status: "done",
              doneHabitIds: resolvedDoneHabitIds,
              durationSec,
              timerRunning: false,
              timerStartedAt: "",
              timerAccumulatedSec: durationSec,
              finishedAt: nowIso,
            }
          : current;
        const prevHistory = Array.isArray(prev?.sessionHistory) ? prev.sessionHistory : [];
        const occurrence = prevOccurrences.find((occ) => occ && occ.id === occurrenceId) || null;
        const actionId =
          typeof occurrence?.goalId === "string"
            ? occurrence.goalId
            : typeof occurrence?.actionId === "string"
              ? occurrence.actionId
              : "";
        const dateKey = occurrence?.date || current?.dateKey || current?.date || resolvedDateKey;
        const record = {
          id: current?.id || occurrenceId,
          occurrenceId,
          actionId,
          dateKey,
          startAt: current?.startedAt || current?.timerStartedAt || nowIso,
          endAt: nowIso,
          state: "ended",
          endedReason: "done",
          timerSeconds: durationSec,
          notes: typeof current?.notes === "string" ? current.notes : "",
        };
        const nextHistory = upsertSessionV2(prevHistory, record);
        if (nextOccurrences === prevOccurrences && nextSession === current && nextHistory === prevHistory) return prev;
        return {
          ...prev,
          occurrences: nextOccurrences,
          sessionHistory: nextHistory,
          ui: { ...prevUi, activeSession: nextSession },
        };
      });
    }

    if (typeof onBack === "function") onBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, remainingSec, session?.id, occurrenceId, resolvedDateKey, isEditable]);

  function startTimer() {
    if (!session || typeof setData !== "function" || !canRunTimer || !isEditable || !occurrenceId) return;
    const nowIso = new Date().toISOString();
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
      if (!current) return prev;
      if (current.timerRunning) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          activeSession: {
            ...current,
            timerStartedAt: nowIso,
            timerAccumulatedSec,
            timerRunning: true,
            startedAt: current.startedAt || nowIso,
          },
        },
      };
    });
  }

  function pauseTimer() {
    if (!session || typeof setData !== "function" || !occurrenceId) return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
      if (!current) return prev;
      if (!current.timerRunning && !current.timerStartedAt && current.timerAccumulatedSec === elapsedSec) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          activeSession: {
            ...current,
            timerStartedAt: "",
            timerAccumulatedSec: elapsedSec,
            timerRunning: false,
          },
        },
      };
    });
  }

  function confirmPause() {
    pauseTimer();
  }

  function resumeTimer() {
    if (!session || typeof setData !== "function" || !canRunTimer || !isEditable || !occurrenceId) return;
    const nowIso = new Date().toISOString();
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
      if (!current) return prev;
      if (current.timerRunning) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          activeSession: {
            ...current,
            timerStartedAt: nowIso,
            timerAccumulatedSec,
            timerRunning: true,
          },
        },
      };
    });
  }

  function endSession() {
    if (!session || typeof setData !== "function" || !canRunTimer || !isEditable || !occurrenceId) return;
    const durationSec = Math.max(0, Math.floor(elapsedSec));
    setData((prev) => {
      const goals = Array.isArray(prev?.goals) ? prev.goals : [];
      if (!occurrenceId) return prev;
      const prevOccurrences = Array.isArray(prev?.occurrences) ? prev.occurrences : [];
      const nextOccurrences = setOccurrenceStatusById(occurrenceId, "done", {
        occurrences: prevOccurrences,
        goals,
      });
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
      const nowIso = new Date().toISOString();
      const nextSession = current
        ? {
            ...current,
            status: "done",
            doneHabitIds: resolvedDoneHabitIds,
            durationSec,
            timerRunning: false,
            timerStartedAt: "",
            timerAccumulatedSec: durationSec,
            finishedAt: nowIso,
          }
        : current;
      const prevHistory = Array.isArray(prev?.sessionHistory) ? prev.sessionHistory : [];
      const occurrence = prevOccurrences.find((occ) => occ && occ.id === occurrenceId) || null;
      const actionId =
        typeof occurrence?.goalId === "string"
          ? occurrence.goalId
          : typeof occurrence?.actionId === "string"
            ? occurrence.actionId
            : "";
      const dateKey = occurrence?.date || current?.dateKey || current?.date || resolvedDateKey;
      const record = {
        id: current?.id || occurrenceId,
        occurrenceId,
        actionId,
        dateKey,
        startAt: current?.startedAt || current?.timerStartedAt || nowIso,
        endAt: nowIso,
        state: "ended",
        endedReason: "done",
        timerSeconds: durationSec,
        notes: typeof current?.notes === "string" ? current.notes : "",
      };
      const nextHistory = upsertSessionV2(prevHistory, record);
      if (nextOccurrences === prevOccurrences && nextSession === current && nextHistory === prevHistory) return prev;
      return {
        ...prev,
        occurrences: nextOccurrences,
        sessionHistory: nextHistory,
        ui: { ...prevUi, activeSession: nextSession },
      };
    });

    if (typeof onBack === "function") onBack();
  }

  function confirmEndSession() {
    setShowEndConfirm(true);
  }

  function applyExtension(addMinutes) {
    if (!selectedOccurrence || !Number.isFinite(addMinutes)) return;
    const nextExtra = Math.max(0, extraMinutes + addMinutes);
    const base = Number.isFinite(selectedOccurrence.durationMinutes) ? selectedOccurrence.durationMinutes : 30;
    const newDuration = base + nextExtra;
    const otherOccurrences = candidateOccurrences.filter((o) => o !== selectedOccurrence);
    const resolved = resolveConflictNearest(otherOccurrences, resolvedDateKey, occurrenceStart, newDuration, []);
    if (resolved && resolved.start && resolved.start !== occurrenceStart) {
      setOverrideStart(resolved.start);
    }
    setExtraMinutes(nextExtra);
  }

  function closeEndConfirm() {
    setShowEndConfirm(false);
  }

  function cancelSession() {
    if (typeof setData !== "function" || !isEditable || !occurrenceId) return;
    const targetHabitIds = habitIds.length ? habitIds : session?.habitId ? [session.habitId] : [];
    if (!targetHabitIds.length && !occurrenceId) {
      if (typeof onBack === "function") onBack();
      return;
    }
    setData((prev) => {
      const goals = Array.isArray(prev?.goals) ? prev.goals : [];
      if (!occurrenceId) return prev;
      const prevOccurrences = Array.isArray(prev?.occurrences) ? prev.occurrences : [];
      const nextOccurrences = setOccurrenceStatusById(occurrenceId, "skipped", {
        occurrences: prevOccurrences,
        goals,
      });
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
      const nowIso = new Date().toISOString();
      const nextSession = current
        ? {
            ...current,
            status: "skipped",
            doneHabitIds: [],
            timerRunning: false,
            timerStartedAt: "",
            finishedAt: nowIso,
          }
        : current;
      const prevHistory = Array.isArray(prev?.sessionHistory) ? prev.sessionHistory : [];
      const occurrence = prevOccurrences.find((occ) => occ && occ.id === occurrenceId) || null;
      const actionId =
        typeof occurrence?.goalId === "string"
          ? occurrence.goalId
          : typeof occurrence?.actionId === "string"
            ? occurrence.actionId
            : "";
      const dateKey = occurrence?.date || current?.dateKey || current?.date || resolvedDateKey;
      const record = {
        id: current?.id || occurrenceId,
        occurrenceId,
        actionId,
        dateKey,
        startAt: current?.startedAt || current?.timerStartedAt || nowIso,
        endAt: nowIso,
        state: "ended",
        endedReason: "canceled",
        timerSeconds: Number.isFinite(current?.timerAccumulatedSec) ? current.timerAccumulatedSec : 0,
        notes: typeof current?.notes === "string" ? current.notes : "",
      };
      const nextHistory = upsertSessionV2(prevHistory, record);
      if (nextOccurrences === prevOccurrences && nextSession === current && nextHistory === prevHistory) return prev;
      return {
        ...prev,
        occurrences: nextOccurrences,
        sessionHistory: nextHistory,
        ui: { ...prevUi, activeSession: nextSession },
      };
    });
    if (typeof onBack === "function") onBack();
  }

  if (!session) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        headerTitle={<span>Session</span>}
        headerSubtitle={
          <div className="stack stackGap12">
            <div>Aucune session</div>
            {typeof onOpenLibrary === "function" ? null : (
              <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
                ← Retour
              </Button>
            )}
          </div>
        }
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune session en cours</div>
            <div className="small2 mt6">
              Lance une session depuis Aujourd’hui.
            </div>
            {typeof onOpenLibrary === "function" ? (
              <div className="mt12">
                <Button variant="ghost" onClick={onOpenLibrary}>
                  Aller à Bibliothèque
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const sessionTitle = objective?.title || "Objectif";
  const sessionSubtitle = category?.name || "Catégorie";

  if (isFinal) {
    const statusLabel =
      finalStatus === "done" ? "Session terminée" : finalStatus ? "Session clôturée" : "Session clôturée";

    const durationSecStored = Number.isFinite(session?.durationSec) ? session.durationSec : null;
    const durationSec =
      durationSecStored != null
        ? Math.max(0, Math.floor(durationSecStored))
        : Math.max(0, Math.floor(elapsedSec));
    const durationLabel = formatElapsed(durationSec * 1000);

    const doneHabitIds = Array.isArray(session?.doneHabitIds)
      ? session.doneHabitIds
      : finalStatus === "done"
        ? resolvedDoneHabitIds
        : [];
    const doneHabits = doneHabitIds
      .map((id) => goals.find((g) => g.id === id))
      .filter(Boolean);

    return (
      <ScreenShell
        accent={accent}
        headerTitle={<span>{sessionTitle}</span>}
        headerSubtitle={
          <div className="stack stackGap12">
            <div>{sessionSubtitle}</div>
            <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
              ← Retour
            </Button>
          </div>
        }
        backgroundImage={category?.wallpaper || safeData.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">{statusLabel}</div>
            <div className="small2 mt6">
              Date : {effectiveDateKey}
            </div>
          </div>
        </Card>

        <Card accentBorder className="mt12">
          <div className="p18">
            <div className="sectionTitle">Débrief</div>

            <div className="mt12">
              <div className="small2">Durée : {durationLabel}</div>
            </div>

            {session.status === "done" ? (
              <div className="mt12">
                <div className="small2">Actions accomplies</div>
                {doneHabits.length ? (
                  <div className="mt10 col gap10">
                    {doneHabits.map((h) => (
                      <AccentItem key={h.id} className="listItem" style={catAccentVars}>
                        <div className="row rowBetween alignCenter">
                          <div className="itemTitle">{h.title || "Action"}</div>
                          <span className="actionStatus running">Fait</span>
                        </div>
                      </AccentItem>
                    ))}
                  </div>
                ) : (
                  <div className="mt10 small2">Aucune action enregistrée.</div>
                )}
              </div>
            ) : (
              <div className="mt12 small2">Aucune action validée (session annulée).</div>
            )}
          </div>
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      accent={accent}
      headerTitle={<span>{sessionTitle}</span>}
      headerSubtitle={
        <div className="stack stackGap12">
          <div>{sessionSubtitle}</div>
          <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
            ← Retour
          </Button>
        </div>
      }
      backgroundImage={category?.wallpaper || safeData.profile?.whyImage || ""}
    >
      <div style={catAccentVars}>
        <Card accentBorder className="mt12">
          <div className="p18">
            <div className="sectionTitle">Timer</div>
            <div className="titleSm mt6">
              {elapsedLabel}
            </div>
            {remainingLabel ? (
              <div className="small2 mt6">
                Reste : {remainingLabel}
              </div>
            ) : null}
            {!isRunning ? (
              <div className="small2 mt6">
                {!hasOccurrence
                  ? "Aucune occurrence planifiée pour cette session."
                  : elapsedSec > 0
                    ? "Continue quand tu es prêt."
                    : "Appuie sur Démarrer pour lancer le timer."}
              </div>
            ) : null}
            {availableStarts.length > 1 ? (
              <div className="mt12">
                <div className="small2">Créneau</div>
                <div className="mt8 row gap8 rowWrap">
                  {availableStarts.map((t) => (
                    <Button
                      key={t}
                      variant="ghost"
                      onClick={() => setOverrideStart(t)}
                      disabled={!isEditable}
                      style={
                        t === occurrenceStart
                          ? {
                              background: "rgba(255,255,255,0.10)",
                              borderColor: "var(--catAccent, rgba(255,255,255,0.35))",
                            }
                          : null
                      }
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt12 row gap10">
              <Button
                variant="ghost"
                onClick={confirmPause}
                disabled={!canRunTimer || !isEditable || !occurrenceId}
              >
                Pause
              </Button>
              <Button
                onClick={elapsedSec > 0 ? resumeTimer : startTimer}
                disabled={!canRunTimer || !isEditable || !occurrenceId}
              >
                {elapsedSec > 0 ? "Continuer" : "Démarrer"}
              </Button>
            </div>
          </div>
        </Card>

        <Card accentBorder className="mt12">
          <div className="p18">
            <div className="sectionTitle">Actions</div>
            {habits.length ? (
              <div className="mt12 col gap10">
                {habits.map((h) => (
                  <AccentItem key={h.id} className="listItem" style={catAccentVars}>
                    <div className="row rowBetween alignCenter">
                      <div className="itemTitle">{h.title || "Action"}</div>
                      <span className={`actionStatus ${isRunning ? "running" : "todo"}`}>
                        {isRunning ? "En cours" : "À faire"}
                      </span>
                    </div>
                  </AccentItem>
                ))}
              </div>
            ) : (
              <div className="mt12 col">
                <div className="small2">Aucune action sélectionnée pour cette session.</div>
                <div className="mt10">
                  <Button
                    variant="ghost"
                    onClick={typeof onOpenLibrary === "function" ? onOpenLibrary : onBack}
                  >
                    Choisir des actions
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="mt12 row gap10">
          <Button variant="ghost" onClick={cancelSession} disabled={!hasHabits || !isEditable || !occurrenceId}>
            Annuler
          </Button>
          <Button variant="ghost" onClick={confirmEndSession} disabled={!canRunTimer || !isEditable || !occurrenceId}>
            Terminer
          </Button>
        </div>
        {showEndConfirm ? (
          <Card accentBorder className="mt12">
            <div className="p18">
              <div className="sectionTitle">Terminer ?</div>
              <div className="mt12 row gap8 rowWrap">
                <Button onClick={() => applyExtension(5)}>+5</Button>
                <Button onClick={() => applyExtension(10)}>+10</Button>
                <Button onClick={() => applyExtension(15)}>+15</Button>
                <Button variant="ghost" onClick={endSession}>Terminer</Button>
                <Button variant="ghost" onClick={closeEndConfirm}>Annuler</Button>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </ScreenShell>
  );
}

/* Tests manuels
1) Démarrer session, voir le timer tourner.
2) Quand le timer tourne: status actions => "En cours".
3) Terminer (timer à 0 ou bouton Terminer) => écran final + Débrief.
4) Annuler => écran final "Session annulée".
*/

/* CSS à ajouter (ex: index.css)
.actionStatus {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255,255,255,0.10);
}
.actionStatus.running {
  background: rgba(255,165,0,0.20);
}
*/
