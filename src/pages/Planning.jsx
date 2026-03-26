import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import CategoryPill from "../components/CategoryPill";
import PlanningCoachCard from "../components/planning/PlanningCoachCard";
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
import "../features/planning/planning.css";

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

export default function Planning({
  data,
  setData,
  setTab,
  persistenceScope = "local_fallback",
  onOpenCoach,
}) {
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
        isToday: dateKey === todayLocalKey(),
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
  const pendingOccurrenceId =
    typeof safeUi.planningPendingOccurrenceId === "string" ? safeUi.planningPendingOccurrenceId : "";
  const pendingOccurrence = pendingOccurrenceId
    ? occurrences.find((occurrence) => occurrence?.id === pendingOccurrenceId) || null
    : null;
  const pendingGoal = pendingOccurrence?.goalId ? goalsById.get(pendingOccurrence.goalId) || null : null;
  const pendingCategory = categoriesById.get(pendingGoal?.categoryId || "") || null;

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
  const clearPlanningPending = () => {
    if (typeof setData !== "function") return;
    setData((previous) => ({
      ...previous,
      ui: {
        ...(previous.ui || {}),
        planningPendingOccurrenceId: null,
        planningPendingIntent: null,
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
      <div className="col planningPage">
        {pendingOccurrence ? (
          <Card className="planningCard">
            <div className="p18 col" style={{ gap: 8 }}>
              <div className="titleSm">Occurrence à replanifier</div>
              <div className="small">
                {pendingGoal?.title || "Action"}{pendingCategory?.name ? ` · ${pendingCategory.name}` : ""}
              </div>
              <div className="small2" style={{ opacity: 0.82 }}>
                Déplace cette occurrence puis confirme ou annule ce brouillon de replanification.
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={clearPlanningPending}>
                  Annuler
                </Button>
                <Button onClick={clearPlanningPending}>
                  J&apos;ai replanifié
                </Button>
              </div>
            </div>
          </Card>
        ) : null}
        <PlanningCoachCard
          data={safeData}
          setData={setData}
          setTab={setTab}
          persistenceScope={persistenceScope}
          selectedDateKey={selectedDateKey}
          activeCategoryId={activeCategoryId}
          planningView={planningView}
          occurrences={occurrences}
          goalsById={goalsById}
          categoriesById={categoriesById}
        />
        {legacyBuckets.reclassifyCandidates.length > 0 ? (
          <Card className="planningCard">
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

        <Card className="planningCard">
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
          <Card className="planningCard">
            <div className="p18 col" style={{ gap: 10 }}>
              <div className="titleSm">Créneaux du jour</div>
              {dayItems.length ? (
                dayItems.map((item) => (
                  <div key={item.id} className="planningItemCard planningItemCard--day listItem GateRowPremium">
                    <div className="planningDayCardTop">
                      <div className="planningDayCardTime">{item.start || "Fenêtre libre"}</div>
                      <CategoryPill category={item.category || null} label={item.category?.name || "Catégorie"} />
                    </div>
                    <div className="titleSm planningDayCardTitle">{item.title}</div>
                    <div className="small2 planningDayCardDuration">
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
          <div className="planningWeekGrid">
            {weekBuckets.map((bucket) => (
              <Card key={bucket.dateKey} className="planningCard planningWeekCard">
                <div className="planningWeekCardBody">
                  <div className="planningWeekCardHeader">
                    <div className="planningWeekCardHeaderMain">
                      <div className="titleSm">{bucket.label}</div>
                      {bucket.isToday ? <span className="planningTodayTag">Aujourd’hui</span> : null}
                    </div>
                  </div>
                  <div>
                    <div className="small2" style={{ opacity: 0.85 }}>
                      {bucket.totalMinutes || 0} min · {resolveLoadTone(bucket.totalMinutes)}
                    </div>
                  </div>
                  {bucket.items.length ? (
                    <div className="planningWeekList">
                      {bucket.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="planningItemCard planningItemCard--week listItem GateRowPremium">
                          <div className="planningWeekItemTop">
                            <div className="planningWeekItemTime">{item.start || "Fenêtre libre"}</div>
                            <CategoryPill category={item.category || null} label={item.category?.name || "Catégorie"} />
                          </div>
                          <div className="planningWeekItemTitle">{item.title}</div>
                          <div className="planningWeekItemDuration">
                            {Number.isFinite(item.durationMinutes) ? `${item.durationMinutes} min` : "Durée libre"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="small">Aucun créneau.</div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="planningCard">
          <div className="p18 col" style={{ gap: 8 }}>
            <div className="titleSm">Ajustements intelligents</div>
            <div className="small">
              Planning s&apos;appuie sur l&apos;engine existant. Les replanifications IA restent proposées sous forme de brouillon avant application.
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => onOpenCoach?.()}>
                Ouvrir le coach
              </Button>
              <Button variant="ghost" onClick={() => setTab?.("pilotage")}>
                Voir mes progrès
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
