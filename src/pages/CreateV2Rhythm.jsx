import React, { useEffect, useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input } from "../components/UI";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_REVIEW } from "../creation/creationSchema";
import { resolveGoalType } from "../utils/goalType";
import { hasCollision } from "../creation/collision";

const DOWS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mer" },
  { id: 4, label: "Jeu" },
  { id: 5, label: "Ven" },
  { id: 6, label: "Sam" },
  { id: 7, label: "Dim" },
];

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;
  const [h, m] = value.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function buildWindows(item, timeOverride) {
  const days = Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [];
  const time = timeOverride || item.time;
  const durationMinutes = Number.isFinite(item.durationMinutes) ? item.durationMinutes : 0;
  if (!days.length || !time || durationMinutes <= 0) return [];
  return days.map((day) => ({
    itemId: item.id,
    dateKey: `dow-${day}`,
    time,
    durationMinutes,
  }));
}

function getDefaultRhythmItem(item) {
  return {
    ...item,
    daysOfWeek: [1, 3, 5],
    time: "09:00",
    durationMinutes: 60,
  };
}

export default function CreateV2Rhythm({ data, setData, onBack, onNext }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const hasOutcome =
    draft?.outcome?.mode === "existing"
      ? Boolean(draft.outcome.id)
      : Boolean((draft?.outcome?.title || "").trim());
  const hasHabits = Array.isArray(draft.habits) && draft.habits.length > 0;

  const outcomeTitle = draft.outcome?.mode === "existing"
    ? goals.find((g) => g.id === draft.outcome?.id)?.title
    : draft.outcome?.title;

  const baseItems = useMemo(() => {
    const items = [];
    if (draft.outcome) {
      items.push({
        id: "outcome",
        type: "outcome",
        title: outcomeTitle || "Objectif",
      });
    }
    const habits = Array.isArray(draft.habits) ? draft.habits : [];
    habits.forEach((h) => {
      items.push({ id: h.id, type: "habit", title: h.title || "Habitude" });
    });
    return items;
  }, [draft.outcome, draft.habits, outcomeTitle]);

  useEffect(() => {
    if (hasOutcome && hasHabits) return;
    if (typeof onBack === "function") onBack();
  }, [hasOutcome, hasHabits, onBack]);

  const items = useMemo(() => {
    const stored = Array.isArray(draft?.rhythm?.items) ? draft.rhythm.items : [];
    const map = new Map(stored.map((item) => [item.id, item]));
    return baseItems.map((item) => getDefaultRhythmItem({ ...item, ...(map.get(item.id) || {}) }));
  }, [baseItems, draft?.rhythm?.items]);

  function updateDraft(nextItems) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            rhythm: { items: nextItems },
            step: STEP_REVIEW,
          },
        },
      };
    });
  }

  function updateItem(id, patch) {
    const nextItems = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    updateDraft(nextItems);
  }

  const existingWindows = useMemo(() => {
    const windows = [];
    for (const goal of goals) {
      if (!goal || resolveGoalType(goal) !== "PROCESS") continue;
      const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
      if (!schedule) continue;
      const timeSlots = Array.isArray(schedule.timeSlots) ? schedule.timeSlots.filter(Boolean) : [];
      if (!timeSlots.length) continue;
      const duration =
        Number.isFinite(schedule.durationMinutes) && schedule.durationMinutes > 0
          ? schedule.durationMinutes
          : Number.isFinite(goal.sessionMinutes)
            ? goal.sessionMinutes
            : 60;
      const days = Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length ? schedule.daysOfWeek : DOWS.map((d) => d.id);
      for (const day of days) {
        for (const time of timeSlots) {
          windows.push({ itemId: goal.id, dateKey: `dow-${day}`, time, durationMinutes: duration });
        }
      }
    }
    return windows;
  }, [goals]);

  const draftWindows = useMemo(() => {
    const windows = [];
    for (const item of items) windows.push(...buildWindows(item));
    return windows;
  }, [items]);

  const conflictMap = useMemo(() => {
    const conflicts = new Map();
    const allWindows = [...existingWindows, ...draftWindows];
    for (const window of draftWindows) {
      const others = allWindows.filter((w) => w.itemId !== window.itemId);
      if (hasCollision(window, others)) {
        const list = conflicts.get(window.itemId) || [];
        list.push(window);
        conflicts.set(window.itemId, list);
      }
    }
    return conflicts;
  }, [draftWindows, existingWindows]);

  function suggestTimes(item) {
    const existing = [...existingWindows, ...draftWindows.filter((w) => w.itemId !== item.id)];
    const suggestions = [];
    const startMinutes = parseTimeToMinutes(item.time) || 8 * 60;
    for (let offset = 30; suggestions.length < 3 && offset <= 240; offset += 30) {
      const nextMinutes = startMinutes + offset;
      if (nextMinutes >= 22 * 60) break;
      const candidateTime = formatTime(nextMinutes);
      const windows = buildWindows(item, candidateTime);
      const ok = windows.every((w) => !hasCollision(w, existing));
      if (ok) suggestions.push(candidateTime);
    }
    return suggestions;
  }

  const canContinue = items.length > 0 && !conflictMap.size;
  function handleNext() {
    if (!canContinue) return;
    updateDraft(items);
    if (typeof onNext === "function") onNext();
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span style={{ opacity: 0.6 }}>4.</span> Rythme
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 14 }}>
            {items.map((item) => {
              const conflicts = conflictMap.get(item.id) || [];
              const suggestions = conflicts.length ? suggestTimes(item) : [];
              return (
                <div key={item.id} className="listItem" style={{ padding: 12 }}>
                  <div className="titleSm" style={{ marginBottom: 8 }}>
                    {item.title}
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    {DOWS.map((d) => {
                      const active = item.daysOfWeek.includes(d.id);
                      return (
                        <Button
                          key={d.id}
                          variant={active ? "primary" : "ghost"}
                          onClick={() => {
                            const next = active
                              ? item.daysOfWeek.filter((val) => val !== d.id)
                              : [...item.daysOfWeek, d.id].sort();
                            updateItem(item.id, { daysOfWeek: next });
                          }}
                        >
                          {d.label}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 140px" }}>
                      <div className="small" style={{ marginBottom: 6 }}>
                        Heure
                      </div>
                      <Input
                        type="time"
                        value={item.time}
                        onChange={(e) => updateItem(item.id, { time: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: "1 1 120px" }}>
                      <div className="small" style={{ marginBottom: 6 }}>
                        Durée (min)
                      </div>
                      <Input
                        type="number"
                        min={10}
                        max={240}
                        value={item.durationMinutes}
                        onChange={(e) => updateItem(item.id, { durationMinutes: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  {conflicts.length ? (
                    <div className="small2" style={{ marginTop: 8 }}>
                      Conflit détecté. Suggestions: {suggestions.length ? suggestions.join(" · ") : "Aucune"}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button variant="ghost" onClick={onBack}>
                Annuler
              </Button>
              <Button onClick={handleNext} disabled={!canContinue}>
                Continuer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
