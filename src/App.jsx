import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ensureSystemInboxCategory,
  migrate,
} from "./logic/state";
import { autoActivateScheduledGoals } from "./logic/goals";
import { markIOSRootClass } from "./utils/dialogs";
import { readAiBackendBaseUrl } from "./infra/aiNowClient";
import { logAiBackendTargetOnce } from "./infra/aiTransportDiagnostics";
import {
  AppActionRow,
  AppDialog,
  GhostButton,
  PrimaryButton,
} from "./shared/ui/app";
import { CommandLoadingState } from "./shared/ui/command";
import { uid } from "./utils/helpers";
import "./app/appShell.css";
import "./styles/lovable.css";

import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Objectives from "./pages/Objectives";
import Timeline from "./pages/Timeline";
import Adjust from "./pages/Adjust";
import CoachPage from "./pages/Coach";
import Preferences from "./pages/Preferences";
import Account from "./pages/Account";
import Subscription from "./pages/Subscription";
import DataPage from "./pages/Data";
import Faq from "./pages/Faq";
import History from "./pages/History";
import Journal from "./pages/Journal";
import Legal from "./pages/Legal";
import MicroActions from "./pages/MicroActions";
import EditItem from "./pages/EditItem";
import CreateItem from "./pages/CreateItem";
import CategoryDetailView from "./pages/CategoryDetailView";
import CategoryProgress from "./pages/CategoryProgress";
import Session from "./pages/Session";
import Privacy from "./pages/Privacy";
import Support from "./pages/Support";
import BottomNavigation from "./components/navigation/BottomNavigation";
import InAppNudge from "./components/notifications/InAppNudge";
import NotificationCenter from "./components/notifications/NotificationCenter";
import UnifiedRecoverySheet from "./components/recovery/UnifiedRecoverySheet";
import DayAnalysisSheet from "./components/day-analysis/DayAnalysisSheet";
import { applyThemeTokens, BRAND_ACCENT, DEFAULT_THEME } from "./theme/themeTokens";
import { todayLocalKey } from "./utils/dateKey";
import { normalizePriorities } from "./logic/priority";
import { FIRST_USE_TOUR_STEPS, TOUR_VERSION } from "./tour/tourSpec";
import { useTour } from "./tour/useTour";
import TourOverlay from "./tour/TourOverlay";
import DiagnosticOverlay from "./components/DiagnosticOverlay";
import { ensureWindowFromScheduleRules, validateOccurrences } from "./logic/occurrencePlanner";
import { resolveExecutableOccurrence } from "./logic/sessionResolver";
import PaywallModal from "./components/PaywallModal";
import { getSafeBackTarget, useAppNavigation } from "./hooks/useAppNavigation";
import { useEntitlementsPaywall } from "./hooks/useEntitlementsPaywall";
import { useRemindersLoop } from "./hooks/useRemindersLoop";
import { useNotificationEngine } from "./hooks/useNotificationEngine";
import { useSessionRuntimeLoop } from "./hooks/useSessionRuntimeLoop";
import { useCreateFlowOrchestration } from "./hooks/useCreateFlowOrchestration";
import { useCategorySelectionSync } from "./hooks/useCategorySelectionSync";
import { getInboxId } from "./app/inbox";
import { createHomeNavigationHandlers } from "./app/homeNavigation";
import { resolveCoachCreatedViewTarget } from "./app/coachCreatedViewTarget";
import { scheduleMainTabScrollReset } from "./app/mainTabScroll";
import { useAuth } from "./auth/useAuth";
import {
  normalizeRouteOrigin,
  resolveMainTabForSurface,
  resolveRouteOriginLibraryMode,
} from "./app/routeOrigin";
import { useUserData } from "./data/useUserData";
import { applySessionRuntimeTransition, isRuntimeSessionOpen } from "./logic/sessionRuntime";
import { emitSessionRuntimeNotificationHook } from "./logic/sessionRuntimeNotifications";
import { buildUserAiProfileSignature, updateUserAiProfileAdaptation } from "./domain/userAiProfile";
import {
  getVisibleCategories,
  normalizeSelectedCategoryByView,
  resolveLibraryEntryCategoryId,
  sanitizeVisibleCategoryUi,
  withExecutionActiveCategoryId,
  withLibraryActiveCategoryId,
} from "./domain/categoryVisibility";
import { isFirstRunDone } from "./features/first-run/firstRunModel";
import { resolveGoalType } from "./domain/goalType";
import { BehaviorFeedbackHost, BehaviorFeedbackProvider } from "./feedback/BehaviorFeedbackContext";
import { ADJUST_ACTION_IDS } from "./features/adjust/adjustDiagnostic";
import { buildAdjustSignalBadgeModel } from "./features/adjust/adjustSignalBadgeModel";
import { commitRecoveryOptionState } from "./features/recovery/recoveryAppController";
import { buildRecoveryContext } from "./features/recovery/recoverySheetModel";
import {
  createSessionRecoveryRequest,
  hasCommittedSessionRecoveryOutcome,
} from "./features/recovery/sessionRecoveryQueue";
import { requestAiDayAnalysis } from "./infra/aiDayAnalysisClient";
import { buildDayAnalysisSnapshot } from "./features/day-analysis/dayAnalysisSnapshot";
import { buildDayAnalysisSnapshotHash } from "./features/day-analysis/dayAnalysisCache";
import { DAY_ANALYSIS_SHEET_STATE } from "./features/day-analysis/dayAnalysisSheetModel";
import {
  applyDayAnalysisDeterministicAction,
  buildDayAnalysisRecoveryRequest,
  isDayAnalysisActionDirectlyApplicable,
  resolveDayAnalysisActionHandoff,
} from "./features/day-analysis/dayAnalysisAppController";

function runSelfTests(data) {
  const isProd = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD;
  if (isProd) return;
  // minimal sanity
  console.assert(typeof window !== "undefined", "browser env");
  validateOccurrences(data);
}

function ensureOrder(order, categories) {
  const ids = categories.map((c) => c.id);
  const base = Array.isArray(order) ? order.filter((id) => ids.includes(id)) : [];
  const missing = ids.filter((id) => !base.includes(id));
  return [...base, ...missing];
}

function isSameOrder(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

const RECOVERY_ROUTE_TABS = new Set(["today", "timeline", "adjust", "coach", "objectives"]);

function normalizeRecoveryTab(value) {
  const tab = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (tab === "home") return "today";
  if (tab === "planning") return "timeline";
  return RECOVERY_ROUTE_TABS.has(tab) ? tab : "";
}

function defaultRecoveryOriginTab(source) {
  const normalizedSource = typeof source === "string" ? source.trim().toLowerCase() : "";
  if (normalizedSource === "planning") return "timeline";
  if (normalizedSource === "adjust") return "adjust";
  return "today";
}

function defaultRecoverySuccessTab(source) {
  const normalizedSource = typeof source === "string" ? source.trim().toLowerCase() : "";
  if (normalizedSource === "planning") return "timeline";
  return "today";
}

function getRecoverySuccessCtaLabel(tab) {
  return normalizeRecoveryTab(tab) === "timeline" ? "Retour au Planning" : "Retour à Home";
}

function createInitialDayAnalysisSheetState() {
  return {
    open: false,
    phase: DAY_ANALYSIS_SHEET_STATE.INTRO,
    source: "home",
    selectedDateKey: "",
    todayData: null,
    snapshot: null,
    snapshotHash: "",
    result: null,
    selectedActionId: "",
    pending: false,
    error: null,
    successSummary: "",
  };
}

export default function App() {
  const auth = useAuth();
  const {
    data,
    setData,
    loading: dataLoading,
    loadError: dataLoadError,
    hasCachedData,
    persistenceScope,
  } = useUserData();
  const safeData = data && typeof data === "object" ? data : {};
  const {
    tab,
    setTab,
    editItemId,
    categoryDetailId,
    setCategoryDetailId,
    categoryProgressId,
    setCategoryProgressId,
    libraryCategoryId,
    setLibraryCategoryId,
    sessionCategoryId,
    setSessionCategoryId,
    sessionDateKey,
    sessionOccurrenceId,
    lastMainTab,
    coachAliasRequest,
    consumeCoachAliasRequest,
  } = useAppNavigation({ safeData, setData });
  const [editItem, setEditItem] = useState(null);
  const [createTaskState, setCreateTaskState] = useState(null);
  const [sessionLaunchState, setSessionLaunchState] = useState(null);
  const [coachState, setCoachState] = useState({
    mode: "free",
    conversationId: null,
    prefill: "",
  });
  const [recoverySheetState, setRecoverySheetState] = useState({
    request: null,
    pending: false,
    result: null,
    error: null,
  });
  const [dayAnalysisSheetState, setDayAnalysisSheetState] = useState(createInitialDayAnalysisSheetState);
  const [queuedSessionRecoveryRequest, setQueuedSessionRecoveryRequest] = useState(null);
  const dataRef = useRef(data);
  const dayAnalysisRequestSeqRef = useRef(0);
  const dayAnalysisAbortRef = useRef(null);
  const dayAnalysisCacheRef = useRef(new Map());
  const invariantLogRef = useRef(new Set());
  const tour = useTour({ data, setData, steps: FIRST_USE_TOUR_STEPS, tourVersion: TOUR_VERSION });

  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const { activeReminder, setActiveReminder } = useRemindersLoop({ data, dataRef });
  useSessionRuntimeLoop({ setData, dataRef });

  useEffect(() => {
    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    if (!isDev || typeof window === "undefined") return;
    let cancelled = false;
    import("./logic/internalP2Tests")
      .then((m) => {
        if (cancelled) return;
        window.__runP2Tests = m.runInternalP2Tests;
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[p2-tests] failed to load", err);
      });
    return () => {
      cancelled = true;
      delete window.__runP2Tests;
    };
  }, []);
  const {
    paywallOpen,
    paywallReason,
    setPaywallOpen,
    openPaywall,
    handlePurchase,
    handleRestorePurchases,
    ensureResolved,
    entitlementAccess,
    planLimits,
    isPremiumPlan,
    generationWindowDays,
    planningUnlimited,
    canCreateOutcomeNow,
    canCreateActionNow,
  } = useEntitlementsPaywall({ safeData, setData });
  const firstRunDone = isFirstRunDone(safeData.ui);
  const showPlanStep = Boolean(safeData.ui?.showPlanStep);
  const hideNavigationChrome =
    Boolean(showPlanStep) ||
    tab === "create-item" ||
    tab === "edit-item" ||
    tab === "session" ||
    tab === "onboarding";
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const closeRecoverySheet = useCallback(() => {
    const successTab = recoverySheetState.result?.ok
      ? normalizeRecoveryTab(recoverySheetState.request?.successTab) || "today"
      : "";
    setRecoverySheetState({
      request: null,
      pending: false,
      result: null,
      error: null,
    });
    if (successTab) setTab(successTab);
  }, [recoverySheetState.request, recoverySheetState.result, setTab]);
  const openRecoverySheet = useCallback(
    ({
      occurrenceId,
      context = "",
      source = "unknown",
      selectedDateKey = "",
      originTab = "",
      successTab = "",
    } = {}) => {
      const currentData = dataRef.current && typeof dataRef.current === "object" ? dataRef.current : {};
      const occurrences = Array.isArray(currentData?.occurrences) ? currentData.occurrences : [];
      const occurrence = occurrences.find((entry) => entry?.id === occurrenceId) || null;
      const requestDateKey =
        selectedDateKey ||
        occurrence?.date ||
        currentData?.ui?.selectedDateKey ||
        currentData?.ui?.selectedDate ||
        todayLocalKey();
      const model = buildRecoveryContext({
        state: currentData,
        occurrenceId,
        context,
        selectedDateKey: requestDateKey,
        now: new Date(),
        source,
      });

      if (!model.ok || !model.options.length) return false;
      const resolvedOriginTab =
        normalizeRecoveryTab(originTab) ||
        defaultRecoveryOriginTab(source);
      const resolvedSuccessTab =
        normalizeRecoveryTab(successTab) ||
        defaultRecoverySuccessTab(source);

      setRecoverySheetState({
        request: {
          occurrenceId: model.request.occurrenceId,
          context: model.request.context,
          selectedDateKey: model.request.selectedDateKey || requestDateKey,
          source,
          originTab: resolvedOriginTab,
          successTab: resolvedSuccessTab,
          openedAtMs: Date.now(),
        },
        pending: false,
        result: null,
        error: null,
      });
      setTab(resolvedOriginTab);
      return true;
    },
    [setTab]
  );
  const queueRecoveryAfterSessionCommit = useCallback((request) => {
    const nextRequest = createSessionRecoveryRequest(request);
    if (!nextRequest) return false;
    setQueuedSessionRecoveryRequest(nextRequest);
    return true;
  }, []);
  const notificationEngine = useNotificationEngine({
    data: safeData,
    setData,
    tab,
    setTab,
    onOpenRecoverySheet: openRecoverySheet,
    activeReminder,
    enabled: firstRunDone && !dataLoading && !showPlanStep && !activeReminder && !paywallOpen && !hideNavigationChrome,
  });
  const bottomRailRef = useRef(null);
  const handleSecondaryBack = useCallback(() => {
    setTab(getSafeBackTarget({ currentTab: tab, lastMainTab }));
  }, [lastMainTab, setTab, tab]);
  const pendingMainTabScrollResetRef = useRef(null);

  useEffect(() => {
    setData((prev) => {
      const next = normalizePriorities(migrate(prev));
      runSelfTests(next);
      return next;
    });
    markIOSRootClass();
    logAiBackendTargetOnce({ backendBaseUrl: readAiBackendBaseUrl() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return undefined;
    const root = document.documentElement;
    const updateKeyboardClass = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const viewportHeight = window.innerHeight || vv.height;
      const keyboardOpen = viewportHeight - vv.height > 140;
      root.classList.toggle("keyboardOpen", keyboardOpen);
    };
    updateKeyboardClass();
    window.visualViewport.addEventListener("resize", updateKeyboardClass);
    window.visualViewport.addEventListener("scroll", updateKeyboardClass);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateKeyboardClass);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardClass);
      root.classList.remove("keyboardOpen");
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => autoActivateScheduledGoals(prev, new Date()));
    }, 60000);
    return () => clearInterval(id);
  }, [setData]);

  const resolvedSessionDateKey =
    (typeof sessionDateKey === "string" && sessionDateKey) ||
    (typeof safeData?.ui?.selectedDateKey === "string" && safeData.ui.selectedDateKey) ||
    (typeof safeData?.ui?.selectedDate === "string" && safeData.ui.selectedDate) ||
    todayLocalKey();

  const closeDayAnalysisSheet = useCallback(() => {
    dayAnalysisRequestSeqRef.current += 1;
    dayAnalysisAbortRef.current?.abort?.();
    dayAnalysisAbortRef.current = null;
    setDayAnalysisSheetState(createInitialDayAnalysisSheetState());
  }, []);

  const openDayAnalysisSheet = useCallback(
    ({ todayData = null, selectedDateKey = "", source = "home" } = {}) => {
      dayAnalysisRequestSeqRef.current += 1;
      dayAnalysisAbortRef.current?.abort?.();
      dayAnalysisAbortRef.current = null;
      setDayAnalysisSheetState({
        ...createInitialDayAnalysisSheetState(),
        open: true,
        phase: DAY_ANALYSIS_SHEET_STATE.INTRO,
        source,
        selectedDateKey: selectedDateKey || resolvedSessionDateKey || todayLocalKey(),
        todayData,
      });
      setTab("today");
      return true;
    },
    [resolvedSessionDateKey, setTab]
  );

  const launchDayAnalysis = useCallback(async () => {
    if (dayAnalysisSheetState.pending) return;

    const requestSeq = dayAnalysisRequestSeqRef.current + 1;
    dayAnalysisRequestSeqRef.current = requestSeq;
    dayAnalysisAbortRef.current?.abort?.();

    const abortController = typeof AbortController !== "undefined" ? new AbortController() : null;
    dayAnalysisAbortRef.current = abortController;
    const now = new Date();
    const currentData = dataRef.current && typeof dataRef.current === "object" ? dataRef.current : {};
    const selectedDateKey =
      dayAnalysisSheetState.selectedDateKey ||
      currentData?.ui?.selectedDateKey ||
      currentData?.ui?.selectedDate ||
      resolvedSessionDateKey ||
      todayLocalKey();

    let snapshot;
    let snapshotHash;
    try {
      snapshot = buildDayAnalysisSnapshot({
        state: currentData,
        todayData: dayAnalysisSheetState.todayData,
        now,
        selectedDateKey,
      });
      snapshotHash = buildDayAnalysisSnapshotHash(snapshot);
    } catch (error) {
      setDayAnalysisSheetState((previous) => ({
        ...previous,
        open: true,
        phase: DAY_ANALYSIS_SHEET_STATE.ERROR,
        pending: false,
        error: { errorCode: "SNAPSHOT_INVALID", error },
      }));
      return;
    }

    const cached = dayAnalysisCacheRef.current.get(snapshotHash);
    if (cached?.result) {
      dayAnalysisAbortRef.current = null;
      setDayAnalysisSheetState((previous) => ({
        ...previous,
        open: true,
        phase: DAY_ANALYSIS_SHEET_STATE.RESULT,
        selectedDateKey,
        snapshot,
        snapshotHash,
        result: cached.result,
        selectedActionId: "",
        pending: false,
        error: null,
      }));
      return;
    }

    setDayAnalysisSheetState((previous) => ({
      ...previous,
      open: true,
      phase: DAY_ANALYSIS_SHEET_STATE.LOADING,
      selectedDateKey,
      snapshot,
      snapshotHash,
      result: null,
      selectedActionId: "",
      pending: true,
      error: null,
    }));

    let response;
    try {
      response = await requestAiDayAnalysis({
        snapshot,
        snapshotHash,
        accessToken: auth?.session?.access_token || "",
        signal: abortController?.signal,
      });
    } catch (error) {
      response = {
        ok: false,
        errorCode: "BACKEND_UNAVAILABLE",
        error,
      };
    }

    if (dayAnalysisRequestSeqRef.current !== requestSeq) return;
    if (dayAnalysisAbortRef.current === abortController) {
      dayAnalysisAbortRef.current = null;
    }

    if (response?.ok && response.result) {
      dayAnalysisCacheRef.current.set(snapshotHash, {
        result: response.result,
        storedAtMs: Date.now(),
      });
      setDayAnalysisSheetState((previous) => ({
        ...previous,
        open: true,
        phase: DAY_ANALYSIS_SHEET_STATE.RESULT,
        selectedDateKey,
        snapshot,
        snapshotHash,
        result: response.result,
        selectedActionId: "",
        pending: false,
        error: null,
      }));
      return;
    }

    setDayAnalysisSheetState((previous) => ({
      ...previous,
      open: true,
      phase: DAY_ANALYSIS_SHEET_STATE.ERROR,
      selectedDateKey,
      snapshot,
      snapshotHash,
      result: null,
      selectedActionId: "",
      pending: false,
      error: response || { errorCode: "BACKEND_UNAVAILABLE" },
    }));
  }, [
    auth?.session?.access_token,
    dayAnalysisSheetState.pending,
    dayAnalysisSheetState.selectedDateKey,
    dayAnalysisSheetState.todayData,
    resolvedSessionDateKey,
  ]);

  const routeDayAnalysisAction = useCallback(
    (action) => {
      if (isDayAnalysisActionDirectlyApplicable(action)) {
        setDayAnalysisSheetState((previous) => ({
          ...previous,
          phase: DAY_ANALYSIS_SHEET_STATE.CONFIRMATION,
          selectedActionId: action?.id || "",
          pending: false,
          error: null,
        }));
        return;
      }

      const handoff = resolveDayAnalysisActionHandoff(action);
      const selectedDateKey = dayAnalysisSheetState.selectedDateKey || resolvedSessionDateKey || todayLocalKey();

      if (handoff.kind === "close" || handoff.kind === "none") {
        closeDayAnalysisSheet();
        setTab("today");
        return;
      }

      if (handoff.kind === "coach") {
        closeDayAnalysisSheet();
        setCoachState({
          mode: "free",
          conversationId: null,
          prefill: "Aide-moi à optimiser ma journée sans appliquer automatiquement de changement.",
        });
        setTab("coach");
        return;
      }

      if (handoff.kind === "recovery") {
        const request = buildDayAnalysisRecoveryRequest({
          action,
          selectedDateKey,
          source: "day_analysis",
        });
        closeDayAnalysisSheet();
        const opened = request ? openRecoverySheet(request) : false;
        if (!opened) setTab("timeline");
        return;
      }

      closeDayAnalysisSheet();
      setTab("timeline");
    },
    [closeDayAnalysisSheet, dayAnalysisSheetState.selectedDateKey, openRecoverySheet, resolvedSessionDateKey, setTab]
  );

  const confirmDayAnalysisApply = useCallback(
    (action) => {
      if (!action || dayAnalysisSheetState.pending) return;
      if (!isDayAnalysisActionDirectlyApplicable(action)) {
        routeDayAnalysisAction(action);
        return;
      }

      setDayAnalysisSheetState((previous) => ({
        ...previous,
        pending: true,
        error: null,
      }));

      const currentData = dataRef.current && typeof dataRef.current === "object" ? dataRef.current : {};
      const selectedDateKey =
        dayAnalysisSheetState.selectedDateKey ||
        currentData?.ui?.selectedDateKey ||
        currentData?.ui?.selectedDate ||
        resolvedSessionDateKey ||
        todayLocalKey();
      const result = applyDayAnalysisDeterministicAction({
        state: currentData,
        todayData: dayAnalysisSheetState.todayData,
        selectedDateKey,
        action,
        now: new Date(),
      });

      if (result.ok && result.nextState) {
        setData(result.nextState);
        setDayAnalysisSheetState((previous) => ({
          ...previous,
          phase: DAY_ANALYSIS_SHEET_STATE.SUCCESS,
          pending: false,
          error: null,
          successSummary: result.summary,
        }));
        return;
      }

      setDayAnalysisSheetState((previous) => ({
        ...previous,
        phase: DAY_ANALYSIS_SHEET_STATE.ERROR,
        pending: false,
        error: result,
      }));
    },
    [
      dayAnalysisSheetState.pending,
      dayAnalysisSheetState.selectedDateKey,
      dayAnalysisSheetState.todayData,
      resolvedSessionDateKey,
      routeDayAnalysisAction,
      setData,
    ]
  );

  const handleDayAnalysisSelectAction = useCallback(
    (action) => {
      if (!action) return;
      setDayAnalysisSheetState((previous) => ({
        ...previous,
        selectedActionId: action.id || "",
      }));
      routeDayAnalysisAction(action);
    },
    [routeDayAnalysisAction]
  );

  const handleDayAnalysisBackToResult = useCallback(() => {
    setDayAnalysisSheetState((previous) => ({
      ...previous,
      phase: DAY_ANALYSIS_SHEET_STATE.RESULT,
      pending: false,
      error: null,
    }));
  }, []);

  const recoverySheetContext = useMemo(() => {
    const request = recoverySheetState.request;
    if (!request) return null;
    const currentData = data && typeof data === "object" ? data : {};
    return buildRecoveryContext({
      state: currentData,
      occurrenceId: request.occurrenceId,
      context: request.context,
      selectedDateKey: request.selectedDateKey || resolvedSessionDateKey,
      now: new Date(request.openedAtMs || Date.now()),
      source: request.source,
    });
  }, [data, recoverySheetState.request, resolvedSessionDateKey]);

  useEffect(() => {
    const request = queuedSessionRecoveryRequest;
    if (!request) return;
    const currentData = data && typeof data === "object" ? data : {};
    if (!hasCommittedSessionRecoveryOutcome(currentData, request)) return;

    const model = buildRecoveryContext({
      state: currentData,
      occurrenceId: request.occurrenceId,
      context: request.context,
      selectedDateKey: request.selectedDateKey || resolvedSessionDateKey,
      now: new Date(request.queuedAtMs || Date.now()),
      source: request.source,
    });

    setQueuedSessionRecoveryRequest(null);
    if (!model.ok || !model.options.length) return;

    setRecoverySheetState({
      request: {
        occurrenceId: model.request.occurrenceId,
        context: model.request.context,
        selectedDateKey: model.request.selectedDateKey || request.selectedDateKey || resolvedSessionDateKey,
        source: request.source,
        originTab: "today",
        successTab: "today",
        openedAtMs: Date.now(),
      },
      pending: false,
      result: null,
      error: null,
    });
    setTab("today");
  }, [data, queuedSessionRecoveryRequest, resolvedSessionDateKey, setTab]);

  const commitRecoveryOption = useCallback(
    (option) => {
      const request = recoverySheetState.request;
      if (!request?.occurrenceId || !option || recoverySheetState.pending) return;
      setRecoverySheetState((previous) => ({
        ...previous,
        pending: true,
        result: null,
        error: null,
      }));

      const currentData = dataRef.current && typeof dataRef.current === "object" ? dataRef.current : {};
      const result = commitRecoveryOptionState({
        state: currentData,
        occurrenceId: request.occurrenceId,
        option,
        now: new Date(),
        setData,
      });

      setRecoverySheetState((previous) => ({
        ...previous,
        pending: false,
        result: result.ok ? result : null,
        error: result.ok ? null : result,
      }));
    },
    [recoverySheetState.pending, recoverySheetState.request, setData]
  );

  const openRecoveryCoach = useCallback(
    () => {
      closeRecoverySheet();
      setCoachState({
        mode: "free",
        conversationId: null,
        prefill: "Aide-moi à récupérer ce bloc sans appliquer automatiquement de changement.",
      });
      setTab("coach");
    },
    [closeRecoverySheet, setTab]
  );

  const openRecoveryPlanningDetail = useCallback(
    () => {
      closeRecoverySheet();
      setTab("timeline");
    },
    [closeRecoverySheet, setTab]
  );

  const openSessionSurface = useCallback(
    ({ sourceSurface = "unknown", categoryId = null, dateKey = null, occurrenceId = null } = {}) => {
      const normalizedSource =
        sourceSurface === "today" ||
        sourceSurface === "timeline" ||
        sourceSurface === "coach" ||
        sourceSurface === "insights" ||
        sourceSurface === "adjust"
          ? sourceSurface
          : "unknown";
      setSessionLaunchState({
        version: 1,
        entryId: uid(),
        phase: "ready",
        launchMode: null,
        sourceSurface: normalizedSource,
        occurrenceId: typeof occurrenceId === "string" && occurrenceId ? occurrenceId : null,
        actionId: null,
        dateKey: typeof dateKey === "string" && dateKey ? dateKey : null,
        categoryId: typeof categoryId === "string" && categoryId ? categoryId : null,
        blueprintSnapshot: null,
        sessionRunbook: null,
        standardAdjustment: null,
        guidedAdjustment: null,
        sessionToolPlan: null,
        sessionToolState: null,
        guidedSpatialState: null,
        guidedLockedPreview: null,
        openedAtMs: Date.now(),
      });
      setTab("session", {
        sessionCategoryId: categoryId || null,
        sessionDateKey: dateKey || null,
        sessionOccurrenceId: occurrenceId || null,
      });
    },
    [setTab]
  );

  const showBottomRail = !hideNavigationChrome && new Set(["today", "objectives", "timeline", "adjust", "coach"]).has(tab);
  const adjustSignalBadge = useMemo(() => buildAdjustSignalBadgeModel(data), [data]);
  const handleBottomNavigationSelect = useCallback(
    (nextTab) => {
      if (nextTab !== tab) pendingMainTabScrollResetRef.current = nextTab;
      setTab(nextTab);
    },
    [setTab, tab]
  );

  useLayoutEffect(() => {
    if (pendingMainTabScrollResetRef.current !== tab) return undefined;
    pendingMainTabScrollResetRef.current = null;
    return scheduleMainTabScrollReset(tab);
  }, [tab]);
  const handleAdjustAction = useCallback(
    (actionId) => {
      if (actionId === ADJUST_ACTION_IDS.REORGANIZE_SCHEDULE) {
        setTab("timeline");
        return;
      }
      if (actionId === ADJUST_ACTION_IDS.SIMPLIFY_DAY) {
        setCoachState({
          mode: "plan",
          conversationId: null,
          prefill: "Simplifie ma journée en gardant seulement le prochain bloc utile.",
        });
        setTab("coach");
        return;
      }
      if (actionId === ADJUST_ACTION_IDS.REDUCE_LOAD) {
        setCoachState({
          mode: "plan",
          conversationId: null,
          prefill: "Réduis la charge de ma journée sans perdre l’action critique.",
        });
        setTab("coach");
        return;
      }
      setCoachState({
        mode: "free",
        conversationId: null,
        prefill: "Aide-moi à ajuster ma journée.",
      });
      setTab("coach");
    },
    [setTab]
  );
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    root.dataset.activeTab = tab;
    return () => {
      if (root.dataset.activeTab === tab) delete root.dataset.activeTab;
    };
  }, [tab]);

  const visibleCategories = useMemo(
    () => getVisibleCategories(categories),
    [categories]
  );
  const userAiProfileSignature = useMemo(
    () => buildUserAiProfileSignature(safeData.user_ai_profile),
    [safeData.user_ai_profile]
  );
  const occurrenceBehaviorSignature = useMemo(
    () =>
      JSON.stringify(
        (Array.isArray(safeData.occurrences) ? safeData.occurrences : []).map((occurrence) => [
          occurrence?.id || "",
          occurrence?.date || "",
          occurrence?.status || "",
          occurrence?.updatedAt || "",
        ])
      ),
    [safeData.occurrences]
  );
  const categoryIdsKey = useMemo(() => visibleCategories.map((c) => c.id).join("|"), [visibleCategories]);
  const categoryRailOrder = useMemo(
    () => ensureOrder(safeData?.ui?.categoryRailOrder, visibleCategories),
    [safeData?.ui?.categoryRailOrder, visibleCategories]
  );
  const isDevEnv = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  const {
    homeActiveCategoryId,
    selectedCategoryId,
    openLibraryDetail,
    detailCategoryId,
  } = useCategorySelectionSync({
    tab,
    safeData,
    categories: visibleCategories,
    setData,
    setTab,
    libraryCategoryId,
    setLibraryCategoryId,
    categoryDetailId,
    setCategoryDetailId,
    categoryProgressId,
    setCategoryProgressId,
    setSessionCategoryId,
  });
  const homeNavigationHandlers = useMemo(
    () =>
      createHomeNavigationHandlers({
        openLibraryDetail,
        setTab,
      }),
    [openLibraryDetail, setTab]
  );
  const {
    openCreateAction,
    openCreateAssistant,
  } = useCreateFlowOrchestration({
    tab,
    setTab,
    safeData,
    categories: visibleCategories,
    setData,
    onCreateTaskOpen: setCreateTaskState,
  });
  const handleEditBack = () => {
    const returnTab = editItem?.returnTab || "objectives";
    if (returnTab === "objectives") {
      const nextId = editItem?.categoryId || libraryCategoryId || null;
      if (editItem?.returnToCategoryView === true && nextId) {
        setLibraryCategoryId(nextId);
      } else if (editItem?.returnToCategoryView !== true) {
        setLibraryCategoryId(null);
      }
    }
    setEditItem(null);
    setTab(returnTab, { editItemId: null });
  };

  useEffect(() => {
    if (tab !== "edit-item" || editItem || !editItemId) return;
    const goal = (Array.isArray(safeData.goals) ? safeData.goals : []).find((entry) => entry?.id === editItemId) || null;
    if (!goal) return;
    setEditItem({
      id: editItemId,
      type: resolveGoalType(goal),
      categoryId: goal.categoryId || null,
      returnTab: "objectives",
      returnToCategoryView: Boolean(goal.categoryId),
    });
  }, [editItem, editItemId, safeData.goals, tab]);

  const resolveRouteOrigin = useCallback(
    ({ sourceSurface, categoryId = null, coachConversationId = null, coachMessageCreatedAt = null } = {}) => {
      const safeSource = sourceSurface || tab;
      const contextSurface = safeSource === "coach" ? tab : safeSource;
      const fallbackMainTab = safeSource === "coach" ? resolveMainTabForSurface(tab, "today") : tab;
      const mainTab = resolveMainTabForSurface(contextSurface, fallbackMainTab);
      const effectiveCategoryId = categoryId || selectedCategoryId || libraryCategoryId || homeActiveCategoryId || null;
      return normalizeRouteOrigin({
        mainTab,
        sourceSurface: safeSource,
        categoryId: effectiveCategoryId,
        dateKey:
          mainTab === "today" || mainTab === "timeline" || contextSurface === "today" || contextSurface === "timeline"
            ? resolvedSessionDateKey
            : null,
        occurrenceId: contextSurface === "session" ? sessionOccurrenceId || null : null,
        libraryMode: resolveRouteOriginLibraryMode({
          mainTab,
          sourceSurface: contextSurface,
          categoryId:
            contextSurface === "library" || contextSurface === "objectives"
              ? effectiveCategoryId
              : libraryCategoryId || effectiveCategoryId,
        }),
        coachConversationId: coachConversationId || null,
        coachMessageCreatedAt: coachMessageCreatedAt || null,
      });
    },
    [
      homeActiveCategoryId,
      libraryCategoryId,
      resolvedSessionDateKey,
      selectedCategoryId,
      sessionOccurrenceId,
      tab,
    ]
  );

  const restoreTaskOriginContext = useCallback(
    ({ origin: rawOrigin, createdCategoryId = null } = {}) => {
      const origin = rawOrigin && typeof rawOrigin === "object" ? rawOrigin : null;
      if (!origin) return;
      const effectiveCategoryId = createdCategoryId || origin.categoryId || null;
      if (origin.dateKey) {
        setData((previous) => ({
          ...previous,
          ui: {
            ...(previous.ui || {}),
            selectedDateKey: origin.dateKey,
            selectedDate: origin.dateKey,
          },
        }));
      }
      if (origin.mainTab === "objectives") {
        setLibraryCategoryId(origin.libraryMode === "category-view" ? effectiveCategoryId : null);
        if (effectiveCategoryId) {
          setData((previous) => ({
            ...previous,
            ui: withLibraryActiveCategoryId(previous.ui, effectiveCategoryId),
          }));
        }
        return;
      }
      if (effectiveCategoryId && (origin.mainTab === "today" || origin.mainTab === "timeline" || origin.mainTab === "adjust")) {
        setData((previous) => ({
          ...previous,
          ui: withExecutionActiveCategoryId(previous.ui, effectiveCategoryId),
        }));
      }
    },
    [setData, setLibraryCategoryId]
  );

  const handleCreateTaskClose = useCallback(
    ({ origin: rawOrigin = null, createdCategoryId = null } = {}) => {
      const origin = normalizeRouteOrigin(rawOrigin || createTaskState?.origin || resolveRouteOrigin({ sourceSurface: tab }));
      restoreTaskOriginContext({ origin, createdCategoryId });
      setCreateTaskState(null);

      if (origin?.sourceSurface === "coach" || origin?.coachConversationId) {
        setCoachState({
          mode: "plan",
          conversationId: origin?.coachConversationId || null,
          prefill: "",
        });
        setTab("coach");
        return;
      }
      setTab(origin?.mainTab || "today");
    },
    [createTaskState?.origin, resolveRouteOrigin, restoreTaskOriginContext, setTab, tab]
  );

  const openCoachAssistantCreate = useCallback(
    ({ sourceSurface = "coach", conversationId = null, messageCreatedAt = null, proposal } = {}) => {
      const origin = resolveRouteOrigin({
        sourceSurface,
        coachConversationId: conversationId,
        coachMessageCreatedAt: messageCreatedAt,
      });
      setCreateTaskState({ origin, kind: "assistant", proposal });
      openCreateAssistant({
        source: sourceSurface,
        categoryId: proposal?.categoryDraft?.id || null,
        proposal,
        origin,
      });
    },
    [openCreateAssistant, resolveRouteOrigin]
  );

  const openCoachCreatedView = useCallback(
    (target) => {
      const safeTarget = resolveCoachCreatedViewTarget(target, safeData.goals);
      setLibraryCategoryId(null);
      setData((previous) => {
        const safePrevious = previous && typeof previous === "object" ? previous : {};
        const previousUi = safePrevious.ui && typeof safePrevious.ui === "object" ? safePrevious.ui : {};
        const categoryId = safeTarget?.categoryId || null;
        const baseUi = categoryId ? withLibraryActiveCategoryId(previousUi, categoryId) : previousUi;
        return {
          ...safePrevious,
          ui: {
            ...baseUi,
            manageScrollTo: null,
            libraryFocusTarget: safeTarget,
            selectedGoalByCategory:
              safeTarget?.outcomeId && categoryId
                ? {
                    ...(baseUi.selectedGoalByCategory || {}),
                    [categoryId]: safeTarget.outcomeId,
                  }
                : baseUi.selectedGoalByCategory || {},
          },
        };
      });
      setTab("objectives");
    },
    [safeData.goals, setData, setLibraryCategoryId, setTab]
  );

  const launchActionCreate = useCallback(
    ({ sourceSurface, categoryId = null, outcomeId = null, initialTitle = "", draftOverrides = null } = {}) => {
      const origin = resolveRouteOrigin({ sourceSurface, categoryId });
      setCreateTaskState({ origin, kind: "action" });
      openCreateAction({ source: sourceSurface, categoryId, outcomeId, initialTitle, draftOverrides });
    },
    [openCreateAction, resolveRouteOrigin]
  );

  // Theme reconciliation:
  // - The app now ships a single locked design system.
  // - Keep persisted ui.theme/pageThemes/pageAccents aligned silently for backward compatibility.
  useEffect(() => {
    const ui = safeData?.ui && typeof safeData.ui === "object" ? safeData.ui : {};
    const currentTheme = (ui.theme || "").toString().trim();
    const pageThemes = ui.pageThemes && typeof ui.pageThemes === "object" ? ui.pageThemes : {};
    const defaultTheme = (pageThemes.__default || "").toString().trim();
    const homeTheme = (pageThemes.home || "").toString().trim();
    const hasPageAccents =
      ui.pageAccents && typeof ui.pageAccents === "object" && Object.keys(ui.pageAccents).length > 0;
    const needsSync =
      currentTheme !== DEFAULT_THEME ||
      defaultTheme !== DEFAULT_THEME ||
      homeTheme !== DEFAULT_THEME ||
      hasPageAccents;

    if (!needsSync || typeof setData !== "function") return;

    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const prevPageThemes =
        prevUi.pageThemes && typeof prevUi.pageThemes === "object" ? prevUi.pageThemes : {};
      const prevCurrent = (prevUi.theme || "").toString().trim();
      const prevDefault = (prevPageThemes.__default || "").toString().trim();
      const prevHome = (prevPageThemes.home || "").toString().trim();
      const prevHasPageAccents =
        prevUi.pageAccents &&
        typeof prevUi.pageAccents === "object" &&
        Object.keys(prevUi.pageAccents).length > 0;
      if (
        prevCurrent === DEFAULT_THEME &&
        prevDefault === DEFAULT_THEME &&
        prevHome === DEFAULT_THEME &&
        !prevHasPageAccents
      ) {
        return prev;
      }
      return {
        ...prev,
        ui: {
          ...prevUi,
          theme: DEFAULT_THEME,
          pageThemes: {
            ...prevPageThemes,
            __default: DEFAULT_THEME,
            home: DEFAULT_THEME,
          },
          pageAccents: {},
        },
      };
    });
  }, [safeData?.ui, setData]);

  useEffect(() => {
    applyThemeTokens(DEFAULT_THEME, BRAND_ACCENT);
  }, []);
  useEffect(() => {
    if (!isSameOrder(categoryRailOrder, safeData?.ui?.categoryRailOrder || [])) {
      setData((prev) => ({
        ...prev,
        ui: { ...(prev.ui || {}), categoryRailOrder },
      }));
    }
  }, [categoryIdsKey, categoryRailOrder, safeData?.ui?.categoryRailOrder, setData]);

  useEffect(() => {
    if (dataLoading) return;
    if (!Array.isArray(safeData?.user_ai_profile?.goals) || safeData.user_ai_profile.goals.length === 0) return;
    const nextProfile = updateUserAiProfileAdaptation({
      profile: safeData.user_ai_profile,
      occurrences: safeData.occurrences,
      now: new Date(),
    });
    if (buildUserAiProfileSignature(nextProfile) === userAiProfileSignature) return;
    setData((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      const previousProfile = previous?.user_ai_profile;
      const updatedProfile = updateUserAiProfileAdaptation({
        profile: previousProfile,
        occurrences: safePrevious.occurrences,
        now: new Date(),
      });
      if (buildUserAiProfileSignature(updatedProfile) === buildUserAiProfileSignature(previousProfile)) {
        return previous;
      }
      return {
        ...safePrevious,
        user_ai_profile: updatedProfile,
      };
    });
  }, [dataLoading, occurrenceBehaviorSignature, safeData?.occurrences, safeData?.user_ai_profile, setData, userAiProfileSignature]);

  useEffect(() => {
    if (!isDevEnv || typeof setData !== "function") return;
    try {
      const data = safeData && typeof safeData === "object" ? safeData : null;
      if (!data) return;
      const cats = Array.isArray(data.categories) ? data.categories : [];
      const visibleIds = new Set(getVisibleCategories(cats).map((c) => c.id));
      const ui = data.ui && typeof data.ui === "object" ? data.ui : {};
      const issues = [];
      const inboxId = getInboxId(dataRef.current || safeData || data);
      if (!cats.some((category) => category?.id === inboxId)) issues.push("systemInboxMissing");
      if (Array.isArray(ui.categoryRailOrder) && ui.categoryRailOrder.some((id) => !visibleIds.has(id))) {
        issues.push("categoryRailOrder");
      }
      const scv = normalizeSelectedCategoryByView(ui.selectedCategoryByView);
      if (ui.selectedCategoryId && !visibleIds.has(ui.selectedCategoryId)) issues.push("selectedCategoryId");
      if (ui.librarySelectedCategoryId && !visibleIds.has(ui.librarySelectedCategoryId)) {
        issues.push("librarySelectedCategoryId");
      }
      ["today", "timeline", "objectives", "adjust"].forEach((key) => {
        if (scv[key] && !visibleIds.has(scv[key])) issues.push(`selectedCategoryByView.${key}`);
      });
      if (!issues.length) return;

      setData((prev) => {
        try {
          const base = prev && typeof prev === "object" ? prev : {};
          const ensured = ensureSystemInboxCategory(base);
          const next = ensured?.state && typeof ensured.state === "object" ? ensured.state : base;
          const nextCats = Array.isArray(next.categories) ? next.categories : [];
          const nextVisibleIds = new Set(getVisibleCategories(nextCats).map((c) => c.id));
          const nextUi = { ...(next.ui || {}) };
          const fixed = new Set();
          let didChange = next !== base;

          if (Array.isArray(nextUi.categoryRailOrder)) {
            const filtered = nextUi.categoryRailOrder.filter((id) => nextVisibleIds.has(id));
            if (filtered.length !== nextUi.categoryRailOrder.length) {
              nextUi.categoryRailOrder = filtered;
              fixed.add("categoryRailOrder");
              didChange = true;
            }
          }
          const sanitizedUi = sanitizeVisibleCategoryUi(nextUi, nextCats);
          if (JSON.stringify(sanitizedUi) !== JSON.stringify(nextUi)) {
            Object.assign(nextUi, sanitizedUi);
            fixed.add("selectedCategoryByView");
            didChange = true;
          }

          if (!didChange) return prev;
          if (fixed.size) {
            const msg = `[INV] fixed ${Array.from(fixed).join(", ")}`;
            if (invariantLogRef.current && !invariantLogRef.current.has(msg)) {
              console.warn(msg);
              invariantLogRef.current.add(msg);
            }
          }
          return fixed.size ? { ...next, ui: nextUi } : next;
        } catch {
          return prev;
        }
      });
    } catch {
      // dev guard must never throw
    }
  }, [isDevEnv, safeData, setData]);
  const showTourOverlay = firstRunDone;

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const root = document.documentElement;
    const rootStyle = root.style;

    const resetBottomFixedStackSpace = () => {
      rootStyle.setProperty("--bottom-fixed-stack-space", "0px");
    };

    const updateBottomFixedStackSpace = () => {
      const rail = bottomRailRef.current;
      const visualViewport = window.visualViewport;
      const visibleViewportHeight = visualViewport?.height || window.innerHeight || 0;
      const visibleViewportBottom = visualViewport
        ? visualViewport.height + visualViewport.offsetTop
        : window.innerHeight || 0;
      const keyboardOpen =
        Boolean(visualViewport) && (window.innerHeight || visibleViewportHeight) - visibleViewportHeight > 140;
      if (!showBottomRail || !rail || keyboardOpen || root.classList.contains("keyboardOpen")) {
        resetBottomFixedStackSpace();
        return;
      }
      const rect = rail.getBoundingClientRect?.();
      if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(visibleViewportBottom)) {
        resetBottomFixedStackSpace();
        return;
      }
      const clearSpace = Math.max(0, Math.round(visibleViewportBottom - rect.top));
      rootStyle.setProperty("--bottom-fixed-stack-space", `${clearSpace}px`);
    };

    updateBottomFixedStackSpace();
    const raf = window.requestAnimationFrame(updateBottomFixedStackSpace);

    let ro;
    if (window.ResizeObserver && bottomRailRef.current) {
      ro = new ResizeObserver(updateBottomFixedStackSpace);
      ro.observe(bottomRailRef.current);
    }

    window.addEventListener("resize", updateBottomFixedStackSpace);
    window.addEventListener("orientationchange", updateBottomFixedStackSpace);
    window.visualViewport?.addEventListener("resize", updateBottomFixedStackSpace);
    window.visualViewport?.addEventListener("scroll", updateBottomFixedStackSpace);

    return () => {
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", updateBottomFixedStackSpace);
      window.removeEventListener("orientationchange", updateBottomFixedStackSpace);
      window.visualViewport?.removeEventListener("resize", updateBottomFixedStackSpace);
      window.visualViewport?.removeEventListener("scroll", updateBottomFixedStackSpace);
      resetBottomFixedStackSpace();
    };
  }, [showBottomRail]);

  useEffect(() => {
    if (!coachAliasRequest) return;
    setTab("coach", { replace: true });
    setCoachState({
      mode: coachAliasRequest.mode === "plan" ? "plan" : "free",
      conversationId: coachAliasRequest.conversationId || null,
      prefill: "",
    });
    consumeCoachAliasRequest();
  }, [coachAliasRequest, consumeCoachAliasRequest, setTab]);

  useEffect(() => {
    if (typeof window === "undefined" || dataLoading) return;
    if (!firstRunDone && window.location.pathname !== "/onboarding") {
      window.history.replaceState({}, "", "/onboarding");
      return;
    }
    if (firstRunDone && window.location.pathname === "/onboarding") {
      window.history.replaceState({}, "", "/");
    }
  }, [dataLoading, firstRunDone]);

  useEffect(() => {
    if (dataLoading || !firstRunDone || tab !== "onboarding") return;
    setTab("today", { replace: true });
  }, [dataLoading, firstRunDone, setTab, tab]);

  const renderWithBehaviorFeedback = (content) => (
    <BehaviorFeedbackProvider>
      <>
        {content}
        <BehaviorFeedbackHost categories={visibleCategories} />
      </>
    </BehaviorFeedbackProvider>
  );

  if (dataLoading) {
    return renderWithBehaviorFeedback(
      <CommandLoadingState
        data-testid="user-data-loading-screen"
        className="appViewportFill"
        label="SYSTÈME"
        title="Chargement de ton système…"
        steps={["Connexion aux données", "Préparation du cockpit", "Synchronisation"]}
      />
    );
  }

  if (showPlanStep && firstRunDone) {
    return renderWithBehaviorFeedback(
      <>
        <Onboarding data={data} setData={setData} onDone={() => setTab("settings")} planOnly />
        <DiagnosticOverlay data={safeData} tab={tab} />
      </>
    );
  }
  if (!firstRunDone) {
    return renderWithBehaviorFeedback(
      <>
        <Onboarding data={data} setData={setData} onDone={() => setTab("today")} />
        <DiagnosticOverlay data={safeData} tab={tab} />
      </>
    );
  }

  if (tab === "onboarding") {
    return renderWithBehaviorFeedback(
      <CommandLoadingState
        data-testid="first-run-redirecting-screen"
        className="appViewportFill"
        label="SYSTÈME"
        title="Redirection vers ton cockpit…"
        steps={["Validation du parcours", "Ouverture de Today"]}
      />
    );
  }

  return renderWithBehaviorFeedback(
    <>
      {tab === "today" ? (
        <Home
          data={data}
          setData={setData}
          dataLoading={dataLoading}
          dataLoadError={dataLoadError}
          hasCachedData={hasCachedData}
          persistenceScope={persistenceScope}
          onOpenLibrary={homeNavigationHandlers.onOpenLibrary}
          onOpenCoachGuided={({ mode = "free", prefill = "" } = {}) => {
            setCoachState({
              mode: mode === "plan" ? "plan" : "free",
              conversationId: null,
              prefill: typeof prefill === "string" ? prefill : "",
            });
            setTab("coach");
          }}
          onOpenSecondaryRoute={(route) => {
            if (!route) return;
            setTab(route);
          }}
          onOpenAdjust={() => setTab("adjust")}
          onOpenPlanning={() => setTab("timeline")}
          onOpenPilotage={homeNavigationHandlers.onOpenPilotage}
          onOpenManageCategory={(categoryId) => {
            if (!categoryId) return;
            setLibraryCategoryId(categoryId);
            setData((prev) => ({
              ...prev,
              ui: withLibraryActiveCategoryId(prev.ui, categoryId),
            }));
            setTab("objectives");
          }}
          onOpenSession={({ categoryId, dateKey, occurrenceId }) =>
            openSessionSurface({
              sourceSurface: "today",
              categoryId,
              dateKey,
              occurrenceId,
            })
          }
          onOpenRecoverySheet={openRecoverySheet}
          onOpenDayAnalysisSheet={openDayAnalysisSheet}
          notificationCenter={{
            unreadCount: notificationEngine.unreadCount,
            onOpen: () => {
              setNotificationCenterOpen(true);
              notificationEngine.markNotificationCenterViewed();
            },
          }}
          onOpenPaywall={openPaywall}
          isPremiumPlan={isPremiumPlan}
          planLimits={planLimits}
          generationWindowDays={generationWindowDays}
          isPlanningUnlimited={planningUnlimited}
        />
      ) : tab === "timeline" ? (
        <Timeline
          data={data}
          setData={setData}
          setTab={setTab}
          onOpenRecoverySheet={openRecoverySheet}
          onOpenSession={({ categoryId, dateKey, occurrenceId }) =>
            openSessionSurface({
              sourceSurface: "timeline",
              categoryId,
              dateKey,
              occurrenceId,
            })
          }
          onEditItem={({ id, type, categoryId }) => {
            const nextId = categoryId || libraryCategoryId || null;
            if (nextId) {
              setData((prev) => ({
                ...prev,
                ui: withLibraryActiveCategoryId(prev.ui, nextId),
              }));
            }
            setEditItem({ id, type, categoryId: nextId, returnTab: tab, returnToCategoryView: false });
            setTab("edit-item", {
              editItemId: id,
              historyState: {
                origin: resolveRouteOrigin({ sourceSurface: "timeline", categoryId: nextId }),
                editItemId: id,
              },
            });
          }}
        />
      ) : tab === "category-detail" ? (
        <CategoryDetailView
          data={data}
          categoryId={detailCategoryId}
          onBack={() => {
            setCategoryDetailId(null);
            setTab("objectives");
          }}
          onOpenManage={() => {
            if (!detailCategoryId) return;
            setLibraryCategoryId(detailCategoryId);
            setData((prev) => ({
              ...prev,
              ui: withLibraryActiveCategoryId(prev.ui, detailCategoryId),
            }));
            setCategoryDetailId(null);
            setTab("objectives");
          }}
        />
      ) : tab === "category-progress" ? (
        <CategoryProgress
          data={data}
          categoryId={
            categoryProgressId ||
            resolveLibraryEntryCategoryId({ source: data, categories: data?.categories }) ||
            data?.categories?.[0]?.id ||
            null
          }
          onBack={() => {
            const fallbackId =
              categoryProgressId ||
              resolveLibraryEntryCategoryId({ source: data, categories: data?.categories }) ||
              data?.categories?.[0]?.id ||
              null;
            setCategoryProgressId(null);
            setLibraryCategoryId(fallbackId);
            setTab("objectives");
          }}
        />
      ) : tab === "adjust" ? (
        <Adjust
          data={data}
          setData={setData}
          onAdjustAction={handleAdjustAction}
          onOpenRecoverySheet={openRecoverySheet}
        />
      ) : tab === "objectives" ? (
        <Objectives
          data={data}
          setData={setData}
          onOpenCreateAction={(categoryId, outcomeId) =>
            launchActionCreate({
              sourceSurface: "objectives",
              categoryId: categoryId || libraryCategoryId || null,
              outcomeId: outcomeId || null,
            })
          }
          onEditItem={({ id, type, categoryId }) => {
            const nextId = categoryId || libraryCategoryId || null;
            if (nextId) {
              setData((prev) => ({
                ...prev,
                ui: withLibraryActiveCategoryId(prev.ui, nextId),
              }));
            }
            setEditItem({ id, type, categoryId: nextId, returnTab: tab, returnToCategoryView: false });
            setTab("edit-item", {
              editItemId: id,
              historyState: {
                origin: resolveRouteOrigin({ sourceSurface: "objectives", categoryId: nextId }),
                editItemId: id,
              },
            });
          }}
        />
      ) : tab === "edit-item" ? (
        <EditItem
          data={data}
          setData={setData}
          editItem={editItem}
          onBack={handleEditBack}
          generationWindowDays={generationWindowDays}
          onOpenPaywall={openPaywall}
        />
      ) : tab === "create-item" ? (
        <CreateItem
          data={data}
          setData={setData}
          taskOrigin={createTaskState?.origin || null}
          onCloseTask={handleCreateTaskClose}
          onOpenPaywall={openPaywall}
          canCreateAction={canCreateActionNow}
          canCreateOutcome={canCreateOutcomeNow}
          isPremiumPlan={isPremiumPlan}
          planLimits={planLimits}
          generationWindowDays={generationWindowDays}
        />
      ) : tab === "coach" ? (
        <CoachPage
          data={data}
          setData={setData}
          setTab={setTab}
          onOpenSession={({ categoryId, dateKey, occurrenceId }) =>
            openSessionSurface({
              sourceSurface: "coach",
              categoryId,
              dateKey,
              occurrenceId,
            })
          }
          requestedMode={coachState.mode}
          requestedConversationId={coachState.conversationId}
          requestedPrefill={coachState.prefill}
          onOpenAssistantCreate={openCoachAssistantCreate}
          onOpenCreatedView={openCoachCreatedView}
          onOpenPaywall={openPaywall}
          canCreateAction={canCreateActionNow}
          canCreateOutcome={canCreateOutcomeNow}
          isPremiumPlan={isPremiumPlan}
          planLimits={planLimits}
          generationWindowDays={generationWindowDays}
        />
      ) : tab === "session" ? (
        <Session
          data={data}
          setData={setData}
          sessionLaunchState={sessionLaunchState}
          setSessionLaunchState={setSessionLaunchState}
          categoryId={sessionCategoryId}
          dateKey={resolvedSessionDateKey}
          occurrenceId={sessionOccurrenceId}
          setTab={setTab}
          onQueueRecoveryAfterSessionCommit={queueRecoveryAfterSessionCommit}
          onOpenLibrary={() => setTab("objectives")}
          onOpenPaywall={openPaywall}
          ensureResolvedEntitlement={ensureResolved}
          entitlementAccess={entitlementAccess}
          isPremiumPlan={isPremiumPlan}
          onBack={() => {
            const returnTab =
              sessionLaunchState?.sourceSurface === "timeline"
                ? "timeline"
                : sessionLaunchState?.sourceSurface === "coach"
                  ? "coach"
                  : sessionLaunchState?.sourceSurface === "adjust" || sessionLaunchState?.sourceSurface === "insights"
                    ? "adjust"
                  : "today";
            setSessionLaunchState(null);
            setLibraryCategoryId(null);
            setTab(returnTab);
          }}
        />
      ) : tab === "journal" ? (
        <Journal data={data} setData={setData} onBack={handleSecondaryBack} />
      ) : tab === "micro-actions" ? (
        <MicroActions data={data} setData={setData} isPremiumPlan={isPremiumPlan} onBack={handleSecondaryBack} />
      ) : tab === "history" ? (
        <History data={data} onBack={handleSecondaryBack} />
      ) : tab === "account" ? (
        <Account data={data} onBack={handleSecondaryBack} />
      ) : tab === "billing" ? (
        <Subscription
          data={data}
          entitlementAccess={entitlementAccess}
          onBack={handleSecondaryBack}
          onOpenPaywall={openPaywall}
          onRefreshEntitlement={ensureResolved}
          onRestorePurchases={handleRestorePurchases}
        />
      ) : tab === "data" ? (
        <DataPage data={data} setData={setData} onOpenPaywall={openPaywall} onBack={handleSecondaryBack} />
      ) : tab === "privacy" ? (
        <Privacy data={data} onBack={handleSecondaryBack} onOpenSupport={() => setTab("support")} />
      ) : tab === "legal" ? (
        <Legal data={data} onBack={handleSecondaryBack} onOpenSupport={() => setTab("support")} />
      ) : tab === "support" ? (
        <Support data={data} onBack={handleSecondaryBack} />
      ) : tab === "faq" ? (
        <Faq data={data} setTab={setTab} onBack={handleSecondaryBack} />
      ) : tab === "settings" ? (
        <Preferences data={data} setData={setData} onBack={handleSecondaryBack} onNavigate={setTab} />
      ) : (
        <Preferences data={data} setData={setData} onBack={handleSecondaryBack} onNavigate={setTab} />
      )}
      {activeReminder ? (
        <AppDialog
          open
          onClose={() => setActiveReminder(null)}
          className="activeReminderDialog reminderPulse"
          maxWidth={420}
        >
          <div className="activeReminderBody">
            <div className="activeReminderText">
              <div className="titleSm">{activeReminder.reminder?.label || "Rappel"}</div>
              <div className="small2">
                {activeReminder.goal?.title || activeReminder.habit?.title || "Action"}
              </div>
              <div className="small2">
                {(() => {
                  const target = activeReminder.goal || activeReminder.habit;
                  const catId = target?.categoryId || null;
                  const cat = (data?.categories || []).find((c) => c.id === catId);
                  return cat?.name ? `Catégorie : ${cat.name}` : "Catégorie : —";
                })()}
              </div>
            </div>
            <AppActionRow className="activeReminderActions">
              <GhostButton onClick={() => setActiveReminder(null)}>Plus tard</GhostButton>
              <PrimaryButton
                onClick={() => {
                  const target = activeReminder.goal || activeReminder.habit;
                  const isProcess =
                    target &&
                    (target.type || target.kind || target.planType || "").toString().toUpperCase() !== "OUTCOME";
                  if (isProcess && target?.id) {
                    const todayKey = todayLocalKey();
                    const preview = ensureWindowFromScheduleRules(data, todayKey, todayKey, [target.id]);
                    const resolved = resolveExecutableOccurrence(preview, {
                      dateKey: todayKey,
                      goalIds: [target.id],
                    });
                    if (resolved.kind !== "ok" || !resolved.occurrenceId) {
                      setActiveReminder(null);
                      return;
                    }
                    setData((prev) => {
                      const ensured = ensureWindowFromScheduleRules(prev, todayKey, todayKey, [target.id]);
                      const prevUi = ensured.ui || {};
                      const existing =
                        prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
                      if (existing && isRuntimeSessionOpen(existing)) return ensured;

                      const resolvedNow = resolveExecutableOccurrence(ensured, {
                        dateKey: todayKey,
                        goalIds: [target.id],
                      });
                      if (resolvedNow.kind !== "ok" || !resolvedNow.occurrenceId) return ensured;
                      const occ =
                        (ensured.occurrences || []).find((o) => o && o.id === resolvedNow.occurrenceId) || null;
                      if (!occ) return ensured;

                      return applySessionRuntimeTransition(ensured, {
                        type: "start",
                        occurrenceId: occ.id,
                        dateKey: todayLocalKey(),
                        objectiveId: typeof target.parentId === "string" ? target.parentId : null,
                        habitIds: [occ.goalId || target.id],
                      });
                    });
                    emitSessionRuntimeNotificationHook("start", {
                      occurrenceId: resolved.occurrenceId,
                      dateKey: todayKey,
                      runtimePhase: "in_progress",
                      source: "reminder_start",
                    });
                  }
                  if (target?.categoryId) {
                    setData((prev) => ({
                      ...prev,
                      ui: withExecutionActiveCategoryId(prev.ui, target.categoryId),
                    }));
                    setTab("adjust");
                  }
                  setActiveReminder(null);
                }}
              >
                Commencer
              </PrimaryButton>
            </AppActionRow>
          </div>
        </AppDialog>
      ) : null}
      {showTourOverlay ? (
        <TourOverlay
          isActive={tour.isActive}
          step={tour.step}
          stepIndex={tour.stepIndex}
          totalSteps={tour.totalSteps}
          onNext={tour.next}
          onPrev={tour.prev}
          onSkip={tour.skip}
          onMissingAnchor={tour.handleMissingAnchor}
          onAnchorFound={tour.handleAnchorFound}
        />
      ) : null}
      <DiagnosticOverlay data={safeData} tab={tab} />
      <PaywallModal
        open={paywallOpen}
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
        onSubscribeMonthly={handlePurchase}
        onSubscribeYearly={handlePurchase}
        onRestore={handleRestorePurchases}
        onOpenTerms={() => setTab("legal")}
        onOpenPrivacy={() => setTab("privacy")}
      />
      {notificationEngine.nudge && !activeReminder && !paywallOpen && !hideNavigationChrome ? (
        <InAppNudge
          nudge={notificationEngine.nudge}
          onDismiss={notificationEngine.dismissNudge}
          onAction={notificationEngine.clickNudge}
          onPauseAutoDismiss={notificationEngine.pauseToastAutoDismiss}
          onResumeAutoDismiss={notificationEngine.resumeToastAutoDismiss}
          placement={tab === "today" ? "home" : "top"}
        />
      ) : null}
      <NotificationCenter
        open={notificationCenterOpen}
        items={notificationEngine.centerItems}
        onClose={() => setNotificationCenterOpen(false)}
        onAction={(item) => {
          notificationEngine.clickNotificationCenterItem(item);
          setNotificationCenterOpen(false);
        }}
      />
      <DayAnalysisSheet
        open={dayAnalysisSheetState.open}
        state={dayAnalysisSheetState.phase}
        result={dayAnalysisSheetState.result}
        selectedActionId={dayAnalysisSheetState.selectedActionId}
        pending={dayAnalysisSheetState.pending}
        error={dayAnalysisSheetState.error}
        successSummary={dayAnalysisSheetState.successSummary}
        onClose={closeDayAnalysisSheet}
        onLaunch={launchDayAnalysis}
        onRetry={launchDayAnalysis}
        onSelectAction={handleDayAnalysisSelectAction}
        onPrepareValidation={routeDayAnalysisAction}
        onConfirmApply={confirmDayAnalysisApply}
        onBackToResult={handleDayAnalysisBackToResult}
        onOpenCoach={routeDayAnalysisAction}
        onOpenPlanning={routeDayAnalysisAction}
      />
      <UnifiedRecoverySheet
        open={Boolean(recoverySheetState.request)}
        recoveryContext={recoverySheetContext || recoverySheetState.request?.context || null}
        problem={recoverySheetContext?.problem || null}
        options={recoverySheetContext?.options || []}
        pending={recoverySheetState.pending}
        result={recoverySheetState.result}
        error={recoverySheetState.error}
        onClose={closeRecoverySheet}
        onSelectOption={commitRecoveryOption}
        onConfirmOption={commitRecoveryOption}
        onOpenCoach={openRecoveryCoach}
        onOpenPlanning={openRecoveryPlanningDetail}
        successCtaLabel={getRecoverySuccessCtaLabel(recoverySheetState.request?.successTab)}
      />
      {showBottomRail ? (
        <BottomNavigation
          ref={bottomRailRef}
          activeTab={tab}
          onSelect={handleBottomNavigationSelect}
          signalBadges={adjustSignalBadge ? { adjust: adjustSignalBadge } : undefined}
        />
      ) : null}
    </>
  );
}
