import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { uid } from "../utils/helpers";
import { todayKey } from "../utils/dates";
import { normalizeSession } from "../logic/sessions";
import { incHabit } from "../logic/habits";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";

function formatElapsed(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSec = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function Session({ data, setData, onBack }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const sessionDraft = safeData.ui?.sessionDraft || null;
  const activeSession = safeData.ui?.activeSession || null;

  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (activeSession || !sessionDraft || typeof setData !== "function") return;
    const dateKey = typeof sessionDraft.dateKey === "string" ? sessionDraft.dateKey : todayKey();
    const habitIds = Array.isArray(sessionDraft.habitIds) ? sessionDraft.habitIds : [];
    const objectiveId = typeof sessionDraft.objectiveId === "string" ? sessionDraft.objectiveId : null;
    const nextSession = {
      id: uid(),
      dateKey,
      objectiveId,
      habitIds,
      doneHabitIds: [],
      startedAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), activeSession: nextSession, sessionDraft: null },
    }));
  }, [activeSession, sessionDraft, setData]);

  const session = activeSession || null;
  const dateKey = session?.dateKey || (typeof sessionDraft?.dateKey === "string" ? sessionDraft.dateKey : todayKey());
  const objectiveId = typeof session?.objectiveId === "string" ? session.objectiveId : null;
  const objective = objectiveId ? goals.find((g) => g.id === objectiveId) || null : null;
  const habitIds = Array.isArray(session?.habitIds)
    ? session.habitIds
    : Array.isArray(sessionDraft?.habitIds)
      ? sessionDraft.habitIds
      : [];
  const doneHabitIds = Array.isArray(session?.doneHabitIds) ? session.doneHabitIds : [];
  const doneSet = useMemo(() => new Set(doneHabitIds), [doneHabitIds]);
  const habits = habitIds.map((id) => goals.find((g) => g.id === id)).filter(Boolean);
  const categoryId = objective?.categoryId || habits[0]?.categoryId || null;
  const category = categories.find((c) => c.id === categoryId) || null;
  const accent = category?.color || getAccentForPage(safeData, "home");
  const catAccentVars = getCategoryAccentVars(accent);

  const startedAtMs = session?.startedAt ? new Date(session.startedAt).getTime() : NaN;
  const elapsedMs = Number.isFinite(startedAtMs) ? tick - startedAtMs : 0;
  const elapsedLabel = formatElapsed(elapsedMs);

  function toggleDone(habitId, checked) {
    if (!habitId || typeof setData !== "function") return;
    setData((prev) => {
      const prevSession = prev.ui?.activeSession;
      if (!prevSession) return prev;
      const list = Array.isArray(prevSession.doneHabitIds) ? [...prevSession.doneHabitIds] : [];
      const nextList = checked ? (list.includes(habitId) ? list : [...list, habitId]) : list.filter((id) => id !== habitId);
      return {
        ...prev,
        ui: { ...(prev.ui || {}), activeSession: { ...prevSession, doneHabitIds: nextList } },
      };
    });
  }

  function endSession() {
    if (!session || typeof setData !== "function") return;
    const finishedAt = new Date().toISOString();
    const duration = Math.max(0, Math.round(elapsedMs / 60000));
    const record = normalizeSession({
      id: uid(),
      objectiveId: objectiveId,
      date: dateKey,
      status: "done",
      duration,
      startedAt: session.startedAt,
      finishedAt,
      habitIds: habitIds,
      doneHabitIds: doneHabitIds,
    });

    setData((prev) => {
      let next = {
        ...prev,
        sessions: [...(prev.sessions || []), record],
        ui: { ...(prev.ui || {}), activeSession: null, sessionDraft: null },
      };

      const dateRef = new Date(`${dateKey}T12:00:00`);
      for (const id of doneHabitIds) {
        const latestChecks = next.checks || {};
        const latestBucket = latestChecks[dateKey];
        const dayBucket =
          latestBucket && typeof latestBucket === "object" ? { ...latestBucket } : {};
        const existingHabits = Array.isArray(dayBucket.habits) ? [...dayBucket.habits] : [];
        if (existingHabits.includes(id)) continue;

        next = incHabit(next, id, dateRef);

        const refreshedChecks = { ...(next.checks || {}) };
        dayBucket.habits = [...existingHabits, id];
        refreshedChecks[dateKey] = dayBucket;
        next.checks = refreshedChecks;
      }

      return next;
    });

    if (typeof onBack === "function") onBack();
  }

  function cancelSession() {
    if (typeof setData !== "function") return;
    setData((prev) => ({ ...prev, ui: { ...(prev.ui || {}), activeSession: null, sessionDraft: null } }));
    if (typeof onBack === "function") onBack();
  }

  if (!session && !sessionDraft) {
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
              <Button variant="ghost" onClick={onBack}>
                ← Retour
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
      headerSubtitle={category?.name || "Action"}
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
                          onChange={(e) => toggleDone(h.id, e.target.checked)}
                        />
                        <span>{doneSet.has(h.id) ? "Fait" : "À faire"}</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt12 small2">Aucune habitude sélectionnée.</div>
            )}
          </div>
        </Card>

        <div className="mt12 row" style={{ justifyContent: "flex-end", gap: 10 }}>
          <Button variant="ghost" onClick={cancelSession}>
            Annuler la session
          </Button>
          <Button onClick={endSession}>Terminer la session</Button>
        </div>
      </div>
    </ScreenShell>
  );
}
