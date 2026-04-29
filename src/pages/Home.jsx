import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppScreen } from "../shared/ui/app";
import "../features/today/today.css";
import { addDays } from "../utils/dates";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { backfillMissedOccurrences, ensureWindowFromScheduleRules } from "../logic/occurrencePlanner";
import { resolveRuntimeSessionGate } from "../logic/sessionRuntime";
import TodayHeader from "../components/today/TodayHeader";
import FloatingWelcomeLine from "../components/today/FloatingWelcomeLine";
import TodayHero from "../components/today/TodayHero";
import PrimaryActionCard from "../components/today/PrimaryActionCard";
import TodayTimeline from "../components/today/TodayTimeline";
import AIInsightCard from "../components/today/AIInsightCard";
import ProfileMenu from "../components/today/ProfileMenu";
import { useAuth } from "../auth/useAuth";
import { useProfile } from "../profile/useProfile";
import { resolveTodayOccurrenceStartPolicy } from "../domain/todayIntervention";
import { deriveTodayNowModel } from "../features/today/nowModel";
import {
  buildTodayData,
  getTodayVisualSmokeModel as getTodayDataVisualSmokeModel,
} from "../features/today/todayDataAdapter";
import { buildTodayManualAiContextKey } from "../features/manualAi/manualAiAnalysis";
import { useManualAiAnalysis } from "../hooks/useManualAiAnalysis";
import {
  CATEGORY_VIEW,
  getSelectedCategoryForView,
  getVisibleCategories,
  resolvePreferredVisibleCategoryId,
  withExecutionActiveCategoryId,
} from "../domain/categoryVisibility";

const TODAY_EXECUTION_GREEN = "#35f06d";

function sortOccurrencesByTime(left, right) {
  const leftStart = typeof left?.start === "string" ? left.start : "";
  const rightStart = typeof right?.start === "string" ? right.start : "";
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

export default function Home({
  data,
  setData,
  dataLoading = false,
  dataLoadError = "",
  hasCachedData = false,
  persistenceScope = "local_fallback",
  onOpenLibrary,
  onOpenCoachGuided,
  onOpenSecondaryRoute,
  onOpenPlanning,
  onOpenSession,
}) {
  const safeData = useMemo(() => (data && typeof data === "object" ? data : {}), [data]);
  const legacyPendingDateKey = safeData.ui?.pendingDateKey;
  const selectedDateKey =
    normalizeLocalDateKey(safeData.ui?.selectedDateKey || safeData.ui?.selectedDate || legacyPendingDateKey) ||
    todayLocalKey();
  const localTodayKey = todayLocalKey();
  const auth = useAuth();
  const { session, signOut } = auth;
  const profileState = useProfile();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine !== false;
  });

  useEffect(() => {
    if (selectedDateKey === localTodayKey || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      ui: {
        ...(prev?.ui || {}),
        selectedDateKey: localTodayKey,
        selectedDate: localTodayKey,
      },
    }));
  }, [localTodayKey, selectedDateKey, setData]);

  useEffect(() => {
    if (!legacyPendingDateKey || typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      if (!prevUi.pendingDateKey) return prev;
      const nextUi = { ...prevUi };
      delete nextUi.pendingDateKey;
      if (!nextUi.selectedDateKey) nextUi.selectedDateKey = prevUi.pendingDateKey;
      if (!nextUi.selectedDate) nextUi.selectedDate = prevUi.pendingDateKey;
      return {
        ...prev,
        ui: nextUi,
      };
    });
  }, [legacyPendingDateKey, setData]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateOnlineState = () => {
      setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine !== false);
    };
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const homeSelectedCategoryIdRaw = getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY);
  const homeSelectedCategoryId = useMemo(
    () =>
      resolvePreferredVisibleCategoryId({
        categories,
        candidates: [homeSelectedCategoryIdRaw, safeData.ui?.selectedCategoryId],
      }),
    [categories, homeSelectedCategoryIdRaw, safeData.ui?.selectedCategoryId]
  );
  const goals = useMemo(
    () =>
      (Array.isArray(safeData.goals) ? safeData.goals : []).filter(
        (goal) => goal?.categoryId && categories.some((category) => category.id === goal.categoryId)
      ),
    [categories, safeData.goals]
  );
  const goalsById = useMemo(() => {
    const map = new Map();
    for (const goal of goals) {
      if (goal?.id) map.set(goal.id, goal);
    }
    return map;
  }, [goals]);
  const occurrences = useMemo(
    () => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []),
    [safeData.occurrences]
  );
  const goalIdSet = useMemo(() => new Set(goals.map((goal) => goal?.id).filter(Boolean)), [goals]);
  const plannedCalendarOccurrences = useMemo(() => {
    const list = [];
    const mismatches = [];
    for (const occurrence of occurrences) {
      if (!occurrence || occurrence.status !== "planned") continue;
      const goalId = typeof occurrence.goalId === "string" ? occurrence.goalId : "";
      if (!goalIdSet.has(goalId)) continue;
      const rawDate = typeof occurrence.date === "string" ? occurrence.date : "";
      const dateKey = normalizeLocalDateKey(rawDate);
      if (!dateKey) continue;
      list.push({ occ: occurrence, goalId, dateKey });
      if (rawDate && rawDate !== dateKey) {
        mismatches.push({ id: occurrence.id || "", rawDate, dateKey });
      }
    }
    return { list, mismatches };
  }, [goalIdSet, occurrences]);

  const calendarDateInvariantLogRef = useRef(new Set());
  useEffect(() => {
    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    if (!isDev || typeof console === "undefined") return;
    for (const item of plannedCalendarOccurrences.mismatches) {
      const sig = `${item.id}|${item.rawDate}|${item.dateKey}`;
      if (calendarDateInvariantLogRef.current.has(sig)) continue;
      calendarDateInvariantLogRef.current.add(sig);
      // eslint-disable-next-line no-console
      console.warn(
        `[calendar-datekey-invariant] occurrence=${item.id || "unknown"} rawDate=${item.rawDate} cellDate=${item.dateKey}`
      );
    }
  }, [plannedCalendarOccurrences.mismatches]);

  const plannedOccurrencesForDay = useMemo(
    () =>
      plannedCalendarOccurrences.list
        .filter((entry) => entry.dateKey === selectedDateKey)
        .map((entry) => (entry.occ?.date === entry.dateKey ? entry.occ : { ...entry.occ, date: entry.dateKey })),
    [plannedCalendarOccurrences, selectedDateKey]
  );

  const rawActiveSession =
    safeData.ui && typeof safeData.ui.activeSession === "object" ? safeData.ui.activeSession : null;
  const todayNowModel = useMemo(
    () =>
      deriveTodayNowModel({
        categories,
        goals,
        selectedCategoryId: homeSelectedCategoryId,
        rawActiveSession,
        selectedDateKey,
        focusOverride: null,
        plannedOccurrencesForDay,
      }),
    [categories, goals, homeSelectedCategoryId, plannedOccurrencesForDay, rawActiveSession, selectedDateKey]
  );
  const {
    activeDate,
    activeSessionForActiveDate,
    focusCategory,
    selectedCategoryId: executionCategoryId,
    ensureProcessIds,
  } = todayNowModel;

  const todayAnalysisContextKey = useMemo(
    () =>
      buildTodayManualAiContextKey({
        userId: session?.user?.id || "",
        dateKey: activeDate || selectedDateKey,
        activeCategoryId: executionCategoryId,
      }),
    [activeDate, executionCategoryId, selectedDateKey, session?.user?.id]
  );
  const manualTodayAnalysis = useManualAiAnalysis({
    data: safeData,
    setData,
    contextKey: todayAnalysisContextKey,
    surface: "today",
  });

  const occurrencesForSelectedDay = useMemo(() => {
    const list = [];
    for (const occurrence of occurrences) {
      if (!occurrence) continue;
      const dateKey = normalizeLocalDateKey(occurrence.date);
      if (!dateKey || dateKey !== selectedDateKey) continue;
      list.push(occurrence.date === dateKey ? occurrence : { ...occurrence, date: dateKey });
    }
    return list.slice().sort(sortOccurrencesByTime);
  }, [occurrences, selectedDateKey]);

  useEffect(() => {
    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    if (!isDev) return;
    for (const occurrence of occurrencesForSelectedDay) {
      if (goalsById.has(occurrence.goalId)) continue;
      // eslint-disable-next-line no-console
      console.log("[orphan occurrence skipped]", occurrence);
    }
  }, [goalsById, occurrencesForSelectedDay]);

  const handleStartSession = useCallback(
    (item) => {
      if (!item) return;
      if (item.intent === "open_planning") {
        onOpenPlanning?.();
        return;
      }
      if (item.intent === "open_objectives") {
        onOpenLibrary?.();
        return;
      }
      const occurrence = item.occurrence || item;
      if (!occurrence?.id) return;
      const startPolicy = resolveTodayOccurrenceStartPolicy({
        activeDate: selectedDateKey,
        systemToday: localTodayKey,
        occurrenceDate: occurrence.date || "",
      });
      if (!startPolicy.canStartDirectly) return;
      const gate = resolveRuntimeSessionGate(safeData, { occurrenceId: occurrence.id });
      if (gate.status !== "ready" && gate.activeSession?.occurrenceId) {
        const activeOccurrence =
          occurrences.find((entry) => entry?.id === gate.activeSession.occurrenceId) || null;
        const activeGoal = activeOccurrence?.goalId ? goalsById.get(activeOccurrence.goalId) || null : null;
        onOpenSession?.({
          categoryId: activeGoal?.categoryId || null,
          dateKey: gate.activeSession.dateKey || activeOccurrence?.date || selectedDateKey,
          occurrenceId: gate.activeSession.occurrenceId || null,
        });
        return;
      }
      const goal = occurrence.goalId ? goalsById.get(occurrence.goalId) || null : null;
      onOpenSession?.({
        categoryId: goal?.categoryId || null,
        dateKey: occurrence.date || selectedDateKey,
        occurrenceId: occurrence.id || null,
      });
    },
    [goalsById, localTodayKey, occurrences, onOpenLibrary, onOpenPlanning, onOpenSession, safeData, selectedDateKey]
  );

  const lastEnsureSigRef = useRef("");
  const ensureDebugCountRef = useRef(0);
  useEffect(() => {
    if (!selectedDateKey || typeof setData !== "function") return;
    const sortedIds = Array.isArray(ensureProcessIds) ? ensureProcessIds.filter(Boolean).slice().sort() : [];
    const sig = `${selectedDateKey}:${sortedIds.join(",")}`;
    if (lastEnsureSigRef.current === sig) return;
    lastEnsureSigRef.current = sig;

    setData((prev) => {
      let next = prev;
      if (sortedIds.length) {
        const baseDate = fromLocalDateKey(selectedDateKey);
        const fromKey = baseDate ? toLocalDateKey(addDays(baseDate, -1)) : selectedDateKey;
        const toKey = baseDate ? toLocalDateKey(addDays(baseDate, 1)) : selectedDateKey;
        next = ensureWindowFromScheduleRules(next, fromKey, toKey, sortedIds);
      }
      next = backfillMissedOccurrences(next);
      if (import.meta.env?.DEV && next !== prev) {
        ensureDebugCountRef.current += 1;
        // eslint-disable-next-line no-console
        console.debug("[home] ensureWindowFromScheduleRules", { sig, count: ensureDebugCountRef.current });
      }
      return next;
    });
  }, [ensureProcessIds, selectedDateKey, setData]);

  const openPlanningForToday = useCallback(() => {
    if (typeof setData === "function") {
      setData((prev) => ({
        ...prev,
        ui: withExecutionActiveCategoryId(
          {
            ...(prev?.ui || {}),
            selectedDateKey: localTodayKey,
            selectedDate: localTodayKey,
          },
          executionCategoryId || focusCategory?.id || getSelectedCategoryForView(prev, CATEGORY_VIEW.TODAY) || null
        ),
      }));
    }
    onOpenPlanning?.();
  }, [executionCategoryId, focusCategory?.id, localTodayKey, onOpenPlanning, setData]);

  const openCoachInsight = useCallback(
    (prefill = "Explique-moi l’insight de ma journée et le prochain ajustement utile.") => {
      onOpenCoachGuided?.({
        mode: "free",
        prefill,
      });
    },
    [onOpenCoachGuided]
  );

  const openCoachPlan = useCallback(
    (prefill = "Aide-moi à construire le prochain bloc de ma journée.") => {
      onOpenCoachGuided?.({
        mode: "plan",
        prefill,
      });
    },
    [onOpenCoachGuided]
  );

  const visualSmokeModel = getTodayDataVisualSmokeModel();
  const todayData = buildTodayData({
    data: safeData,
    auth,
    profile: profileState,
    manualTodayAnalysis,
    persistenceScope,
    selectedDateKey,
    now: new Date(),
    dataLoading,
    dataLoadError,
    hasCachedData,
    isOnline,
    visualSmokeModel,
  });
  const todayCockpitClassName = [
    "todayCockpitScreen",
    todayData.state ? `today-state-${todayData.state}` : "",
    todayData.tone ? `today-tone-${todayData.tone}` : "",
    todayData.motionIntensity ? `today-motion-${todayData.motionIntensity}` : "",
    todayData.isRefreshing ? "is-refreshing" : "",
    todayData.flags?.offline ? "is-offline" : "",
    todayData.flags?.error ? "has-state-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const runPrimaryCockpitAction = useCallback(() => {
    const action = todayData.primaryAction || {};
    if (action.canPrimary === false) return;
    if (action.status === "in_progress" || activeSessionForActiveDate?.occurrenceId) {
      onOpenSession?.({
        categoryId: action.actionId ? goalsById.get(action.actionId)?.categoryId || executionCategoryId || focusCategory?.id || null : executionCategoryId || focusCategory?.id || null,
        dateKey: selectedDateKey,
        occurrenceId: activeSessionForActiveDate?.occurrenceId || action.occurrenceId || null,
      });
      return;
    }
    if (action.occurrenceId) {
      const occurrence = occurrences.find((item) => item?.id === action.occurrenceId) || null;
      if (occurrence) {
        handleStartSession(occurrence);
        return;
      }
    }
    if (action.status === "empty" || todayData.state === "empty_day") {
      openCoachPlan("Aide-moi à construire le prochain bloc de ma journée sans créer une action à la main.");
      return;
    }
    openCoachPlan();
  }, [
    activeSessionForActiveDate?.occurrenceId,
    executionCategoryId,
    focusCategory?.id,
    goalsById,
    handleStartSession,
    occurrences,
    onOpenSession,
    openCoachPlan,
    selectedDateKey,
    todayData.primaryAction,
    todayData.state,
  ]);

  const handlePrimarySecondary = useCallback(() => {
    const label = String(todayData.primaryAction?.secondaryLabel || "").toLowerCase();
    if (label.includes("réduire") || label.includes("coach")) {
      openCoachPlan("Aide-moi à réduire ou ajuster le prochain bloc sans ajouter de bruit.");
      return;
    }
    openPlanningForToday();
  }, [openCoachPlan, openPlanningForToday, todayData.primaryAction?.secondaryLabel]);

  const handlePrimaryDetail = useCallback(() => {
    const label = String(todayData.primaryAction?.detailLabel || "").toLowerCase();
    if (label.includes("coach")) {
      openCoachInsight("Aide-moi à ajuster la journée depuis le bloc principal.");
      return;
    }
    if (label.includes("support")) {
      onOpenSecondaryRoute?.("support");
      return;
    }
    openPlanningForToday();
  }, [onOpenSecondaryRoute, openCoachInsight, openPlanningForToday, todayData.primaryAction?.detailLabel]);

  return (
    <>
      <AppScreen
        accent={todayData.accent || TODAY_EXECUTION_GREEN}
        pageId="today"
        className={todayCockpitClassName}
      >
        <div className="todayCockpitShell" data-tour-id="today-title">
          <TodayHeader
            dateLabel={todayData.header.dateLabel}
            avatarLabel={todayData.header.avatarLabel}
            avatarUrl={todayData.header.avatarUrl}
            onOpenProfile={() => setProfileSheetOpen(true)}
          />

          <FloatingWelcomeLine
            state={todayData.state}
            tone={todayData.tone}
            motionIntensity={todayData.motionIntensity}
            isRefreshing={todayData.isRefreshing}
          >
            {todayData.welcomeLine}
          </FloatingWelcomeLine>

          <TodayHero
            state={todayData.state}
            tone={todayData.tone}
            motionIntensity={todayData.motionIntensity}
            modeLabel={todayData.hero.modeLabel}
            dateLabel={todayData.hero.dateLabel}
            scoreLabel={todayData.hero.scoreLabel}
            deltaLabel={todayData.hero.deltaLabel}
            statusTitle={todayData.hero.statusTitle}
            statusDetail={todayData.hero.statusDetail}
            doneBlocksCount={todayData.completedBlocks}
            plannedBlocksCount={todayData.totalBlocks}
          />

          <PrimaryActionCard
            state={todayData.state}
            tone={todayData.tone}
            motionIntensity={todayData.motionIntensity}
            durationLabel={todayData.primaryAction.durationLabel}
            title={todayData.primaryAction.title}
            description={todayData.primaryAction.description}
            categoryLabel={todayData.primaryAction.categoryLabel}
            timingLabel={todayData.primaryAction.timingLabel}
            priorityLabel={todayData.primaryAction.priorityLabel}
            reason={todayData.primaryAction.reason}
            label={todayData.primaryAction.label}
            primaryLabel={todayData.primaryAction.primaryLabel}
            secondaryLabel={todayData.primaryAction.secondaryLabel}
            detailLabel={todayData.primaryAction.detailLabel}
            status={todayData.primaryAction.status}
            onPrimary={runPrimaryCockpitAction}
            onSecondary={handlePrimarySecondary}
            onDetail={handlePrimaryDetail}
            canPrimary={todayData.primaryAction.canPrimary !== false}
            canSecondary={todayData.primaryAction.canSecondary !== false}
            canDetail={todayData.primaryAction.canDetail !== false}
          />

          <TodayTimeline
            state={todayData.state}
            tone={todayData.tone}
            motionIntensity={todayData.motionIntensity}
            timelineMode={todayData.timelineMode}
            items={todayData.timelineItems}
            progressLabel={todayData.timelineProgressLabel}
            onSelectItem={openPlanningForToday}
          />

          <AIInsightCard
            state={todayData.state}
            tone={todayData.tone}
            motionIntensity={todayData.motionIntensity}
            aiMode={todayData.aiMode}
            headline={todayData.aiInsight.headline}
            recommendation={todayData.aiInsight.recommendation}
            reason={todayData.aiInsight.reason}
            status={todayData.aiInsight.status}
            canApply={todayData.aiInsight.canApply}
            onApply={runPrimaryCockpitAction}
            onWhy={() => openCoachInsight()}
            onOpenCoach={() => openCoachInsight("Aide-moi à ajuster la journée depuis l’insight IA.")}
          />
        </div>
      </AppScreen>

      <ProfileMenu
        open={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
        onNavigate={(route) => onOpenSecondaryRoute?.(route)}
        onSignOut={() => {
          signOut?.().catch(() => {});
        }}
      />
    </>
  );
}
