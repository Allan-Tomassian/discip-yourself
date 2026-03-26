import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import CategoryPill from "../components/CategoryPill";
import PlanningCoachCard from "../components/planning/PlanningCoachCard";
import DayRail from "../ui/calendar/DayRail";
import { GateButton as Button, GateSection } from "../shared/ui/gate/Gate";
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

  const planningSectionTitle = planningView === "week" ? "Semaine planifiée" : "Créneaux du jour";
  const planningSectionDescription =
    planningView === "week"
      ? "Relis ta charge prévue jour par jour, sans effet tableau de bord."
      : "Lecture rapide de la journée, avec la même densité que Today.";

  return (
    <ScreenShell
      data={safeData}
      pageId="planning"
      headerTitle="Planning"
      headerSubtitle="Répartis, ajuste et garde une charge crédible."
    >
      <div className="col planningPage">
        <GateSection className="planningSectionCard planningCalendarSection GateSurfacePremium GateCardPremium" collapsible={false}>
          <div className="planningSectionBody">
            <div className="planningSectionHeader planningSectionHeader--split">
              <div className="planningSectionHeaderText">
                <div className="titleSm">{formatDateLabel(selectedDateKey)}</div>
                <div className="small2 planningSectionMeta">
                  {selectedDayTone} · {selectedDayLoadMinutes || 0} min planifiées
                </div>
              </div>
              <div className="planningSectionActions">
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

            <div className="planningCalendarRail">
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
          </div>
        </GateSection>

        <GateSection
          className="planningSectionCard planningContentSection GateSurfacePremium GateCardPremium"
          title={planningSectionTitle}
          description={planningSectionDescription}
          collapsible={false}
        >
          {planningView === "day" ? (
            <div className="planningDayList">
              {dayItems.length ? (
                dayItems.map((item) => (
                  <div key={item.id} className="planningItemRow listItem GateRowPremium">
                    <div className="planningItemRowTop">
                      <div className="planningItemTime">{item.start || "Fenêtre libre"}</div>
                      <CategoryPill category={item.category || null} label={item.category?.name || "Catégorie"} />
                    </div>
                    <div className="titleSm planningItemTitle">{item.title}</div>
                    <div className="small2 planningItemDuration">
                      {Number.isFinite(item.durationMinutes) ? `${item.durationMinutes} min` : "Durée libre"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="small2 planningEmptyState">
                  Aucun créneau planifié sur cette journée pour la catégorie active.
                </div>
              )}
            </div>
          ) : (
            <div className="planningWeekGrid">
              {weekBuckets.map((bucket) => (
                <div
                  key={bucket.dateKey}
                  className={`planningWeekBucket${bucket.isToday ? " isToday" : ""}`}
                >
                  <div className="planningWeekBucketHeader">
                    <div className="planningWeekBucketHeaderMain">
                      <div className="titleSm">{bucket.label}</div>
                      {bucket.isToday ? <span className="planningTodayTag">Aujourd’hui</span> : null}
                    </div>
                    <div className="small2 planningWeekBucketMeta">
                      {bucket.totalMinutes || 0} min · {resolveLoadTone(bucket.totalMinutes)}
                    </div>
                  </div>
                  {bucket.items.length ? (
                    <div className="planningWeekList">
                      {bucket.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="planningItemRow planningItemRow--compact listItem GateRowPremium">
                          <div className="planningItemRowTop">
                            <div className="planningItemTime">{item.start || "Fenêtre libre"}</div>
                            <CategoryPill category={item.category || null} label={item.category?.name || "Catégorie"} />
                          </div>
                          <div className="planningItemTitle">{item.title}</div>
                          <div className="planningItemDuration">
                            {Number.isFinite(item.durationMinutes) ? `${item.durationMinutes} min` : "Durée libre"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="small2 planningEmptyState">Aucun créneau.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GateSection>

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

        <GateSection
          className="planningSectionCard planningSupportSection GateSurfacePremium GateCardPremium"
          title="Ajustements intelligents"
          description="Planning s’appuie sur l’engine existant. Les replanifications IA restent proposées sous forme de brouillon avant application."
          collapsible={false}
        >
          <div className="planningSectionFooter">
            <Button variant="ghost" onClick={() => onOpenCoach?.()}>
              Ouvrir le coach
            </Button>
            <Button variant="ghost" onClick={() => setTab?.("pilotage")}>
              Voir mes progrès
            </Button>
          </div>
        </GateSection>

        {pendingOccurrence ? (
          <GateSection
            className="planningSectionCard planningSecondarySection GateSurfacePremium GateCardPremium"
            title="Occurrence à replanifier"
            description={`${pendingGoal?.title || "Action"}${pendingCategory?.name ? ` · ${pendingCategory.name}` : ""}`}
            collapsible={false}
          >
            <div className="small2 planningSectionMeta">
              Déplace cette occurrence puis confirme ou annule ce brouillon de replanification.
            </div>
            <div className="planningSectionFooter">
              <Button variant="ghost" onClick={clearPlanningPending}>
                Annuler
              </Button>
              <Button onClick={clearPlanningPending}>
                J&apos;ai replanifié
              </Button>
            </div>
          </GateSection>
        ) : null}

        {legacyBuckets.reclassifyCandidates.length > 0 ? (
          <GateSection
            className="planningSectionCard planningSecondarySection GateSurfacePremium GateCardPremium"
            title="Éléments à reclasser"
            description={`${legacyBuckets.reclassifyCandidates.length} action${legacyBuckets.reclassifyCandidates.length > 1 ? "s" : ""} héritée${legacyBuckets.reclassifyCandidates.length > 1 ? "s" : ""} restent hors catégorie.`}
            collapsible={false}
          >
            <div className="small2 planningSectionMeta">
              Elles ne remontent plus dans Today tant qu&apos;elles restent hors catégorie.
            </div>
            <div className="planningSectionFooter">
              <Button variant="ghost" onClick={() => setTab?.("library")}>
                Ouvrir la bibliothèque
              </Button>
            </div>
          </GateSection>
        ) : null}
      </div>
    </ScreenShell>
  );
}
