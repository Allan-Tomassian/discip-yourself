import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";
import {
  finishSessionForDate,
  getSessionByDate,
  getSessionsForDate,
  skipSessionForDate,
  updateSessionTimerForDate,
} from "../logic/sessions";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { resolveGoalType } from "../domain/goalType";
import { resolveConflictNearest } from "../logic/occurrencePlanner";

function formatElapsed(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSec = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getSessionSortKey(session) {
  if (!session) return 0;
  const status = session.status;
  const statusRank = status === "partial" ? 3 : status === "done" ? 2 : status === "skipped" ? 1 : 0;
  const raw =
    session.finishedAt ||
    session.startedAt ||
    session.startAt ||
    session.timerStartedAt ||
    "";
  const ts = new Date(raw).getTime();
  const safeTs = Number.isFinite(ts) ? ts : 0;
  return statusRank * 1_000_000_000_000 + safeTs;
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

export default function Session({ data, setData, onBack, onOpenLibrary, categoryId, dateKey }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const sessions = Array.isArray(safeData.sessions) ? safeData.sessions : [];
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlCategoryId = urlParams?.get("cat") || null;
  const urlDateKey = urlParams?.get("date") || null;
  const effectiveDateKey =
    normalizeLocalDateKey(dateKey) ||
    normalizeLocalDateKey(urlDateKey) ||
    normalizeLocalDateKey(data?.selectedDateKey) ||
    normalizeLocalDateKey(safeData.ui?.selectedDate) ||
    todayLocalKey();
  const sessionCategoryId =
    categoryId || urlCategoryId || safeData.ui?.selectedCategoryId || categories[0]?.id || null;

  const objectiveIdForSession = useMemo(() => {
    if (!sessionCategoryId) return null;
    const category = categories.find((c) => c.id === sessionCategoryId) || null;
    if (category?.mainGoalId) return category.mainGoalId;
    const outcome =
      goals.find((g) => g.categoryId === sessionCategoryId && resolveGoalType(g) === "OUTCOME") ||
      null;
    return outcome?.id || null;
  }, [categories, goals, sessionCategoryId]);

  const [tick, setTick] = useState(Date.now());
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState(0);
  const [overrideStart, setOverrideStart] = useState("");

  const sessionsForDay = useMemo(
    () => getSessionsForDate({ sessions }, effectiveDateKey),
    [sessions, effectiveDateKey]
  );

  const sessionMatch = useMemo(() => {
    if (!sessionsForDay.length) return null;
    if (!sessionCategoryId) return sessionsForDay[0] || null;
    const byCategory = sessionsForDay.filter((s) => {
      const objId = typeof s?.objectiveId === "string" ? s.objectiveId : null;
      const obj = objId ? goals.find((g) => g.id === objId) || null : null;
      if (obj?.categoryId && obj.categoryId === sessionCategoryId) return true;
      const habitId = Array.isArray(s?.habitIds) ? s.habitIds.find(Boolean) : null;
      const habit = habitId ? goals.find((g) => g.id === habitId) || null : null;
      return habit?.categoryId === sessionCategoryId;
    });
    if (!byCategory.length) return sessionsForDay[0] || null;
    return byCategory.reduce((best, cur) => (getSessionSortKey(cur) >= getSessionSortKey(best) ? cur : best));
  }, [sessionsForDay, sessionCategoryId, goals]);

  const session = useMemo(() => {
    if (sessionMatch) return sessionMatch;
    if (objectiveIdForSession) {
      return getSessionByDate({ sessions }, effectiveDateKey, objectiveIdForSession);
    }
    return getSessionByDate({ sessions }, effectiveDateKey, null);
  }, [sessionMatch, sessions, effectiveDateKey, objectiveIdForSession]);
  const isRunning = Boolean(session && session.status === "partial" && session.timerRunning);
  const isEditable = Boolean(session && session.status === "partial");
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  const resolvedDateKey = session?.dateKey || session?.date || effectiveDateKey;
  const objectiveId = typeof session?.objectiveId === "string" ? session.objectiveId : null;
  const objective = objectiveId ? goals.find((g) => g.id === objectiveId) || null : null;
  const habitIds = Array.isArray(session?.habitIds) ? session.habitIds : [];
  const habits = habitIds.map((id) => goals.find((g) => g.id === id)).filter(Boolean);
  const hasHabits = habits.length > 0;
  const occurrences = Array.isArray(safeData.occurrences) ? safeData.occurrences : [];
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
  const candidateOccurrences = useMemo(() => {
    if (!habitIds.length) return [];
    return occurrences.filter(
      (occ) => occ && habitIds.includes(occ.goalId) && occ.date === resolvedDateKey
    );
  }, [occurrences, habitIds, resolvedDateKey]);
  const selectedOccurrence = useMemo(() => {
    if (!candidateOccurrences.length || preferredMinutes == null) return null;
    return pickClosestOccurrence(candidateOccurrences, preferredMinutes);
  }, [candidateOccurrences, preferredMinutes]);
  const occurrenceStart = overrideStart || selectedOccurrence?.start || "";
  const hasOccurrence = Boolean(selectedOccurrence);
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
  const isFinal = Boolean(session && (session.status === "done" || session.status === "skipped"));
  useEffect(() => {
    setExtraMinutes(0);
    setOverrideStart("");
    setShowEndConfirm(false);
  }, [session?.id]);

  useEffect(() => {
    if (!session || !isEditable) return;
    if (!isRunning) return;
    if (remainingSec == null) return;
    if (remainingSec > 0) return;

    const durationSec = Math.max(0, Math.floor(elapsedSec));
    setData((prev) =>
      finishSessionForDate(prev, resolvedDateKey, {
        objectiveId,
        durationSec,
        doneHabitIds: habitIds,
      })
    );

    if (typeof onBack === "function") onBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, remainingSec]);

  function startTimer() {
    if (!session || typeof setData !== "function" || !canRunTimer) return;
    const nowIso = new Date().toISOString();
    setData((prev) =>
      updateSessionTimerForDate(prev, resolvedDateKey, {
        objectiveId,
        timerStartedAt: nowIso,
        timerAccumulatedSec,
        timerRunning: true,
      })
    );
  }

  function pauseTimer() {
    if (!session || typeof setData !== "function") return;
    setData((prev) =>
      updateSessionTimerForDate(prev, resolvedDateKey, {
        objectiveId,
        timerStartedAt: "",
        timerAccumulatedSec: elapsedSec,
        timerRunning: false,
      })
    );
  }

  function confirmPause() {
    pauseTimer();
  }

  function resumeTimer() {
    if (!session || typeof setData !== "function" || !canRunTimer) return;
    const nowIso = new Date().toISOString();
    setData((prev) =>
      updateSessionTimerForDate(prev, resolvedDateKey, {
        objectiveId,
        timerStartedAt: nowIso,
        timerAccumulatedSec,
        timerRunning: true,
      })
    );
  }

  function endSession() {
    if (!session || typeof setData !== "function" || !canRunTimer || !isEditable) return;
    const durationSec = Math.max(0, Math.floor(elapsedSec));
    setData((prev) =>
      finishSessionForDate(prev, resolvedDateKey, {
        objectiveId,
        durationSec,
        doneHabitIds: habitIds,
      })
    );

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
    if (typeof setData !== "function" || !isEditable) return;
    const targetHabitIds = habitIds.length ? habitIds : session?.habitId ? [session.habitId] : [];
    if (!targetHabitIds.length) {
      if (typeof onBack === "function") onBack();
      return;
    }
    setData((prev) =>
      targetHabitIds.reduce(
        (next, habitId) => skipSessionForDate(next, habitId, resolvedDateKey, ""),
        prev
      )
    );
    if (typeof onBack === "function") onBack();
  }

  if (!session) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        headerTitle={<span className="textAccent">Session</span>}
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
            <div className="small2" style={{ marginTop: 6 }}>
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
    const statusLabel = session.status === "done" ? "Session terminée" : "Session annulée";

    const durationSecStored = Number.isFinite(session?.durationSec) ? session.durationSec : null;
    const durationSec =
      durationSecStored != null
        ? Math.max(0, Math.floor(durationSecStored))
        : Math.max(0, Math.floor(elapsedSec));
    const durationLabel = formatElapsed(durationSec * 1000);

    const doneHabitIds = Array.isArray(session?.doneHabitIds)
      ? session.doneHabitIds
      : session.status === "done"
        ? habitIds
        : [];
    const doneHabits = doneHabitIds
      .map((id) => goals.find((g) => g.id === id))
      .filter(Boolean);

    return (
      <ScreenShell
        accent={accent}
        headerTitle={<span className="textAccent">{sessionTitle}</span>}
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
            <div className="small2" style={{ marginTop: 6 }}>
              Date : {effectiveDateKey}
            </div>
          </div>
        </Card>

        <Card accentBorder style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="sectionTitle">Débrief</div>

            <div className="mt12">
              <div className="small2">Durée : {durationLabel}</div>
            </div>

            {session.status === "done" ? (
              <div className="mt12">
                <div className="small2">Actions accomplies</div>
                {doneHabits.length ? (
                  <div className="mt10 col" style={{ gap: 10 }}>
                    {doneHabits.map((h) => (
                      <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                        <div
                          className="row"
                          style={{ alignItems: "center", justifyContent: "space-between" }}
                        >
                          <div className="itemTitle">{h.title || "Action"}</div>
                          <span className="actionStatus running">Fait</span>
                        </div>
                      </div>
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
      headerTitle={<span className="textAccent">{sessionTitle}</span>}
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
        <Card accentBorder style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="sectionTitle">Timer</div>
            <div className="titleSm" style={{ marginTop: 6 }}>
              {elapsedLabel}
            </div>
            {remainingLabel ? (
              <div className="small2" style={{ marginTop: 6 }}>
                Reste : {remainingLabel}
              </div>
            ) : null}
            {!isRunning ? (
              <div className="small2" style={{ marginTop: 6 }}>
                {!hasOccurrence
                  ? "Aucune occurrence planifiée pour cette session."
                  : elapsedSec > 0
                    ? "Reprends quand tu es prêt."
                    : "Appuie sur Démarrer pour lancer le timer."}
              </div>
            ) : null}
            <div className="mt12 row" style={{ gap: 10 }}>
              <Button variant="ghost" onClick={confirmPause} disabled={!canRunTimer || !isEditable}>
                Pause
              </Button>
              <Button onClick={elapsedSec > 0 ? resumeTimer : startTimer} disabled={!canRunTimer}>
                {elapsedSec > 0 ? "Reprendre" : "Démarrer"}
              </Button>
            </div>
          </div>
        </Card>

        <Card accentBorder style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="sectionTitle">Actions</div>
            {habits.length ? (
              <div className="mt12 col" style={{ gap: 10 }}>
                {habits.map((h) => (
                  <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                    <div
                      className="row"
                      style={{ alignItems: "center", justifyContent: "space-between" }}
                    >
                      <div className="itemTitle">{h.title || "Action"}</div>
                      <span className={`actionStatus ${isRunning ? "running" : "todo"}`}>
                        {isRunning ? "En cours" : "À faire"}
                      </span>
                    </div>
                  </div>
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

        <div className="mt12 row" style={{ gap: 10 }}>
          <Button variant="ghost" onClick={cancelSession} disabled={!hasHabits || !isEditable}>
            Annuler
          </Button>
          <Button variant="ghost" onClick={confirmEndSession} disabled={!canRunTimer || !isEditable}>
            Terminer
          </Button>
        </div>
        {showEndConfirm ? (
          <Card accentBorder style={{ marginTop: 12 }}>
            <div className="p18">
              <div className="sectionTitle">Terminer ?</div>
              <div className="mt12 row" style={{ gap: 8, flexWrap: "wrap" }}>
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
