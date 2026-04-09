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
import "./app/appShell.css";
import "./styles/lovable.css";

import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Objectives from "./pages/Objectives";
import Timeline from "./pages/Timeline";
import Insights from "./pages/Insights";
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
import LovableTabBar from "./components/navigation/LovableTabBar";
import LovableCreateMenu from "./components/navigation/LovableCreateMenu";
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
import {
  commitPreparedCreatePlan,
  prepareCreateCommit,
} from "./features/create-item/createItemCommit";
import {
  buildUniversalCaptureCoachPrefill,
  resolveUniversalCaptureDecision,
} from "./features/universal-capture/universalCapture";
import { getInboxId } from "./app/inbox";
import { createHomeNavigationHandlers } from "./app/homeNavigation";
import { resolveCoachCreatedViewTarget } from "./app/coachCreatedViewTarget";
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
import { resolveGoalType } from "./domain/goalType";
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

export default function App() {
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
  const [universalCapturePreview, setUniversalCapturePreview] = useState(null);
  const [coachState, setCoachState] = useState({
    mode: "free",
    conversationId: null,
    prefill: "",
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
  const onboardingCompleted = Boolean(safeData.ui?.onboardingCompleted);
  const showPlanStep = Boolean(safeData.ui?.showPlanStep);
  const bottomRailRef = useRef(null);

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
  const hideNavigationChrome =
    Boolean(showPlanStep) ||
    tab === "create-item" ||
    tab === "edit-item" ||
    tab === "session" ||
    tab === "onboarding";
  const showBottomRail = !hideNavigationChrome && new Set(["today", "objectives", "timeline", "insights", "coach"]).has(tab);
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
    hasDraft,
    plusOpen,
    plusAnchorRect,
    plusContext,
    openCreateExpander,
    closePlusExpander,
    resumeCreateDraft,
    openCreateOutcome,
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
      if (effectiveCategoryId && (origin.mainTab === "today" || origin.mainTab === "timeline" || origin.mainTab === "insights")) {
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

  const launchOutcomeCreate = useCallback(
    ({ sourceSurface, categoryId = null, initialTitle = "", draftOverrides = null } = {}) => {
      const origin = resolveRouteOrigin({ sourceSurface, categoryId });
      setCreateTaskState({ origin, kind: "outcome" });
      openCreateOutcome({ source: sourceSurface, categoryId, initialTitle, draftOverrides });
    },
    [openCreateOutcome, resolveRouteOrigin]
  );

  const handleUniversalCaptureClose = useCallback(() => {
    setUniversalCapturePreview(null);
    closePlusExpander();
  }, [closePlusExpander]);

  const handleUniversalCaptureSubmit = useCallback(
    (rawText) => {
      const categoryId =
        plusContext?.categoryId || libraryCategoryId || selectedCategoryId || homeActiveCategoryId || null;
      const categoryLabel = visibleCategories.find((category) => category?.id === categoryId)?.name || "";
      const decision = resolveUniversalCaptureDecision(rawText, {
        categoryId,
        categoryLabel,
      });

      if (
        (decision.route === "direct_action" || decision.route === "direct_goal") &&
        decision.confidence === "high" &&
        decision.preview
      ) {
        setUniversalCapturePreview(decision.preview);
        return;
      }

      setUniversalCapturePreview(null);
      closePlusExpander();
      const coachRoute =
        decision.route === "coach_structuring" || decision.route === "coach_clarify"
          ? decision.route
          : decision.fallbackCoachRoute;

      setCoachState({
        mode: coachRoute === "coach_structuring" ? "plan" : "free",
        conversationId: null,
        prefill: buildUniversalCaptureCoachPrefill({
          route: coachRoute,
          text: decision.normalizedText,
        }),
      });
      setTab("coach");
    },
    [
      closePlusExpander,
      homeActiveCategoryId,
      libraryCategoryId,
      plusContext,
      selectedCategoryId,
      setTab,
      visibleCategories,
    ]
  );

  const handleUniversalCapturePreviewAdjust = useCallback(() => {
    const preview = universalCapturePreview;
    if (!preview) return;
    const sourceSurface = plusContext?.source || "objectives";
    const categoryId =
      preview.categoryId || plusContext?.categoryId || libraryCategoryId || selectedCategoryId || homeActiveCategoryId || null;

    setUniversalCapturePreview(null);
    closePlusExpander();

    if (preview.kind === "action") {
      launchActionCreate({
        sourceSurface,
        categoryId,
        initialTitle: preview.title,
        draftOverrides: preview.actionDraft ? { actionDraft: preview.actionDraft } : null,
      });
      return;
    }

    launchOutcomeCreate({
      sourceSurface,
      categoryId,
      initialTitle: preview.title,
      draftOverrides: preview.outcomeDraft ? { outcomeDraft: preview.outcomeDraft } : null,
    });
  }, [
    closePlusExpander,
    homeActiveCategoryId,
    launchActionCreate,
    launchOutcomeCreate,
    libraryCategoryId,
    plusContext,
    selectedCategoryId,
    universalCapturePreview,
  ]);

  const handleUniversalCapturePreviewCreate = useCallback(() => {
    const preview = universalCapturePreview;
    if (!preview) return;

    const preparedCommit = prepareCreateCommit({
      state: safeData,
      kind: preview.kind === "goal" ? "outcome" : "action",
      actionDraft: preview.actionDraft,
      outcomeDraft: preview.outcomeDraft,
      canCreateAction: canCreateActionNow,
      canCreateOutcome: canCreateOutcomeNow,
      isPremiumPlan,
      planLimits,
    });

    if (!preparedCommit.ok) {
      if (preparedCommit.kind === "paywall") {
        openPaywall(preparedCommit.message);
        return;
      }
      handleUniversalCapturePreviewAdjust();
      return;
    }

    const commitResult = commitPreparedCreatePlan(safeData, preparedCommit.plan, {
      generationWindowDays,
      isPremiumPlan,
    });
    const sourceSurface = plusContext?.source || "objectives";
    const previewCategoryId = preview.categoryId || commitResult.createdCategoryId || plusContext?.categoryId || null;

    setData((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      const previousUi = safePrevious.ui && typeof safePrevious.ui === "object" ? safePrevious.ui : {};
      const committedUi =
        commitResult.state?.ui && typeof commitResult.state.ui === "object" ? commitResult.state.ui : previousUi;
      const baseUi =
        sourceSurface === "objectives" && previewCategoryId
          ? withLibraryActiveCategoryId(committedUi, previewCategoryId)
          : committedUi;

      return {
        ...commitResult.state,
        ui: {
          ...baseUi,
          libraryFocusTarget: commitResult.viewTarget,
          selectedGoalByCategory:
            commitResult.createdOutcomeId && previewCategoryId
              ? {
                  ...(baseUi.selectedGoalByCategory || {}),
                  [previewCategoryId]: commitResult.createdOutcomeId,
                }
              : baseUi.selectedGoalByCategory || {},
        },
      };
    });
    setUniversalCapturePreview(null);
    closePlusExpander();
    setTab(sourceSurface === "objectives" ? "objectives" : tab);
  }, [
    canCreateActionNow,
    canCreateOutcomeNow,
    closePlusExpander,
    generationWindowDays,
    handleUniversalCapturePreviewAdjust,
    isPremiumPlan,
    openPaywall,
    planLimits,
    plusContext,
    safeData,
    setData,
    setTab,
    tab,
    universalCapturePreview,
  ]);

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
      ["today", "timeline", "objectives", "insights"].forEach((key) => {
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
  const showTourOverlay = onboardingCompleted;

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
    if (!onboardingCompleted && window.location.pathname !== "/onboarding") {
      window.history.replaceState({}, "", "/onboarding");
    }
  }, [dataLoading, onboardingCompleted]);

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
        <Onboarding data={data} setData={setData} onDone={() => setTab("settings")} planOnly />
        <DiagnosticOverlay data={safeData} tab={tab} />
      </>
    );
  }
  if (!onboardingCompleted) {
    return renderWithBehaviorFeedback(
      <>
        <Onboarding data={data} setData={setData} onDone={() => setTab("today")} />
        <DiagnosticOverlay data={safeData} tab={tab} />
      </>
    );
  }

  return renderWithBehaviorFeedback(
    <>
      {tab === "onboarding" ? (
        <Onboarding data={data} setData={setData} onDone={() => setTab("today")} />
      ) : tab === "today" ? (
        <Home
          data={data}
          setData={setData}
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
      ) : tab === "timeline" ? (
        <Timeline
          data={data}
          setData={setData}
          setTab={setTab}
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
      ) : tab === "insights" ? (
        <Insights
          data={data}
          setData={setData}
          setTab={setTab}
          persistenceScope={persistenceScope}
        />
      ) : tab === "objectives" ? (
        <Objectives
          data={data}
          setData={setData}
          onOpenCreateMenu={({ source, anchorEl, anchorRect }) =>
            openCreateExpander({
              source,
              categoryId: libraryCategoryId || selectedCategoryId || homeActiveCategoryId || null,
              anchorEl,
              anchorRect,
            })
          }
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
          categoryId={sessionCategoryId}
          dateKey={resolvedSessionDateKey}
          occurrenceId={sessionOccurrenceId}
          setTab={setTab}
          onOpenLibrary={() => setTab("objectives")}
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
                    setTab("insights");
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
      <LovableCreateMenu
        open={plusOpen}
        anchorRect={plusAnchorRect}
        onClose={handleUniversalCaptureClose}
        onSubmitCapture={handleUniversalCaptureSubmit}
        preview={universalCapturePreview}
        onPreviewCreate={handleUniversalCapturePreviewCreate}
        onPreviewAdjust={handleUniversalCapturePreviewAdjust}
        onClearPreview={() => setUniversalCapturePreview(null)}
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
      {showBottomRail ? <LovableTabBar ref={bottomRailRef} activeTab={tab} onSelect={setTab} /> : null}
    </>
  );
}
