import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { todayKey } from "../utils/dates";
import {
  finishSessionForDate,
  getSessionByDate,
  skipSessionForDate,
  toggleSessionHabit,
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

export default function Session({ data, setData, onBack, onOpenLibrary }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const sessions = Array.isArray(safeData.sessions) ? safeData.sessions : [];
  const selectedDateKey = safeData.ui?.selectedDate || todayKey();

  const [tick, setTick] = useState(Date.now());

  const session = useMemo(
    () => getSessionByDate({ sessions }, selectedDateKey, null),
    [sessions, selectedDateKey]
  );
  const isRunning = Boolean(session && session.status === "partial" && session.timerRunning);
  const isEditable = Boolean(session && session.status === "partial");
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  const dateKey = session?.dateKey || session?.date || selectedDateKey;
  const objectiveId = typeof session?.objectiveId === "string" ? session.objectiveId : null;
  const objective = objectiveId ? goals.find((g) => g.id === objectiveId) || null : null;
  const habitIds = Array.isArray(session?.habitIds) ? session.habitIds : [];
  const doneHabitIds = Array.isArray(session?.doneHabitIds)
    ? session.doneHabitIds
    : Array.isArray(session?.doneHabits)
      ? session.doneHabits
      : [];
  const doneSet = useMemo(() => new Set(doneHabitIds), [doneHabitIds]);
  const habits = habitIds.map((id) => goals.find((g) => g.id === id)).filter(Boolean);
  const categoryId = objective?.categoryId || habits[0]?.categoryId || null;
  const category = categories.find((c) => c.id === categoryId) || null;
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

  function toggleDone(habitId, checked) {
    if (!habitId || typeof setData !== "function" || !isEditable) return;
    setData((prev) => toggleSessionHabit(prev, dateKey, habitId, checked, objectiveId));
  }

  function startTimer() {
    if (!session || typeof setData !== "function" || !hasHabits) return;
    const nowIso = new Date().toISOString();
    setData((prev) =>
      updateSessionTimerForDate(prev, dateKey, {
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
      updateSessionTimerForDate(prev, dateKey, {
        objectiveId,
        timerStartedAt: "",
        timerAccumulatedSec: elapsedSec,
        timerRunning: false,
      })
    );
  }

  function resumeTimer() {
    if (!session || typeof setData !== "function" || !hasHabits) return;
    const nowIso = new Date().toISOString();
    setData((prev) =>
      updateSessionTimerForDate(prev, dateKey, {
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
      finishSessionForDate(prev, dateKey, {
        objectiveId,
        durationSec,
        doneHabitIds,
      })
    );

    if (typeof onBack === "function") onBack();
  }

  function cancelSession() {
    if (typeof setData !== "function" || !isEditable) return;
    setData((prev) => skipSessionForDate(prev, dateKey, { objectiveId }));
    if (typeof onBack === "function") onBack();
  }

  if (!session) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        headerTitle={<span className="textAccent">Session</span>}
        headerSubtitle="Aucune session"
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune session en cours</div>
            <div className="small2" style={{ marginTop: 6 }}>
              Lance une session depuis Aujourd’hui.
            </div>
            <div className="mt12">
              {typeof onOpenLibrary === "function" ? (
                <Button variant="ghost" onClick={onOpenLibrary}>
                  Aller à Bibliothèque
                </Button>
              ) : (
                <Button variant="ghost" onClick={onBack}>
                  ← Retour
                </Button>
              )}
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  if (isFinal) {
    const statusLabel = session.status === "done" ? "Session terminée" : "Session annulée";
    return (
      <ScreenShell
        accent={accent}
        headerTitle={<span className="textAccent">Session</span>}
        headerSubtitle={`${category?.name || "Catégorie"} · ${objective?.title || "Objectif"}`}
        backgroundImage={category?.wallpaper || safeData.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">{statusLabel}</div>
            <div className="small2" style={{ marginTop: 6 }}>
              Date : {dateKey}
            </div>
            <div className="mt12">
              <Button variant="ghost" onClick={onBack}>
                Revenir à Aujourd’hui
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      accent={accent}
      headerTitle={<span className="textAccent">Session</span>}
      headerSubtitle={`${category?.name || "Catégorie"} · ${objective?.title || "Objectif"}`}
      backgroundImage={category?.wallpaper || safeData.profile?.whyImage || ""}
    >
      <div style={catAccentVars}>
        <Button variant="ghost" onClick={onBack}>
          ← Retour
        </Button>

        <Card accentBorder style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="sectionTitle">Objectif</div>
            <div className="titleSm" style={{ marginTop: 6 }}>
              {objective?.title || "Objectif principal"}
            </div>
            <div className="sectionSub" style={{ marginTop: 6 }}>
              Date : {dateKey}
            </div>
          </div>
        </Card>

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
                {elapsedSec > 0 ? "Reprends quand tu es prêt." : "Appuie sur Démarrer pour lancer le timer."}
              </div>
            ) : null}
            <div className="mt12 row" style={{ gap: 10 }}>
              {isRunning ? (
                <Button variant="ghost" onClick={pauseTimer}>
                  Pause
                </Button>
              ) : (
                <Button onClick={elapsedSec > 0 ? resumeTimer : startTimer} disabled={!hasHabits}>
                  {elapsedSec > 0 ? "Reprendre" : "Démarrer"}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card accentBorder style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="sectionTitle">Habitudes</div>
            {habits.length ? (
              <div className="mt12 col" style={{ gap: 10 }}>
                {habits.map((h) => (
                  <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                    <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                      <div className="itemTitle">{h.title || "Habitude"}</div>
                      <label className="includeToggle">
                        <input
                          type="checkbox"
                          checked={doneSet.has(h.id)}
                          disabled={!isEditable}
                          onChange={(e) => toggleDone(h.id, e.target.checked)}
                        />
                        <span>{doneSet.has(h.id) ? "Fait" : "À faire"}</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt12 col">
                <div className="small2">Aucune habitude disponible pour cette session.</div>
                <div className="mt10">
                  <Button variant="ghost" onClick={typeof onOpenLibrary === "function" ? onOpenLibrary : onBack}>
                    Aller à Bibliothèque
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="mt12 row" style={{ justifyContent: "flex-end", gap: 10 }}>
          <Button variant="ghost" onClick={cancelSession} disabled={!hasHabits || !isEditable}>
            Annuler la session
          </Button>
          <Button onClick={endSession} disabled={!hasHabits || !isEditable}>
            Terminer la session
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
}

/* Tests manuels
1) Démarrer session, voir le timer tourner.
2) Cocher une habitude => reflété au retour sur Aujourd’hui.
3) Terminer la session => progression mise à jour.
4) Annuler la session => état annulé, retour Aujourd’hui.
5) Revenir sur /session après fin => “Session terminée”.
*/
