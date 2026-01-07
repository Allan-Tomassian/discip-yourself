import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { todayKey } from "../utils/dates";
import {
  finishSessionForDate,
  getSessionByDate,
  skipSessionForDate,
  updateSessionTimerForDate,
} from "../logic/sessions";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";

function formatElapsed(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSec = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function resolveGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  if (raw === "STATE") return "OUTCOME";
  if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
  const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
  if (legacy === "OUTCOME") return "OUTCOME";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  return "PROCESS";
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
    typeof dateKey === "string" && dateKey
      ? dateKey
      : typeof urlDateKey === "string" && urlDateKey
        ? urlDateKey
        : typeof data?.selectedDateKey === "string" && data.selectedDateKey
          ? data.selectedDateKey
          : typeof safeData.ui?.selectedDate === "string" && safeData.ui.selectedDate
            ? safeData.ui.selectedDate
            : new Date().toISOString().slice(0, 10);
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

  const session = useMemo(() => {
    if (objectiveIdForSession) {
      return getSessionByDate({ sessions }, effectiveDateKey, objectiveIdForSession);
    }
    return getSessionByDate({ sessions }, effectiveDateKey, null);
  }, [sessions, effectiveDateKey, objectiveIdForSession]);
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
  const sessionMinutes =
    Number.isFinite(objective?.sessionMinutes) ? objective.sessionMinutes : null;
  const habitMinutes = habits.find((h) => Number.isFinite(h.sessionMinutes))?.sessionMinutes;
  const targetMinutes = Number.isFinite(sessionMinutes) ? sessionMinutes : habitMinutes ?? null;
  const remainingSec =
    Number.isFinite(targetMinutes) && targetMinutes != null
      ? Math.max(0, Math.round(targetMinutes * 60 - elapsedSec))
      : null;
  const remainingLabel = remainingSec != null ? formatElapsed(remainingSec * 1000) : "";
  const hasHabits = habits.length > 0;
  const isFinal = Boolean(session && (session.status === "done" || session.status === "skipped"));

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
    if (!session || typeof setData !== "function" || !hasHabits) return;
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
    if (!session || typeof setData !== "function" || !hasHabits) return;
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
    if (!session || typeof setData !== "function" || !hasHabits || !isEditable) return;
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

  function cancelSession() {
    if (typeof setData !== "function" || !isEditable) return;
    setData((prev) => skipSessionForDate(prev, resolvedDateKey, { objectiveId }));
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
                {elapsedSec > 0
                  ? "Reprends quand tu es prêt."
                  : "Appuie sur Démarrer pour lancer le timer."}
              </div>
            ) : null}
            <div className="mt12 row" style={{ gap: 10 }}>
              <Button variant="ghost" onClick={confirmPause} disabled={!hasHabits || !isEditable}>
                Pause
              </Button>
              <Button onClick={elapsedSec > 0 ? resumeTimer : startTimer} disabled={!hasHabits}>
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
                <div className="small2">Aucune action disponible pour cette session.</div>
                <div className="mt10">
                  <Button
                    variant="ghost"
                    onClick={typeof onOpenLibrary === "function" ? onOpenLibrary : onBack}
                  >
                    Aller à Bibliothèque
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
          <Button variant="ghost" onClick={endSession} disabled={!hasHabits || !isEditable}>
            Terminer
          </Button>
        </div>
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
