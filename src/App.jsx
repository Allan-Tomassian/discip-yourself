import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import TopNav from "./components/TopNav";
import CategoryRail from "./components/CategoryRail";
import MainDrawer from "./components/navigation/MainDrawer";
import {
  ensureSystemInboxCategory,
  migrate,
} from "./logic/state";
import { autoActivateScheduledGoals } from "./logic/goals";
import PlusExpander from "./components/PlusExpander";
import { markIOSRootClass } from "./utils/dialogs";
import { readAiBackendBaseUrl } from "./infra/aiNowClient";
import { logAiBackendTargetOnce } from "./infra/aiTransportDiagnostics";
import {
  AppActionRow,
  AppCard,
  AppDialog,
  AppSurface,
  GhostButton,
  PrimaryButton,
} from "./shared/ui/app";
import "./app/appShell.css";
import "./features/navigation/bottomCategoryBar.css";
import "./features/navigation/navPillUnified.css";

import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Planning from "./pages/Planning";
import Categories from "./pages/Categories";
import TotemDockLayer from "./ui/totem/TotemDockLayer";
import Preferences from "./pages/Preferences";
import Account from "./pages/Account";
import Subscription from "./pages/Subscription";
import DataPage from "./pages/Data";
import Faq from "./pages/Faq";
import History from "./pages/History";
import Journal from "./pages/Journal";
import Legal from "./pages/Legal";
import MicroActions from "./pages/MicroActions";
import CategoryView from "./pages/CategoryView";
import EditItem from "./pages/EditItem";
import CreateItem from "./pages/CreateItem";
import CategoryDetailView from "./pages/CategoryDetailView";
import CategoryProgress from "./pages/CategoryProgress";
import Session from "./pages/Session";
import Pilotage from "./pages/Pilotage";
import Privacy from "./pages/Privacy";
import Support from "./pages/Support";
import CoachPanel from "./features/coach/CoachPanel";
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
import { useAppNavigation } from "./hooks/useAppNavigation";
import { useEntitlementsPaywall } from "./hooks/useEntitlementsPaywall";
import { useRemindersLoop } from "./hooks/useRemindersLoop";
import { useSessionRuntimeLoop } from "./hooks/useSessionRuntimeLoop";
import { useCreateFlowOrchestration } from "./hooks/useCreateFlowOrchestration";
import { useCategorySelectionSync } from "./hooks/useCategorySelectionSync";
import { getInboxId } from "./app/inbox";
import { createHomeNavigationHandlers } from "./app/homeNavigation";
import { resolveCoachCreatedViewTarget } from "./app/coachCreatedViewTarget";
import {
  normalizeRouteOrigin,
  resolveActiveTopNavTab,
  resolveMainTabForSurface,
  resolveRouteOriginLibraryMode,
} from "./app/routeOrigin";
import { useUserData } from "./data/useUserData";
import { useProfile } from "./profile/useProfile";
import { isProfileComplete } from "./profile/profileApi";
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
import { BehaviorFeedbackHost, BehaviorFeedbackProvider } from "./feedback/BehaviorFeedbackContext";

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

function normalizeWalletPreview(wallet) {
  const source = wallet && typeof wallet === "object" ? wallet : {};
  const balance = Number.isFinite(source.balance) ? Math.max(0, Math.floor(source.balance)) : 0;
  const lastEvents = Array.isArray(source.lastEvents)
    ? source.lastEvents.filter((event) => event && typeof event === "object")
    : [];
  const lastReward = [...lastEvents]
    .reverse()
    .find((event) => (event.type === "micro_done" || event.type === "ad_reward") && Number(event.amount) > 0);
  const deltaAmount = Number.isFinite(lastReward?.amount) ? Math.max(0, Math.floor(lastReward.amount)) : 0;
  const deltaKey = lastReward ? `${lastReward.ts || 0}:${lastReward.type || ""}:${deltaAmount}` : "";
  return { balance, deltaAmount, deltaKey };
}

const COACH_FAB_OFFSET_STORAGE_KEY = "coach:fab-offset-y:v1";

function loadCoachFabOffset() {
  if (typeof window === "undefined") return -10;
  try {
    const parsed = Number.parseFloat(window.localStorage.getItem(COACH_FAB_OFFSET_STORAGE_KEY) || "");
    return Number.isFinite(parsed) ? parsed : -10;
  } catch {
    return -10;
  }
}

function persistCoachFabOffset(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COACH_FAB_OFFSET_STORAGE_KEY, String(Math.round(value)));
  } catch {
    // Ignore storage failures.
  }
}

export default function App() {
  const { profile: supabaseProfile } = useProfile();
  const profileNeedsCompletion = !isProfileComplete(supabaseProfile);
  const { data, setData, loading: dataLoading, persistenceScope } = useUserData();
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
    coachAliasRequest,
    consumeCoachAliasRequest,
  } = useAppNavigation({ safeData, setData });
  const [editItem, setEditItem] = useState(null);
  const [createTaskState, setCreateTaskState] = useState(null);
  const [coachState, setCoachState] = useState({
    open: false,
    mode: "free",
    conversationId: null,
  });
  const dataRef = useRef(data);
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
    planLimits,
    isPremiumPlan,
    generationWindowDays,
    planningUnlimited,
    canCreateOutcomeNow,
    canCreateActionNow,
  } = useEntitlementsPaywall({ safeData, setData });
  const topWalletPreview = useMemo(
    () => normalizeWalletPreview(safeData?.ui?.walletV1),
    [safeData?.ui?.walletV1]
  );
  const isDrawerOpen = Boolean(safeData?.ui?.isDrawerOpen);
  const coachOpen = Boolean(coachState.open);
  const [coachFabOffsetY, setCoachFabOffsetY] = useState(() => loadCoachFabOffset());
  const coachFabOffsetRef = useRef(coachFabOffsetY);
  const coachFabDraggedRef = useRef(false);
  const bottomRailRef = useRef(null);

  useEffect(() => {
    coachFabOffsetRef.current = coachFabOffsetY;
  }, [coachFabOffsetY]);

  const setDrawerOpen = (open) => {
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      if (Boolean(prevUi.isDrawerOpen) === Boolean(open)) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          isDrawerOpen: Boolean(open),
        },
      };
    });
  };

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

  const currentTab = tab;
  const taskActiveTab =
    currentTab === "create-item"
      ? createTaskState?.origin?.mainTab || "library"
      : currentTab === "edit-item"
        ? editItem?.returnTab || "library"
        : null;
  const activeTopNavTab = resolveActiveTopNavTab({
    currentTab,
    taskMainTab: taskActiveTab,
    editReturnTab: editItem?.returnTab || null,
  });
  const resolvedSessionDateKey =
    (typeof sessionDateKey === "string" && sessionDateKey) ||
    (typeof safeData?.ui?.selectedDateKey === "string" && safeData.ui.selectedDateKey) ||
    (typeof safeData?.ui?.selectedDate === "string" && safeData.ui.selectedDate) ||
    todayLocalKey();
  const topNav = (
    <TopNav
      active={activeTopNavTab}
      setActive={(next) => {
        if (next === "library") {
          openLibraryDetail();
          return;
        }
        setTab(next);
      }}
      onMenuOpen={() => setDrawerOpen(true)}
      coinsBalance={topWalletPreview.balance}
      coinDeltaAmount={topWalletPreview.deltaAmount}
      coinDeltaKey={topWalletPreview.deltaKey}
    />
  );

  // Single header: keep TopNav only (prevents duplicate logo/title)
  const headerStack = topNav;
  // Spacer under the fixed header stack (TopNav + wordmark). Keep it tight to avoid a big empty gap.
  const headerSpacer = null;
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
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
  const orderedCategories = useMemo(() => {
    const map = new Map(visibleCategories.map((c) => [c.id, c]));
    return categoryRailOrder.map((id) => map.get(id)).filter(Boolean);
  }, [visibleCategories, categoryRailOrder]);
  const railCategories = orderedCategories;
  const {
    homeActiveCategoryId,
    selectedCategoryId,
    openLibraryDetail,
    handleSelectCategory,
    railSelectedId,
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
    hasDraft,
    plusOpen,
    plusAnchorRect,
    plusAnchorElRef,
    openCreateExpander,
    closePlusExpander,
    handleChooseObjective,
    handleChooseAction,
    resumeCreateDraft,
    openCreateOutcome,
    openCreateAction,
    openCreateGuided,
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
    const returnTab = editItem?.returnTab || "library";
    if (returnTab === "library") {
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
      returnTab: "library",
      returnToCategoryView: Boolean(goal.categoryId),
    });
  }, [editItem, editItemId, safeData.goals, tab]);

  const resolveRouteOrigin = useCallback(
    ({ sourceSurface, categoryId = null, coachConversationId = null } = {}) => {
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
          mainTab === "today" || mainTab === "planning" || contextSurface === "today" || contextSurface === "planning"
            ? resolvedSessionDateKey
            : null,
        occurrenceId: contextSurface === "session" ? sessionOccurrenceId || null : null,
        libraryMode: resolveRouteOriginLibraryMode({
          mainTab,
          sourceSurface: contextSurface,
          categoryId: contextSurface === "library" ? effectiveCategoryId : libraryCategoryId || effectiveCategoryId,
        }),
        coachConversationId: coachConversationId || null,
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
      if (origin.mainTab === "library") {
        setLibraryCategoryId(origin.libraryMode === "category-view" ? effectiveCategoryId : null);
        if (effectiveCategoryId) {
          setData((previous) => ({
            ...previous,
            ui: withLibraryActiveCategoryId(previous.ui, effectiveCategoryId),
          }));
        }
        return;
      }
      if (effectiveCategoryId && (origin.mainTab === "today" || origin.mainTab === "planning" || origin.mainTab === "pilotage")) {
        setData((previous) => ({
          ...previous,
          ui: withExecutionActiveCategoryId(previous.ui, effectiveCategoryId),
        }));
      }
    },
    [setData, setLibraryCategoryId]
  );

  const handleCreateTaskClose = useCallback(
    ({ outcome = "cancel", origin: rawOrigin = null, createdCategoryId = null } = {}) => {
      const origin = normalizeRouteOrigin(rawOrigin || createTaskState?.origin || resolveRouteOrigin({ sourceSurface: tab }));
      restoreTaskOriginContext({ origin, createdCategoryId });
      setCreateTaskState(null);

      if (origin?.sourceSurface === "coach" || origin?.coachConversationId) {
        setTab(origin.mainTab || "today");
        setCoachState({
          open: true,
          mode: "plan",
          conversationId: origin?.coachConversationId || null,
        });
        return;
      }
      setTab(origin?.mainTab || "today");
    },
    [createTaskState?.origin, resolveRouteOrigin, restoreTaskOriginContext, setTab, tab]
  );

  const openCoach = useCallback(
    ({ mode = "free", conversationId = null } = {}) => {
      setDrawerOpen(false);
      closePlusExpander?.();
      setCoachState({
        open: true,
        mode: mode === "plan" ? "plan" : "free",
        conversationId: conversationId || null,
      });
    },
    [closePlusExpander]
  );

  const openCoachStructuring = useCallback(
    ({ conversationId = null } = {}) => {
      openCoach({ mode: "plan", conversationId });
    },
    [openCoach]
  );

  const openCoachAssistantCreate = useCallback(
    ({ sourceSurface = "coach", conversationId = null, proposal } = {}) => {
      const origin = resolveRouteOrigin({ sourceSurface, coachConversationId: conversationId });
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
      setTab("library");
    },
    [safeData.goals, setData, setLibraryCategoryId, setTab]
  );

  const launchActionCreate = useCallback(
    ({ sourceSurface, categoryId = null, outcomeId = null } = {}) => {
      const origin = resolveRouteOrigin({ sourceSurface, categoryId });
      setCreateTaskState({ origin, kind: "action" });
      openCreateAction({ source: sourceSurface, categoryId, outcomeId });
    },
    [openCreateAction, resolveRouteOrigin]
  );

  const launchOutcomeCreate = useCallback(
    ({ sourceSurface, categoryId = null } = {}) => {
      const origin = resolveRouteOrigin({ sourceSurface, categoryId });
      setCreateTaskState({ origin, kind: "outcome" });
      openCreateOutcome({ source: sourceSurface, categoryId });
    },
    [openCreateOutcome, resolveRouteOrigin]
  );

  const launchGuidedCreate = useCallback(
    ({ sourceSurface, categoryId = null } = {}) => {
      const origin = resolveRouteOrigin({ sourceSurface, categoryId });
      setCreateTaskState({ origin, kind: "guided" });
      openCreateGuided({ source: sourceSurface, categoryId });
    },
    [openCreateGuided, resolveRouteOrigin]
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
      ["today", "planning", "library", "pilotage"].forEach((key) => {
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
  const onboardingCompleted = Boolean(safeData.ui?.onboardingCompleted);
  const showPlanStep = Boolean(safeData.ui?.showPlanStep);
  const showTourOverlay = onboardingCompleted;
  const handlePlanCategory = ({ categoryId } = {}) => {
    launchGuidedCreate({ sourceSurface: "pilotage", categoryId });
  };

  const showBottomRail = tab === "today" || tab === "planning" || tab === "library" || tab === "pilotage";
  const coachFabVisibleTabs = useMemo(
    () => new Set(["today", "planning", "library", "pilotage", "category-detail", "category-progress"]),
    []
  );
  const hasCoachBlockingOverlay =
    isDrawerOpen ||
    plusOpen ||
    paywallOpen ||
    Boolean(activeReminder) ||
    Boolean(showTourOverlay && tour.isActive) ||
    tab === "create-item";
  const totemDockLayer = <TotemDockLayer data={safeData} setData={setData} />;
  const routeCloseSigRef = useRef("");

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
    const nextSig = [
      tab,
      categoryDetailId || "",
      categoryProgressId || "",
      libraryCategoryId || "",
      sessionOccurrenceId || "",
      sessionDateKey || "",
    ].join("|");
    if (!routeCloseSigRef.current) {
      routeCloseSigRef.current = nextSig;
      return;
    }
    if (routeCloseSigRef.current === nextSig) return;
    routeCloseSigRef.current = nextSig;
    setDrawerOpen(false);
  }, [
    categoryDetailId,
    categoryProgressId,
    libraryCategoryId,
    sessionDateKey,
    sessionOccurrenceId,
    tab,
  ]);

  useEffect(() => {
    if (!coachOpen) return;
    if (!coachFabVisibleTabs.has(tab) || hasCoachBlockingOverlay) {
      setCoachState((previous) => ({ ...previous, open: false }));
    }
  }, [coachFabVisibleTabs, coachOpen, hasCoachBlockingOverlay, tab]);

  useEffect(() => {
    if (!coachAliasRequest) return;
    setTab(coachAliasRequest.mainTab || "today", { replace: true });
    setCoachState({
      open: true,
      mode: coachAliasRequest.mode === "plan" ? "plan" : "free",
      conversationId: coachAliasRequest.conversationId || null,
    });
    consumeCoachAliasRequest();
  }, [coachAliasRequest, consumeCoachAliasRequest, setTab]);

  const handleCoachFabPointerDown = useCallback(
    (event) => {
      if (event.button != null && event.button !== 0) return;
      const startY = event.clientY;
      const startOffset = coachFabOffsetRef.current;
      const maxOffset = showBottomRail ? 6 : 24;
      const minOffset = -Math.max(140, (typeof window !== "undefined" ? window.innerHeight : 0) - 240);
      coachFabDraggedRef.current = false;

      const handlePointerMove = (moveEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const nextOffset = Math.max(minOffset, Math.min(maxOffset, startOffset + deltaY));
        if (Math.abs(nextOffset - startOffset) > 4) coachFabDraggedRef.current = true;
        setCoachFabOffsetY(nextOffset);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        persistCoachFabOffset(coachFabOffsetRef.current);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [showBottomRail]
  );

  useEffect(() => {
    if (typeof window === "undefined" || dataLoading) return;
    if (!onboardingCompleted && window.location.pathname !== "/onboarding") {
      window.history.replaceState({}, "", "/onboarding");
    }
  }, [dataLoading, onboardingCompleted]);

  const profileReminder = profileNeedsCompletion && onboardingCompleted && tab !== "account" ? (
    <div className="profileReminderShell">
      <AppCard className="profileReminderCard">
        <div className="profileReminderContent">
          <div className="profileReminderText">
            <div className="titleSm">Complète ton compte</div>
            <div className="small">Ajoute ton username pour finaliser ton profil public.</div>
          </div>
          <PrimaryButton type="button" onClick={() => setTab("account")}>
            Ouvrir
          </PrimaryButton>
        </div>
      </AppCard>
    </div>
  ) : null;

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
      <div
        data-testid="user-data-loading-screen"
        className="appViewportFill"
        style={{ display: "grid", placeItems: "center", padding: 24 }}
      >
        <p>Chargement...</p>
      </div>
    );
  }

  if (showPlanStep && onboardingCompleted) {
    return renderWithBehaviorFeedback(
      <>
        {headerStack}
        {headerSpacer}
        <MainDrawer open={isDrawerOpen} active={tab} onClose={() => setDrawerOpen(false)} onNavigate={setTab} />
        <Onboarding data={data} setData={setData} onDone={() => setTab("settings")} planOnly />
        <DiagnosticOverlay data={safeData} tab={tab} />
        {totemDockLayer}
        <PlusExpander
          open={plusOpen}
          anchorRect={plusAnchorRect}
          anchorEl={plusAnchorElRef.current}
          onClose={closePlusExpander}
          onChooseObjective={handleChooseObjective}
          onChooseAction={handleChooseAction}
          onChooseStructuring={() => openCoachStructuring()}
          onResumeDraft={hasDraft ? resumeCreateDraft : null}
          hasDraft={hasDraft}
        />
      </>
    );
  }
  if (!onboardingCompleted) {
    return renderWithBehaviorFeedback(
      <>
        <Onboarding data={data} setData={setData} onDone={() => setTab("today")} />
        <DiagnosticOverlay data={safeData} tab={tab} />
        {totemDockLayer}
      </>
    );
  }

  return renderWithBehaviorFeedback(
    <>
      {headerStack}
      {headerSpacer}
      <MainDrawer open={isDrawerOpen} active={tab} onClose={() => setDrawerOpen(false)} onNavigate={setTab} />
      {profileReminder}
      {showBottomRail ? (
        <div ref={bottomRailRef} className="bottomCategoryBar" data-tour-id="topnav-rail">
          <div className="BottomBarSurfaceOuter GateGlassOuter">
            <div className="BottomBarSurfaceClip BottomBarBackdrop GateGlassClip GateGlassBackdrop">
              <AppSurface className="bottomCategoryBarPanel GateGlassContent">
                <div className="bottomCategoryBarRow">
                  <CategoryRail
                    categories={railCategories}
                    selectedCategoryId={railSelectedId}
                    onSelect={handleSelectCategory}
                  />
                  <button
                    type="button"
                    className="bottomCategoryPlus NavPillUnified NavPillUnified--iconOnly"
                    aria-label="Créer"
                    title="Créer"
                    data-create-anchor="bottomrail"
                    data-testid="create-plus-button"
                    onClick={(event) => {
                      const el = event?.currentTarget || null;
                      const rect = el?.getBoundingClientRect ? el.getBoundingClientRect() : null;
                      openCreateExpander({
                        source: tab,
                        categoryId: railSelectedId || selectedCategoryId || homeActiveCategoryId || null,
                        anchorEl: el,
                        anchorRect: rect,
                      });
                    }}
                  >
                    +
                  </button>
                </div>
              </AppSurface>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "onboarding" ? (
        <Onboarding data={data} setData={setData} onDone={() => setTab("today")} />
      ) : tab === "today" ? (
        <Home
          data={data}
          setData={setData}
          persistenceScope={persistenceScope}
          onOpenLibrary={homeNavigationHandlers.onOpenLibrary}
          onOpenPlanning={() => setTab("planning")}
          onOpenPilotage={homeNavigationHandlers.onOpenPilotage}
          onOpenManageCategory={(categoryId) => {
            if (!categoryId) return;
            setLibraryCategoryId(categoryId);
            setData((prev) => ({
              ...prev,
              ui: withLibraryActiveCategoryId(prev.ui, categoryId),
            }));
            setTab("library");
          }}
          onOpenCreateOutcome={() => {
            launchOutcomeCreate({ sourceSurface: "today" });
          }}
          onOpenCreateHabit={() => {
            launchActionCreate({ sourceSurface: "today" });
          }}
          onOpenSession={({ categoryId, dateKey, occurrenceId }) =>
            setTab("session", {
              sessionCategoryId: categoryId || null,
              sessionDateKey: dateKey || null,
              sessionOccurrenceId: occurrenceId || null,
            })
          }
          onOpenPaywall={openPaywall}
          isPremiumPlan={isPremiumPlan}
          planLimits={planLimits}
          generationWindowDays={generationWindowDays}
          isPlanningUnlimited={planningUnlimited}
        />
      ) : tab === "planning" ? (
        <Planning
          data={data}
          setData={setData}
          persistenceScope={persistenceScope}
          setTab={setTab}
          onOpenCoach={openCoach}
        />
      ) : tab === "category-detail" ? (
        <CategoryDetailView
          data={data}
          categoryId={detailCategoryId}
          onOpenManage={() => {
            if (!detailCategoryId) return;
            setLibraryCategoryId(detailCategoryId);
            setData((prev) => ({
              ...prev,
              ui: withLibraryActiveCategoryId(prev.ui, detailCategoryId),
            }));
            setCategoryDetailId(null);
            setTab("library");
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
            setTab("library");
          }}
        />
      ) : tab === "pilotage" ? (
        <Pilotage
          data={data}
          setData={setData}
          persistenceScope={persistenceScope}
          onPlanCategory={handlePlanCategory}
          generationWindowDays={generationWindowDays}
          isPlanningUnlimited={planningUnlimited}
          onOpenCoach={openCoach}
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
      ) : tab === "library" && libraryCategoryId ? (
        <CategoryView
          data={data}
          setData={setData}
          categoryId={libraryCategoryId}
          onBack={() => setLibraryCategoryId(null)}
          onOpenPilotage={() => {
            setLibraryCategoryId(null);
            setTab("pilotage");
          }}
          onOpenCreateOutcome={(nextCategoryId) => {
            launchOutcomeCreate({ sourceSurface: "library", categoryId: nextCategoryId || libraryCategoryId });
          }}
          onOpenCreateHabit={(nextCategoryId) => {
            launchActionCreate({ sourceSurface: "library", categoryId: nextCategoryId || libraryCategoryId });
          }}
          onOpenProgress={(categoryIdValue) => {
            if (!categoryIdValue) return;
            setCategoryProgressId(categoryIdValue);
            setTab("category-progress", { categoryProgressId: categoryIdValue });
          }}
          onEditItem={({ id, type, categoryId }) => {
            const nextId = categoryId || libraryCategoryId || null;
            if (nextId) {
              setLibraryCategoryId(nextId);
              setData((prev) => ({
                ...prev,
                ui: withLibraryActiveCategoryId(prev.ui, nextId),
              }));
            }
            setEditItem({ id, type, categoryId: nextId, returnTab: tab, returnToCategoryView: true });
            setTab("edit-item", {
              editItemId: id,
              historyState: {
                origin: resolveRouteOrigin({ sourceSurface: "library", categoryId: nextId }),
                editItemId: id,
              },
            });
          }}
        />
      ) : tab === "library" ? (
        <Categories
          data={data}
          setData={setData}
          onOpenPaywall={openPaywall}
          onOpenCreateOutcome={() => {
            launchOutcomeCreate({ sourceSurface: "library" });
          }}
          onEditItem={({ id, type, categoryId }) => {
            const nextId =
              categoryId ||
              resolveLibraryEntryCategoryId({ source: data, categories: data?.categories }) ||
              null;
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
                origin: resolveRouteOrigin({ sourceSurface: "library", categoryId: nextId }),
                editItemId: id,
              },
            });
          }}
        />
      ) : tab === "session" ? (
        <Session
          data={data}
          setData={setData}
          categoryId={sessionCategoryId}
          dateKey={resolvedSessionDateKey}
          occurrenceId={sessionOccurrenceId}
          setTab={setTab}
          onOpenLibrary={() => setTab("library")}
          onBack={() => {
            setLibraryCategoryId(null);
            setTab("today");
          }}
        />
      ) : tab === "journal" ? (
        <Journal data={data} setData={setData} />
      ) : tab === "micro-actions" ? (
        <MicroActions data={data} setData={setData} isPremiumPlan={isPremiumPlan} />
      ) : tab === "history" ? (
        <History data={data} />
      ) : tab === "account" ? (
        <Account data={data} />
      ) : tab === "billing" ? (
        <Subscription data={data} onOpenPaywall={openPaywall} onRestorePurchases={handleRestorePurchases} />
      ) : tab === "data" ? (
        <DataPage data={data} setData={setData} onOpenPaywall={openPaywall} />
      ) : tab === "privacy" ? (
        <Privacy data={data} onOpenSupport={() => setTab("support")} />
      ) : tab === "legal" ? (
        <Legal data={data} onOpenSupport={() => setTab("support")} />
      ) : tab === "support" ? (
        <Support data={data} />
      ) : tab === "faq" ? (
        <Faq data={data} setTab={setTab} />
      ) : tab === "settings" ? (
        <Preferences data={data} setData={setData} />
      ) : (
        <Preferences data={data} setData={setData} />
      )}
      {coachFabVisibleTabs.has(tab) && !hasCoachBlockingOverlay ? (
        <button
          type="button"
          className={`coachFab${showBottomRail ? " has-rail" : ""}${coachOpen ? " is-open" : ""}`}
          data-testid="coach-fab"
          style={{ "--coach-fab-offset-y": `${coachFabOffsetY}px` }}
          onPointerDown={handleCoachFabPointerDown}
          onClick={() => {
            if (coachFabDraggedRef.current) {
              coachFabDraggedRef.current = false;
              return;
            }
            if (coachOpen) {
              setCoachState((previous) => ({ ...previous, open: false }));
              return;
            }
            openCoach({ mode: "free" });
          }}
          aria-label="Coach"
        >
          <span className="coachFabDot" aria-hidden="true" />
          <span>Coach</span>
        </button>
      ) : null}
      <CoachPanel
        open={coachOpen}
        onClose={() => setCoachState((previous) => ({ ...previous, open: false }))}
        data={data}
        setData={setData}
        setTab={setTab}
        surfaceTab={tab}
        requestedMode={coachState.mode}
        requestedConversationId={coachState.conversationId}
        onOpenAssistantCreate={openCoachAssistantCreate}
        onOpenCreatedView={openCoachCreatedView}
        onOpenPaywall={openPaywall}
        canCreateAction={canCreateActionNow}
        canCreateOutcome={canCreateOutcomeNow}
        isPremiumPlan={isPremiumPlan}
        planLimits={planLimits}
        generationWindowDays={generationWindowDays}
      />

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
                    setTab("pilotage");
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
        <PlusExpander
          open={plusOpen}
          anchorRect={plusAnchorRect}
          anchorEl={plusAnchorElRef.current}
          onClose={closePlusExpander}
          onChooseObjective={handleChooseObjective}
          onChooseAction={handleChooseAction}
          onChooseStructuring={() => openCoachStructuring()}
          onResumeDraft={hasDraft ? resumeCreateDraft : null}
          hasDraft={hasDraft}
        />
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
      {totemDockLayer}
    </>
  );
}
