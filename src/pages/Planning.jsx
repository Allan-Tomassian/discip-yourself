import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import DayRail from "../ui/calendar/DayRail";
import { addDays, startOfWeekKey } from "../utils/dates";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { resolveGoalType } from "../domain/goalType";
import {
  CATEGORY_VIEW,
  getSelectedCategoryForView,
  getVisibleCategories,
  resolvePreferredVisibleCategoryId,
} from "../domain/categoryVisibility";
import { collectSystemInboxBuckets } from "../domain/systemInboxMigration";
import { deriveTodayCalendarModel } from "../features/today/todayCalendarModel";

function sortOccurrences(left, right) {
  const a = typeof left?.start === "string" ? left.start : "";
  const b = typeof right?.start === "string" ? right.start : "";
  if (a !== b) return a.localeCompare(b);
  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

function formatDateLabel(dateKey) {
  if (!dateKey) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function buildWeekKeys(anchorDateKey) {
  const anchorDate = fromLocalDateKey(anchorDateKey) || new Date();
  const mondayKey = startOfWeekKey(anchorDate);
  const monday = fromLocalDateKey(mondayKey) || anchorDate;
  return Array.from({ length: 7 }, (_, index) => toLocalDateKey(addDays(monday, index)));
}

function resolveLoadTone(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "Journée vide";
  if (totalMinutes > 150) return "Charge forte";
  if (totalMinutes > 90) return "Charge soutenue";
  if (totalMinutes >= 30) return "Charge crédible";
  return "Charge légère";
}

export default function Planning({ data, setData, setTab }) {
  const safeData = data && typeof data === "object" ? data : {};
  const safeUi = safeData?.ui && typeof safeData.ui === "object" ? safeData.ui : {};
  const selectedDateKey =
    normalizeLocalDateKey(safeUi.selectedDateKey || safeUi.selectedDate) || todayLocalKey();
  const categories = useMemo(
    () => getVisibleCategories(safeData.categories),
    [safeData.categories]
  );
  const activeCategoryId = useMemo(
    () =>
      resolvePreferredVisibleCategoryId({
        categories,
        candidates: [
          getSelectedCategoryForView(safeUi, CATEGORY_VIEW.PLANNING),
          getSelectedCategoryForView(safeUi, CATEGORY_VIEW.TODAY),
        ],
      }),
    [categories, safeUi]
  );
  const planningView = safeUi.planningView === "week" ? "week" : "day";

  const goals = useMemo(
    () =>
      (Array.isArray(safeData.goals) ? safeData.goals : []).filter(
        (goal) => resolveGoalType(goal) === "PROCESS" && categories.some((category) => category.id === goal.categoryId)
      ),
    [categories, safeData.goals]
  );
  const goalsById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const goalIdSet = useMemo(() => new Set(goals.map((goal) => goal.id)), [goals]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const occurrences = useMemo(
    () =>
      (Array.isArray(safeData.occurrences) ? safeData.occurrences : []).filter((occurrence) =>
        goalIdSet.has(occurrence?.goalId)
      ),
    [goalIdSet, safeData.occurrences]
  );

  const plannedCalendarOccurrences = useMemo(() => {
    const list = [];
    for (const occurrence of occurrences) {
      if (!occurrence || occurrence.status !== "planned") continue;
      const dateKey = normalizeLocalDateKey(occurrence.date);
      if (!dateKey) continue;
      list.push({
        occ: occurrence?.date === dateKey ? occurrence : { ...occurrence, date: dateKey },
        goalId: occurrence.goalId,
        dateKey,
      });
    }
    return { list, mismatches: [] };
  }, [occurrences]);

  const calendarModel = useMemo(
    () =>
      deriveTodayCalendarModel({
        plannedCalendarOccurrences,
        occurrences,
        goalsById,
        categoriesById,
        goalIdSet,
        selectedDateKey,
        selectedCategoryId: activeCategoryId,
        fallbackAccent: categoriesById.get(activeCategoryId || "")?.color || "#F97316",
      }),
    [
      activeCategoryId,
      categoriesById,
      goalIdSet,
      goalsById,
      occurrences,
      plannedCalendarOccurrences,
      selectedDateKey,
    ]
  );

  const dayItems = useMemo(() => {
    return plannedCalendarOccurrences.list
      .filter((entry) => entry.dateKey === selectedDateKey)
      .map((entry) => {
        const goal = goalsById.get(entry.goalId) || null;
        const category = categoriesById.get(goal?.categoryId || "") || null;
        return {
          ...entry.occ,
          title: goal?.title || "Action",
          category,
        };
      })
      .filter((entry) => !activeCategoryId || entry.category?.id === activeCategoryId)
      .sort(sortOccurrences);
  }, [activeCategoryId, categoriesById, goalsById, plannedCalendarOccurrences.list, selectedDateKey]);

  const weekKeys = useMemo(() => buildWeekKeys(selectedDateKey), [selectedDateKey]);
  const weekBuckets = useMemo(() => {
    return weekKeys.map((dateKey) => {
      const items = plannedCalendarOccurrences.list
        .filter((entry) => entry.dateKey === dateKey)
        .map((entry) => {
          const goal = goalsById.get(entry.goalId) || null;
          const category = categoriesById.get(goal?.categoryId || "") || null;
          return {
            ...entry.occ,
            title: goal?.title || "Action",
            category,
          };
        })
        .filter((entry) => !activeCategoryId || entry.category?.id === activeCategoryId)
        .sort(sortOccurrences);
      const totalMinutes = items.reduce(
        (sum, item) => sum + (Number.isFinite(item.durationMinutes) ? item.durationMinutes : 0),
        0
      );
      return {
        dateKey,
        label: formatDateLabel(dateKey),
        items,
        totalMinutes,
      };
    });
  }, [activeCategoryId, categoriesById, goalsById, plannedCalendarOccurrences.list, weekKeys]);

  const selectedDayLoadMinutes = dayItems.reduce(
    (sum, item) => sum + (Number.isFinite(item.durationMinutes) ? item.durationMinutes : 0),
    0
  );
  const selectedDayTone = resolveLoadTone(selectedDayLoadMinutes);
  const legacyBuckets = useMemo(
    () => collectSystemInboxBuckets({ goals: safeData.goals, categories: safeData.categories }),
    [safeData.categories, safeData.goals]
  );

  const commitDateKey = (dateKey) => {
    if (!dateKey || typeof setData !== "function") return;
    setData((previous) => ({
      ...previous,
      ui: {
        ...(previous.ui || {}),
        selectedDateKey: dateKey,
        selectedDate: dateKey,
      },
    }));
  };

  const setPlanningView = (nextView) => {
    if (typeof setData !== "function") return;
    setData((previous) => ({
      ...previous,
      ui: {
        ...(previous.ui || {}),
        planningView: nextView === "week" ? "week" : "day",
      },
    }));
  };

  return (
    <ScreenShell
      data={safeData}
      pageId="planning"
      headerTitle="Planning"
      headerSubtitle="Répartis, ajuste et garde une charge crédible."
    >
      <div className="col" style={{ gap: 12 }}>
        {legacyBuckets.reclassifyCandidates.length > 0 ? (
          <Card accentBorder>
            <div className="p18 col" style={{ gap: 8 }}>
              <div className="titleSm">Éléments à reclasser</div>
              <div className="small">
                {legacyBuckets.reclassifyCandidates.length} action{legacyBuckets.reclassifyCandidates.length > 1 ? "s" : ""} héritée{legacyBuckets.reclassifyCandidates.length > 1 ? "s" : ""} ne remontent plus dans Today tant qu&apos;elles restent hors catégorie.
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button variant="ghost" onClick={() => setTab?.("library")}>
                  Ouvrir la bibliothèque
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <Card accentBorder>
          <div className="p18 col" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="titleSm">{formatDateLabel(selectedDateKey)}</div>
                <div className="small2" style={{ opacity: 0.85 }}>{selectedDayTone} · {selectedDayLoadMinutes || 0} min planifiées</div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button variant={planningView === "day" ? "primary" : "ghost"} onClick={() => setPlanningView("day")}>
                  Jour
                </Button>
                <Button variant={planningView === "week" ? "primary" : "ghost"} onClick={() => setPlanningView("week")}>
                  Semaine
                </Button>
                <Button variant="ghost" onClick={() => commitDateKey(todayLocalKey())}>
                  Aujourd&apos;hui
                </Button>
              </div>
            </div>

            <DayRail
              selectedDateKey={selectedDateKey}
              localTodayKey={todayLocalKey()}
              plannedByDate={calendarModel.plannedByDate}
              doneByDate={calendarModel.doneByDate}
              accentByDate={calendarModel.accentByDate}
              selectedAccent={calendarModel.selectedDateAccent}
              accent={calendarModel.selectedDateAccent}
              getDayDots={(dateKey, max = 3) => {
                const list = calendarModel.categoryDotsByDate.get(dateKey) || [];
                return { dots: list.slice(0, max), extra: Math.max(0, list.length - max) };
              }}
              onDayOpen={commitDateKey}
              onCommitDateKey={commitDateKey}
              isActive
              windowBefore={10}
              windowAfter={10}
            />
          </div>
        </Card>

        {planningView === "day" ? (
          <Card accentBorder>
            <div className="p18 col" style={{ gap: 10 }}>
              <div className="titleSm">Créneaux du jour</div>
              {dayItems.length ? (
                dayItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16,
                      padding: 12,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div className="small2" style={{ opacity: 0.8 }}>
                      {item.start || "Fenêtre libre"} · {item.category?.name || "Catégorie"}
                    </div>
                    <div className="titleSm">{item.title}</div>
                    <div className="small2" style={{ opacity: 0.85 }}>
                      {Number.isFinite(item.durationMinutes) ? `${item.durationMinutes} min` : "Durée libre"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="small">Aucun créneau planifié sur cette journée pour la catégorie active.</div>
              )}
            </div>
          </Card>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {weekBuckets.map((bucket) => (
              <Card key={bucket.dateKey} accentBorder>
                <div className="p18 col" style={{ gap: 10 }}>
                  <div>
                    <div className="titleSm">{bucket.label}</div>
                    <div className="small2" style={{ opacity: 0.85 }}>
                      {bucket.totalMinutes || 0} min · {resolveLoadTone(bucket.totalMinutes)}
                    </div>
                  </div>
                  {bucket.items.length ? (
                    bucket.items.slice(0, 4).map((item) => (
                      <div key={item.id} className="small" style={{ opacity: 0.92 }}>
                        {(item.start || "Fenêtre")} · {item.title}
                      </div>
                    ))
                  ) : (
                    <div className="small">Aucun créneau.</div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card accentBorder>
          <div className="p18 col" style={{ gap: 8 }}>
            <div className="titleSm">Ajustements intelligents</div>
            <div className="small">
              Planning s&apos;appuie sur l&apos;engine existant. Les replanifications IA restent proposées sous forme de brouillon avant application.
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setTab?.("coach-chat")}>
                Ouvrir le coach
              </Button>
              <Button variant="ghost" onClick={() => setTab?.("pilotage")}>
                Voir Pilotage
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
