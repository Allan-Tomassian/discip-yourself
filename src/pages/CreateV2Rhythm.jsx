import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input } from "../components/UI";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_REVIEW } from "../creation/creationSchema";
import { resolveGoalType } from "../utils/goalType";
import { buildTimeWindow, windowsOverlap } from "../creation/collision";

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

function formatRange(time, durationMinutes) {
  const startMinutes = parseTimeToMinutes(time);
  if (startMinutes == null) return "—";
  const duration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0;
  return `${formatTime(startMinutes)}–${formatTime(startMinutes + duration)}`;
}

function getDayIdFromKey(key) {
  if (!key) return null;
  const parts = String(key).split("-");
  const value = Number(parts[1]);
  return Number.isFinite(value) ? value : null;
}

function buildWindows(item, timeOverride, meta = {}, daysOverride) {
  const days = Array.isArray(daysOverride) ? daysOverride : Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [];
  const time = timeOverride || item.time;
  const durationMinutes = Number.isFinite(item.durationMinutes) ? item.durationMinutes : 0;
  if (!days.length || !time || durationMinutes <= 0) return [];
  return days.map((day) => ({
    ...meta,
    itemId: item.id,
    dateKey: `dow-${day}`,
    time,
    durationMinutes,
  }));
}

function getDefaultRhythmItem(item) {
  if (item.type === "outcome") {
    const daysOfWeek = Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [1, 3, 5];
    return { ...item, daysOfWeek, time: "", durationMinutes: null };
  }
  const daysOfWeek = Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [];
  const time = item.time || "09:00";
  const durationMinutes =
    Number.isFinite(item.durationMinutes) && item.durationMinutes > 0 ? item.durationMinutes : 60;
  return { ...item, daysOfWeek, time, durationMinutes };
}

export default function CreateV2Rhythm({ data, setData, onBack, onNext, onCancel }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const [expandedConflicts, setExpandedConflicts] = useState({});
  const outcomes = Array.isArray(draft.outcomes) ? draft.outcomes : [];
  const habits = Array.isArray(draft.habits) ? draft.habits : [];
  const hasOutcomes = outcomes.length > 0;
  const hasHabits = habits.length > 0;

  const outcomeTitleById = useMemo(() => {
    const map = new Map();
    for (const outcome of outcomes) {
      const label =
        outcome?.mode === "existing"
          ? goals.find((g) => g.id === outcome.id)?.title
          : outcome?.title;
      map.set(outcome.id, label || "Objectif");
    }
    return map;
  }, [outcomes, goals]);

  const baseItems = useMemo(() => {
    const items = [];
    outcomes.forEach((outcome) => {
      if (!outcome?.id) return;
      items.push({
        id: outcome.id,
        type: "outcome",
        title: outcomeTitleById.get(outcome.id) || "Objectif",
      });
    });
    habits.forEach((h) => {
      items.push({
        id: h.id,
        type: "habit",
        title: h.title || "Action",
        outcomeId: h.outcomeId || "",
      });
    });
    return items;
  }, [outcomeTitleById, outcomes, habits]);

  useEffect(() => {
    if (hasOutcomes && hasHabits) return;
    if (typeof onBack === "function") onBack();
  }, [hasOutcomes, hasHabits, onBack]);

  const items = useMemo(() => {
    const stored = Array.isArray(draft?.rhythm?.items) ? draft.rhythm.items : [];
    const map = new Map(stored.map((item) => [item.id, item]));
    const legacyOutcome = stored.find((item) => item && item.id === "outcome");
    if (legacyOutcome && outcomes.length === 1 && !map.has(outcomes[0].id)) {
      map.set(outcomes[0].id, legacyOutcome);
    }
    return baseItems.map((item) => getDefaultRhythmItem({ ...item, ...(map.get(item.id) || {}) }));
  }, [baseItems, draft?.rhythm?.items, outcomes]);

  const categoryName =
    draft.category?.mode === "existing"
      ? categories.find((c) => c.id === draft.category.id)?.name
      : draft.category?.name || "";

  const outcomeDaysById = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (item.type !== "outcome") continue;
      map.set(item.id, Array.isArray(item.daysOfWeek) ? item.daysOfWeek : []);
    }
    return map;
  }, [items]);

  function getOutcomeDays(outcomeId) {
    return outcomeDaysById.get(outcomeId) || [];
  }

  function computeHasConflicts(nextItems) {
    const outcomeDays = new Map();
    for (const item of nextItems) {
      if (item.type !== "outcome") continue;
      outcomeDays.set(item.id, Array.isArray(item.daysOfWeek) ? item.daysOfWeek : []);
    }
    const draftWindows = [];
    for (const item of nextItems) {
      if (item.type !== "habit") continue;
      const linkedDays = outcomeDays.get(item.outcomeId) || [];
      draftWindows.push(...buildWindows(item, null, {}, linkedDays));
    }
    for (const window of draftWindows) {
      const windowMeta = buildTimeWindow(window);
      if (!windowMeta) continue;
      const others = [...existingWindows, ...draftWindows.filter((w) => w.itemId !== window.itemId)];
      for (const other of others) {
        const otherMeta = buildTimeWindow(other);
        if (windowsOverlap(windowMeta, otherMeta)) return true;
      }
    }
    return false;
  }

  function updateDraft(nextItems) {
    if (typeof setData !== "function") return;
    const hasConflicts = computeHasConflicts(nextItems);
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            rhythm: { items: nextItems, hasConflicts },
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
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
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
          windows.push({
            itemId: goal.id,
            dateKey: `dow-${day}`,
            time,
            durationMinutes: duration,
            title: goal.title || "Action",
            categoryName: categoryMap.get(goal.categoryId)?.name || "",
            source: "existing",
          });
        }
      }
    }
    return windows;
  }, [categories, goals]);

  const draftWindows = useMemo(() => {
    const windows = [];
    for (const item of items) {
      if (item.type !== "habit") continue;
      const linkedDays = getOutcomeDays(item.outcomeId);
      windows.push(
        ...buildWindows(item, null, {
          title: item.title || "Action",
          categoryName,
          source: "draft",
        }, linkedDays)
      );
    }
    return windows;
  }, [items, categoryName, outcomeDaysById]);

  const conflictMap = useMemo(() => {
    const conflicts = new Map();
    const allWindows = [...existingWindows, ...draftWindows];
    for (const window of draftWindows) {
      const windowMeta = buildTimeWindow(window);
      if (!windowMeta) continue;
      const others = allWindows.filter((w) => w.itemId !== window.itemId);
      const list = conflicts.get(window.itemId) || [];
      for (const other of others) {
        const otherMeta = buildTimeWindow(other);
        if (!windowsOverlap(windowMeta, otherMeta)) continue;
        list.push({
          dayId: getDayIdFromKey(window.dateKey),
          dayLabel: DOWS.find((d) => d.id === getDayIdFromKey(window.dateKey))?.label || "—",
          itemRange: formatRange(window.time, window.durationMinutes),
          conflictRange: formatRange(other.time, other.durationMinutes),
          conflictTitle: other.title || "Élément",
          conflictCategory: other.categoryName || "",
          conflictItemId: other.itemId,
        });
      }
      if (list.length) conflicts.set(window.itemId, list);
    }
    return conflicts;
  }, [draftWindows, existingWindows]);

  function suggestTimes(item) {
    const existing = [...existingWindows, ...draftWindows.filter((w) => w.itemId !== item.id)];
    const linkedDays = getOutcomeDays(item.outcomeId);

    const isCandidateOk = (candidateTime) => {
      const windows = buildWindows(item, candidateTime, {}, linkedDays);
      if (!windows.length) return false;
      return windows.every((w) => {
        const windowMeta = buildTimeWindow(w);
        if (!windowMeta) return true;
        return existing.every((other) => {
          const otherMeta = buildTimeWindow(other);
          if (!otherMeta) return true;
          return !windowsOverlap(windowMeta, otherMeta);
        });
      });
    };

    const suggestions = [];
    const startMinutes = parseTimeToMinutes(item.time) ?? 8 * 60;
    const STEP = 15;
    const MAX = 240;
    const MIN_DAY = 5 * 60;
    const MAX_DAY = 22 * 60;

    // Nearest available around the chosen time (prefer later if same distance)
    for (let offset = STEP; suggestions.length < 3 && offset <= MAX; offset += STEP) {
      const earlier = startMinutes - offset;
      const later = startMinutes + offset;

      // Prefer later first: keeps intent and avoids surprise "earlier" scheduling.
      if (later < MAX_DAY) {
        const t = formatTime(later);
        if (isCandidateOk(t)) suggestions.push(t);
      }

      if (suggestions.length >= 3) break;

      if (earlier >= MIN_DAY) {
        const t = formatTime(earlier);
        if (!suggestions.includes(t) && isCandidateOk(t)) suggestions.push(t);
      }
    }

    // If nothing found nearby, fall back to scanning forward by 30min (still never 00:00)
    for (let offset = 30; suggestions.length < 3 && offset <= 8 * 60; offset += 30) {
      const nextMinutes = startMinutes + offset;
      if (nextMinutes >= MAX_DAY) break;
      const candidateTime = formatTime(nextMinutes);
      if (!suggestions.includes(candidateTime) && isCandidateOk(candidateTime)) suggestions.push(candidateTime);
    }

    return suggestions;
  }

  const canContinue = useMemo(() => {
    if (!items.length || conflictMap.size) return false;
    const outcomeItems = items.filter((item) => item.type === "outcome");
    for (const outcome of outcomeItems) {
      const days = Array.isArray(outcome.daysOfWeek) ? outcome.daysOfWeek : [];
      if (!days.length) return false;
    }
    const habitItems = items.filter((item) => item.type === "habit");
    for (const habit of habitItems) {
      const days = getOutcomeDays(habit.outcomeId);
      const hasTime = Boolean(habit.time);
      const hasDuration = Number.isFinite(habit.durationMinutes) && habit.durationMinutes > 0;
      if (!hasTime || !hasDuration || !days.length) return false;
    }
    return true;
  }, [items, conflictMap, outcomeDaysById]);

  function handleNext() {
    if (!canContinue) return;
    updateDraft(items);
    if (typeof onNext === "function") onNext();
  }

  function toggleConflictView(itemId) {
    setExpandedConflicts((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function removeConflictDays(itemId, days) {
    if (!Array.isArray(days) || !days.length) return;
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    if (item.type === "habit" && item.outcomeId) {
      const outcomeItem = items.find((entry) => entry.id === item.outcomeId);
      if (!outcomeItem) return;
      const nextDays = (outcomeItem.daysOfWeek || []).filter((day) => !days.includes(day));
      updateItem(outcomeItem.id, { daysOfWeek: nextDays });
      return;
    }
    const nextDays = (item.daysOfWeek || []).filter((day) => !days.includes(day));
    updateItem(itemId, { daysOfWeek: nextDays });
  }

  function reduceDuration(itemId) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const current = Number.isFinite(item.durationMinutes) ? item.durationMinutes : 60;
    const next = Math.max(10, current - 15);
    updateItem(itemId, { durationMinutes: next });
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
              const conflictDetails = conflictMap.get(item.id) || [];
              const conflictItemIds = new Set(conflictDetails.map((c) => c.conflictItemId));
              const conflictDays = Array.from(
                new Set(conflictDetails.map((c) => c.dayId).filter((day) => Number.isFinite(day)))
              );
              const suggestions = conflictDetails.length ? suggestTimes(item) : [];
              const isOutcome = item.type === "outcome";
              const isExpanded = Boolean(expandedConflicts[item.id]);
              const linkedDays = !isOutcome ? getOutcomeDays(item.outcomeId) : [];
              const linkedDayLabels = linkedDays
                .map((day) => DOWS.find((d) => d.id === day)?.label)
                .filter(Boolean);
              const linkedOutcomeLabel = !isOutcome ? outcomeTitleById.get(item.outcomeId) || "Objectif" : "";
              return (
                <div key={item.id} className="listItem" style={{ padding: 12 }}>
                  <div className="titleSm" style={{ marginBottom: 8 }}>
                    {item.title}
                  </div>
                  {isOutcome ? (
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
                  ) : (
                    <div className="stack stackGap6">
                      <div className="small2">
                        Objectif: {linkedOutcomeLabel}
                      </div>
                      <div className="small2">
                        Jours: {linkedDayLabels.length ? linkedDayLabels.join(", ") : "Définis dans l’objectif"}
                      </div>
                    </div>
                  )}
                  {isOutcome ? null : (
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
                  )}
                  {conflictDetails.length ? (
                    <div style={{ marginTop: 8 }}>
                      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="pill active">⚠︎ Conflit</span>
                        <div className="small2">Conflit avec {conflictItemIds.size} élément(s)</div>
                        <Button variant="ghost" onClick={() => toggleConflictView(item.id)}>
                          {isExpanded ? "Masquer" : "Voir"}
                        </Button>
                      </div>
                      {isExpanded ? (
                        <div className="stack stackGap6" style={{ marginTop: 8 }}>
                          {conflictDetails.map((detail, index) => (
                            <div key={`${detail.conflictItemId}-${detail.dayId}-${index}`} className="small2">
                              <span style={{ fontWeight: 600 }}>{detail.dayLabel}</span>{" "}
                              {detail.itemRange} · {detail.conflictRange} · {detail.conflictTitle}
                              {detail.conflictCategory ? ` · ${detail.conflictCategory}` : ""}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {isOutcome ? null : (
                        <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          {suggestions.length ? (
                            <Button
                              variant="primary"
                              onClick={() => updateItem(item.id, { time: suggestions[0] })}
                            >
                              Prochain horaire libre: {suggestions[0]}
                            </Button>
                          ) : null}

                          {suggestions.slice(1).map((time) => (
                            <Button key={time} variant="ghost" onClick={() => updateItem(item.id, { time })}>
                              Alternative: {time}
                            </Button>
                          ))}
                          <Button variant="ghost" onClick={() => reduceDuration(item.id)}>
                            Réduire durée
                          </Button>
                          <Button variant="ghost" onClick={() => removeConflictDays(item.id, conflictDays)}>
                            Retirer jours en conflit
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="ghost"
                onClick={() => {
                  if (typeof onCancel === "function") {
                    onCancel();
                    return;
                  }
                  if (typeof onBack === "function") onBack();
                }}
              >
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
