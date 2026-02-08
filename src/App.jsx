import React, { useEffect, useMemo, useRef, useState } from "react";
import TopNav from "./components/TopNav";
import CategoryRail from "./components/CategoryRail";
import {
  ensureSystemInboxCategory,
  migrate,
  normalizeCategory,
  usePersistedState,
} from "./logic/state";
import { autoActivateScheduledGoals } from "./logic/goals";
import { Button, Card } from "./components/UI";
import PlusExpander from "./components/PlusExpander";
import CategoryGateModal from "./components/CategoryGateModal";
import { markIOSRootClass } from "./utils/dialogs";

import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Categories from "./pages/Categories";
import CreateV2Outcome from "./pages/CreateV2Outcome";
import CreateV2HabitType from "./pages/CreateV2HabitType";
import CreateV2HabitOneOff from "./pages/CreateV2HabitOneOff";
import CreateV2HabitRecurring from "./pages/CreateV2HabitRecurring";
import CreateV2HabitAnytime from "./pages/CreateV2HabitAnytime";
import CreateV2LinkOutcome from "./pages/CreateV2LinkOutcome";
import CreateV2PickCategory from "./pages/CreateV2PickCategory";
import CreateV2OutcomeNextAction from "./pages/CreateV2OutcomeNextAction";
import CreateFlowModal from "./ui/create/CreateFlowModal";
import Settings from "./pages/Settings";
import CategoryView from "./pages/CategoryView";
import EditItem from "./pages/EditItem";
import CategoryDetailView from "./pages/CategoryDetailView";
import CategoryProgress from "./pages/CategoryProgress";
import SessionMVP from "./pages/SessionMVP";
import Pilotage from "./pages/Pilotage";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Support from "./pages/Support";
import { applyThemeTokens } from "./theme/themeTokens";
import { todayLocalKey } from "./utils/dateKey";
import { normalizePriorities } from "./logic/priority";
import { FIRST_USE_TOUR_STEPS, TOUR_VERSION } from "./tour/tourSpec";
import { useTour } from "./tour/useTour";
import TourOverlay from "./tour/TourOverlay";
import {
  STEP_LINK_OUTCOME,
  STEP_PICK_CATEGORY,
} from "./creation/creationSchema";
import DiagnosticOverlay from "./components/DiagnosticOverlay";
import { ensureWindowFromScheduleRules, validateOccurrences } from "./logic/occurrencePlanner";
import { resolveExecutableOccurrence } from "./logic/sessionResolver";
import { uid } from "./utils/helpers";
import PaywallModal from "./components/PaywallModal";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { useEntitlementsPaywall } from "./hooks/useEntitlementsPaywall";
import { useRemindersLoop } from "./hooks/useRemindersLoop";
import { useCreateFlowOrchestration } from "./hooks/useCreateFlowOrchestration";
import { useCategorySelectionSync } from "./hooks/useCategorySelectionSync";
import { getInboxId } from "./app/inbox";

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
  const [data, setData] = usePersistedState(React);
  const safeData = data && typeof data === "object" ? data : {};
  const {
    tab,
    setTab,
    categoryDetailId,
    setCategoryDetailId,
    categoryProgressId,
    setCategoryProgressId,
    libraryCategoryId,
    setLibraryCategoryId,
    sessionCategoryId,
    setSessionCategoryId,
  } = useAppNavigation({ safeData, setData });
  const [editItem, setEditItem] = useState(null);
  const dataRef = useRef(data);
  const invariantLogRef = useRef(new Set());
  const tour = useTour({ data, setData, steps: FIRST_USE_TOUR_STEPS, tourVersion: TOUR_VERSION });

  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const { activeReminder, setActiveReminder } = useRemindersLoop({ data, dataRef });

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

  useEffect(() => {
    setData((prev) => {
      const next = normalizePriorities(migrate(prev));
      runSelfTests(next);
      return next;
    });
    markIOSRootClass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => autoActivateScheduledGoals(prev, new Date()));
    }, 60000);
    return () => clearInterval(id);
  }, [setData]);

  const isCreateTab =
    tab === "create-goal" ||
    tab === "create-outcome-next" ||
    tab === "create-habit-type" ||
    tab === "create-habit-oneoff" ||
    tab === "create-habit-recurring" ||
    tab === "create-habit-anytime" ||
    tab === "create-link-outcome" ||
    tab === "create-pick-category";
  // Single source of truth for theme:
  // - ui.theme is authoritative
  // - legacy fallbacks are read ONCE and immediately promoted into ui.theme
  const deriveLegacyTheme = (uiObj) => {
    const ui = uiObj && typeof uiObj === "object" ? uiObj : {};
    const pageThemes = ui.pageThemes && typeof ui.pageThemes === "object" ? ui.pageThemes : null;
    if (!pageThemes) return "";
    // Some pages used to persist their own key; pick the first meaningful value.
    const candidates = [
      pageThemes.__default,
      pageThemes.settings,
      pageThemes.home,
      pageThemes.today,
      pageThemes.library,
      pageThemes.pilotage,
    ];
    for (const c of candidates) {
      const v = (c || "").toString().trim();
      if (v) return v;
    }
    return "";
  };

  const themeName = useMemo(() => {
    const ui = safeData?.ui && typeof safeData.ui === "object" ? safeData.ui : {};
    const direct = (ui.theme || "").toString().trim();
    if (direct) return direct;
    const legacy = deriveLegacyTheme(ui);
    return legacy || "bitcoin";
  }, [safeData?.ui]);

  const topNav = (
    <TopNav
      active={
        tab === "session"
          ? "today"
          : tab === "pilotage"
            ? "pilotage"
            : tab === "settings"
              ? "settings"
              : tab === "library" ||
                  tab === "edit-item" ||
                  tab === "category-detail" ||
                  tab === "category-progress" ||
                  (typeof tab === "string" && tab.startsWith("create-"))
                ? "library"
                : tab
      }
      setActive={(next) => {
        if (next === "library") {
          openLibraryDetail();
          return;
        }
        setTab(next);
      }}
      onOpenSettings={() => setTab("settings")}
    />
  );

  // Single header: keep TopNav only (prevents duplicate logo/title)
  const headerStack = topNav;
  // Spacer under the fixed header stack (TopNav + wordmark). Keep it tight to avoid a big empty gap.
  const headerSpacer = (
    <div aria-hidden="true" className="appHeaderSpacer" style={{ height: 48 }} />
  );
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const categoryIdsKey = useMemo(() => categories.map((c) => c.id).join("|"), [categories]);
  const categoryRailOrder = useMemo(
    () => ensureOrder(safeData?.ui?.categoryRailOrder, categories),
    [safeData?.ui?.categoryRailOrder, categories]
  );
  const isDevEnv = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  const orderedCategories = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    return categoryRailOrder.map((id) => map.get(id)).filter(Boolean);
  }, [categories, categoryRailOrder]);
  const railCategories = orderedCategories;
  const {
    librarySelectedCategoryId,
    homeActiveCategoryId,
    selectedCategoryId,
    openLibraryDetail,
    handleSelectCategory,
    railSelectedId,
    detailCategoryId,
  } = useCategorySelectionSync({
    tab,
    isCreateTab,
    safeData,
    categories,
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
  const {
    draft,
    hasDraft,
    plusOpen,
    plusAnchorRect,
    plusAnchorElRef,
    createFlowOpen,
    setCreateFlowOpen,
    createFlowCategoryId,
    categoryGateOpen,
    setCategoryGateOpen,
    resetCreateDraft,
    seedCreateDraft,
    openCategoryGate,
    createCategoryFromGate,
    toggleCategoryActive,
    handleCategoryGateConfirm,
    closePlusExpander,
    handleChooseObjective,
    handleChooseAction,
    handleResumeDraft,
    openCreateOutcomeDirect,
    openCreateHabitDirect,
  } = useCreateFlowOrchestration({
    tab,
    isCreateTab,
    setTab,
    safeData,
    categories,
    setData,
    dataRef,
    openPaywall,
  });
  const handleEditBack = () => {
    const returnTab = editItem?.returnTab || "library";
    if (returnTab === "library") {
      const nextId = editItem?.categoryId || libraryCategoryId || null;
      if (nextId) setLibraryCategoryId(nextId);
    }
    setEditItem(null);
    setTab(returnTab);
  };

  // Theme reconciliation:
  // - If ui.theme is missing but legacy pageThemes exist, promote them into ui.theme.
  // - If ui.theme exists, keep legacy __default in sync so older code (e.g. Settings) cannot override on refresh.
  useEffect(() => {
    const ui = safeData?.ui && typeof safeData.ui === "object" ? safeData.ui : {};
    const current = (ui.theme || "").toString().trim();
    const legacy = deriveLegacyTheme(ui);

    // Promote legacy -> ui.theme (only when ui.theme is empty)
    if (!current && legacy && typeof setData === "function") {
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const prevCur = (prevUi.theme || "").toString().trim();
        if (prevCur) return prev;
        return { ...prev, ui: { ...prevUi, theme: legacy } };
      });
      return;
    }

    // Keep legacy __default aligned with ui.theme to prevent refresh regressions
    if (current && typeof setData === "function") {
      const pageThemes = ui.pageThemes && typeof ui.pageThemes === "object" ? ui.pageThemes : {};
      const def = (pageThemes.__default || "").toString().trim();
      if (def === current) return;
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const prevTheme = (prevUi.theme || "").toString().trim();
        if (!prevTheme) return prev; // only sync when ui.theme exists
        const prevPageThemes =
          prevUi.pageThemes && typeof prevUi.pageThemes === "object" ? prevUi.pageThemes : {};
        const prevDef = (prevPageThemes.__default || "").toString().trim();
        if (prevDef === prevTheme) return prev;
        return {
          ...prev,
          ui: {
            ...prevUi,
            pageThemes: {
              ...prevPageThemes,
              __default: prevTheme,
            },
          },
        };
      });
    }
  }, [safeData?.ui, setData]);

  useEffect(() => {
    applyThemeTokens(themeName);
  }, [themeName]);
  useEffect(() => {
    if (!isSameOrder(categoryRailOrder, safeData?.ui?.categoryRailOrder || [])) {
      setData((prev) => ({
        ...prev,
        ui: { ...(prev.ui || {}), categoryRailOrder },
      }));
    }
  }, [categoryIdsKey, categoryRailOrder, safeData?.ui?.categoryRailOrder, setData]);

  useEffect(() => {
    if (!isDevEnv || typeof setData !== "function") return;
    try {
      const data = safeData && typeof safeData === "object" ? safeData : null;
      if (!data) return;
      const cats = Array.isArray(data.categories) ? data.categories : [];
      const ids = new Set(cats.map((c) => c && c.id).filter(Boolean));
      const ui = data.ui && typeof data.ui === "object" ? data.ui : {};
      const issues = [];
      const inboxId = getInboxId(dataRef.current || safeData || data);
      if (!ids.has(inboxId)) issues.push("systemInboxMissing");
      if (Array.isArray(ui.categoryRailOrder) && ui.categoryRailOrder.some((id) => !ids.has(id))) {
        issues.push("categoryRailOrder");
      }
      if (ui.selectedCategoryId && !ids.has(ui.selectedCategoryId)) issues.push("selectedCategoryId");
      if (ui.librarySelectedCategoryId && !ids.has(ui.librarySelectedCategoryId)) {
        issues.push("librarySelectedCategoryId");
      }
      if (ui.selectedCategoryByView && typeof ui.selectedCategoryByView === "object") {
        const scv = ui.selectedCategoryByView;
        ["home", "library", "plan", "pilotage"].forEach((key) => {
          if (scv[key] && !ids.has(scv[key])) issues.push(`selectedCategoryByView.${key}`);
        });
      }
      if (!issues.length) return;

      setData((prev) => {
        try {
          const base = prev && typeof prev === "object" ? prev : {};
          const ensured = ensureSystemInboxCategory(base);
          const next = ensured?.state && typeof ensured.state === "object" ? ensured.state : base;
          const inboxIdNext = getInboxId(next);
          const nextCats = Array.isArray(next.categories) ? next.categories : [];
          const nextIds = new Set(nextCats.map((c) => c && c.id).filter(Boolean));
          const nextUi = { ...(next.ui || {}) };
          const fixed = new Set();
          let didChange = next !== base;

          if (Array.isArray(nextUi.categoryRailOrder)) {
            const filtered = nextUi.categoryRailOrder.filter((id) => nextIds.has(id));
            if (filtered.length !== nextUi.categoryRailOrder.length) {
              nextUi.categoryRailOrder = filtered;
              fixed.add("categoryRailOrder");
              didChange = true;
            }
          }
          if (nextUi.selectedCategoryId && !nextIds.has(nextUi.selectedCategoryId)) {
            nextUi.selectedCategoryId = inboxIdNext;
            fixed.add("selectedCategoryId");
            didChange = true;
          }
          if (nextUi.librarySelectedCategoryId && !nextIds.has(nextUi.librarySelectedCategoryId)) {
            nextUi.librarySelectedCategoryId = inboxIdNext;
            fixed.add("librarySelectedCategoryId");
            didChange = true;
          }
          if (nextUi.selectedCategoryByView && typeof nextUi.selectedCategoryByView === "object") {
            const scv = { ...nextUi.selectedCategoryByView };
            let scvChanged = false;
            ["home", "library", "plan", "pilotage"].forEach((key) => {
              if (scv[key] && !nextIds.has(scv[key])) {
                scv[key] = inboxIdNext;
                scvChanged = true;
                fixed.add(`selectedCategoryByView.${key}`);
                didChange = true;
              }
            });
            if (scvChanged) nextUi.selectedCategoryByView = scv;
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
    openCreateOutcomeDirect({ source: "pilotage", categoryId });
  };

  const showBottomRail = tab === "today" || tab === "library" || tab === "pilotage";

  if (showPlanStep && onboardingCompleted) {
    return (
      <>
        {headerStack}
        {headerSpacer}
        <Onboarding data={data} setData={setData} onDone={() => setTab("settings")} planOnly />
        <DiagnosticOverlay data={safeData} tab={tab} />
        <PlusExpander
          open={plusOpen}
          anchorRect={plusAnchorRect}
          anchorEl={plusAnchorElRef.current}
          onClose={closePlusExpander}
          onChooseObjective={handleChooseObjective}
          onChooseAction={handleChooseAction}
          onResumeDraft={hasDraft ? handleResumeDraft : null}
          hasDraft={hasDraft}
        />
      </>
    );
  }
  if (!onboardingCompleted) {
    return (
      <>
        <Onboarding data={data} setData={setData} onDone={() => setTab("today")} />
        <DiagnosticOverlay data={safeData} tab={tab} />
      </>
    );
  }
  return (
    <>
      {headerStack}
      {headerSpacer}
      {showBottomRail ? (
        <div className="navWrap bottomBar" data-tour-id="topnav-rail">
          <div className="navRow">
            <CategoryRail
              categories={railCategories}
              selectedCategoryId={railSelectedId}
              onSelect={handleSelectCategory}
            />
            <button
              type="button"
              className="navBtn navGear"
              aria-label="Créer"
              title="Créer"
              data-create-anchor="bottomrail"
              data-testid="create-plus-button"
              onClick={(event) => {
                const el = event?.currentTarget || null;
                const rect = el?.getBoundingClientRect ? el.getBoundingClientRect() : null;
                openCategoryGate({ source: "bottomrail", anchorEl: el, anchorRect: rect, next: "flow" });
              }}
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      {tab === "today" ? (
        <Home
          data={data}
          setData={setData}
          onOpenLibrary={() => {
            openLibraryDetail();
          }}
          onOpenManageCategory={(categoryId) => {
            if (!categoryId) return;
            setLibraryCategoryId(categoryId);
            setData((prev) => ({
              ...prev,
              ui: {
                ...(prev.ui || {}),
                librarySelectedCategoryId: categoryId,
                selectedCategoryByView: { ...(prev.ui?.selectedCategoryByView || {}), library: categoryId },
              },
            }));
            setTab("library");
          }}
          onOpenCreateOutcome={() => {
            openCategoryGate({ source: "today", intent: "outcome", next: "flow" });
          }}
          onOpenCreateHabit={() => {
            openCategoryGate({ source: "today", intent: "habit", next: "flow" });
          }}
          onOpenSession={({ categoryId, dateKey }) =>
            setTab("session", { sessionCategoryId: categoryId || null, sessionDateKey: dateKey || null })
          }
          onOpenPaywall={openPaywall}
          isPremiumPlan={isPremiumPlan}
          planLimits={planLimits}
          generationWindowDays={generationWindowDays}
          isPlanningUnlimited={planningUnlimited}
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
              ui: {
                ...(prev.ui || {}),
                librarySelectedCategoryId: detailCategoryId,
                selectedCategoryByView: { ...(prev.ui?.selectedCategoryByView || {}), library: detailCategoryId },
              },
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
            data?.ui?.selectedCategoryByView?.library ||
            data?.ui?.selectedCategoryId ||
            data?.categories?.[0]?.id ||
            null
          }
          onBack={() => {
            const fallbackId =
              categoryProgressId ||
              data?.ui?.selectedCategoryByView?.library ||
              data?.ui?.selectedCategoryId ||
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
          onPlanCategory={handlePlanCategory}
          generationWindowDays={generationWindowDays}
          isPlanningUnlimited={planningUnlimited}
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
          onOpenCreateOutcome={() => {
            openCreateOutcomeDirect({ source: "library", categoryId: libraryCategoryId });
          }}
          onOpenCreateHabit={() => {
            openCreateHabitDirect({ source: "library", categoryId: libraryCategoryId });
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
                ui: {
                  ...(prev.ui || {}),
                  librarySelectedCategoryId: nextId,
                  selectedCategoryByView: { ...(prev.ui?.selectedCategoryByView || {}), library: nextId },
                },
              }));
            }
            setEditItem({ id, type, categoryId: nextId, returnTab: tab });
            setTab("edit-item");
          }}
        />
      ) : tab === "library" ? (
        <Categories
          data={data}
          setData={setData}
          onOpenPaywall={openPaywall}
          onOpenCreateOutcome={() => {
            openCreateOutcomeDirect({ source: "library" });
          }}
          onOpenManage={(categoryId) => {
            if (!categoryId) return;
            setLibraryCategoryId(categoryId);
            setTab("library");
          }}
        />
      ) : tab === "create-goal" ? (
        <CreateV2Outcome
          data={data}
          setData={setData}
          onBack={() => setTab("library")}
          onCancel={() => {
            resetCreateDraft();
            setTab("library");
          }}
          onNext={() => setTab("create-outcome-next")}
          onAfterSave={() => setTab("create-outcome-next")}
          canCreateOutcome={canCreateOutcomeNow}
          onOpenPaywall={openPaywall}
          isPremiumPlan={isPremiumPlan}
          planLimits={planLimits}
        />
      ) : tab === "create-outcome-next" ? (
        <CreateV2OutcomeNextAction
          data={data}
          setData={setData}
          onCreateAction={(outcomeId, categoryId) => {
            openCreateHabitDirect({ source: "post-outcome", categoryId, outcomeId });
          }}
          onDone={() => {
            resetCreateDraft();
            setTab("library");
          }}
        />
      ) : tab === "create-habit-type" ? (
        <CreateV2HabitType
          data={data}
          setData={setData}
          onBack={() => {
            // If we came from objective creation, go back there; otherwise go back to library.
            const hasOutcomeDraft = Boolean(draft?.createdOutcomeId || draft?.activeOutcomeId);
            setTab(hasOutcomeDraft ? "create-goal" : "library");
          }}
          onNext={(habitType) => {
            const ht = (habitType || "").toString().toUpperCase();
            if (ht === "ONE_OFF") setTab("create-habit-oneoff");
            else if (ht === "RECURRING") setTab("create-habit-recurring");
            else if (ht === "ANYTIME") setTab("create-habit-anytime");
            else setTab("create-habit-type");
          }}
        />
            ) : tab === "create-habit-oneoff" ? (
        <CreateV2HabitOneOff
          data={data}
          setData={setData}
          onBack={() => setTab("create-habit-type")}
          onNext={(step) => {
            if (step === STEP_LINK_OUTCOME) setTab("create-link-outcome");
            else if (step === STEP_PICK_CATEGORY) setTab("create-pick-category");
            else setTab("library");
          }}
          onOpenCategories={() => setTab("library")}
          onCancel={() => {
            resetCreateDraft();
            setTab("library");
          }}
          onDone={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
          canCreateAction={canCreateActionNow}
          onOpenPaywall={openPaywall}
          isPremiumPlan={isPremiumPlan}
          planLimits={planLimits}
          generationWindowDays={generationWindowDays}
        />
      ) : tab === "create-habit-recurring" ? (
        <CreateV2HabitRecurring
          data={data}
          setData={setData}
          onBack={() => setTab("create-habit-type")}
          onNext={(step) => {
            if (step === STEP_LINK_OUTCOME) setTab("create-link-outcome");
            else if (step === STEP_PICK_CATEGORY) setTab("create-pick-category");
            else setTab("library");
          }}
          onOpenCategories={() => setTab("library")}
          onCancel={() => {
            resetCreateDraft();
            setTab("library");
          }}
          onDone={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
          canCreateAction={canCreateActionNow}
          onOpenPaywall={openPaywall}
          isPremiumPlan={isPremiumPlan}
          planLimits={planLimits}
          generationWindowDays={generationWindowDays}
        />
      ) : tab === "create-habit-anytime" ? (
        <CreateV2HabitAnytime
          data={data}
          setData={setData}
          onBack={() => setTab("create-habit-type")}
          onNext={(step) => {
            if (step === STEP_LINK_OUTCOME) setTab("create-link-outcome");
            else if (step === STEP_PICK_CATEGORY) setTab("create-pick-category");
            else setTab("library");
          }}
          onOpenCategories={() => setTab("library")}
          onCancel={() => {
            resetCreateDraft();
            setTab("library");
          }}
          onDone={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
          canCreateAction={canCreateActionNow}
          onOpenPaywall={openPaywall}
          isPremiumPlan={isPremiumPlan}
          planLimits={planLimits}
          generationWindowDays={generationWindowDays}
        />
      ) : tab === "create-link-outcome" ? (
        <CreateV2LinkOutcome
          data={data}
          setData={setData}
          onNext={() => setTab("create-pick-category")}
          onCancel={() => setTab("create-pick-category")}
          onDone={() => setTab("library")}
          canCreateOutcome={canCreateOutcomeNow}
          onOpenPaywall={openPaywall}
        />
      ) : tab === "create-pick-category" ? (
        <CreateV2PickCategory
          data={data}
          setData={setData}
          onDone={() => {
            setTab("library");
          }}
          onCancel={() => {
            setTab("library");
          }}
          onOpenPaywall={openPaywall}
        />
      ) : tab === "session" ? (
        <SessionMVP
          data={data}
          setData={setData}
          categoryId={sessionCategoryId}
          onBack={() => {
            setLibraryCategoryId(null);
            setTab("today");
          }}
        />
      ) : tab === "privacy" ? (
        <Privacy data={data} onBack={() => setTab("settings")} />
      ) : tab === "terms" ? (
        <Terms data={data} onBack={() => setTab("settings")} />
      ) : tab === "support" ? (
        <Support data={data} onBack={() => setTab("settings")} />
      ) : (
        <Settings
          data={data}
          setData={setData}
          onOpenPrivacy={() => setTab("privacy")}
          onOpenTerms={() => setTab("terms")}
          onOpenSupport={() => setTab("support")}
          onOpenPaywall={openPaywall}
          onRestorePurchases={handleRestorePurchases}
        />
      )}

      {activeReminder ? (
        <div className="modalBackdrop reminderOverlay" onClick={() => setActiveReminder(null)}>
          <Card
            accentBorder
            className="reminderCard reminderPulse"
            style={{ maxWidth: 420, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p18">
              <div className="titleSm">{activeReminder.reminder?.label || "Rappel"}</div>
              <div className="small2" style={{ marginTop: 6 }}>
                {activeReminder.goal?.title || activeReminder.habit?.title || "Action"}
              </div>
              <div className="small2" style={{ marginTop: 4 }}>
                {(() => {
                  const target = activeReminder.goal || activeReminder.habit;
                  const catId = target?.categoryId || null;
                  const cat = (data?.categories || []).find((c) => c.id === catId);
                  return cat?.name ? `Catégorie : ${cat.name}` : "Catégorie : —";
                })()}
              </div>
              <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
                <Button variant="ghost" onClick={() => setActiveReminder(null)}>
                  Plus tard
                </Button>
                <Button
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
                        if (existing && existing.status === "partial") return ensured;

                        const resolvedNow = resolveExecutableOccurrence(ensured, {
                          dateKey: todayKey,
                          goalIds: [target.id],
                        });
                        if (resolvedNow.kind !== "ok" || !resolvedNow.occurrenceId) return ensured;
                        const occ =
                          (ensured.occurrences || []).find((o) => o && o.id === resolvedNow.occurrenceId) || null;
                        if (!occ) return ensured;

                        const nextSession = {
                          id: existing?.occurrenceId === occ.id && existing?.id ? existing.id : uid(),
                          occurrenceId: occ.id,
                          dateKey: todayLocalKey(),
                          objectiveId: typeof target.parentId === "string" ? target.parentId : null,
                          habitIds: [occ.goalId || target.id],
                          status: "partial",
                          timerStartedAt: "",
                          timerAccumulatedSec: 0,
                          timerRunning: false,
                          doneHabitIds: [],
                        };
                        if (
                          existing &&
                          existing.occurrenceId === nextSession.occurrenceId &&
                          existing.dateKey === nextSession.dateKey &&
                          existing.objectiveId === nextSession.objectiveId &&
                          Array.isArray(existing.habitIds) &&
                          existing.habitIds.length === nextSession.habitIds.length &&
                          existing.habitIds.every((id, idx) => id === nextSession.habitIds[idx]) &&
                          existing.status === nextSession.status
                        ) {
                          return ensured;
                        }
                        return {
                          ...ensured,
                          ui: { ...prevUi, activeSession: nextSession },
                        };
                      });
                    }
                    if (target?.categoryId) {
                      setData((prev) => ({
                        ...prev,
                        ui: { ...(prev.ui || {}), selectedCategoryId: target.categoryId },
                      }));
                      setTab("pilotage");
                    }
                    setActiveReminder(null);
                  }}
                >
                  Commencer
                </Button>
              </div>
            </div>
          </Card>
        </div>
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
      <CategoryGateModal
        open={categoryGateOpen}
        categories={categories}
        categoryRailOrder={safeData?.ui?.categoryRailOrder}
        activeCategoryId={homeActiveCategoryId}
        goals={data?.goals || []}
        habits={data?.habits || []}
        onClose={() => setCategoryGateOpen(false)}
        onConfirm={handleCategoryGateConfirm}
        onCreateCategory={createCategoryFromGate}
        onToggleActive={toggleCategoryActive}
      />
      <CreateFlowModal
        open={createFlowOpen}
        data={data}
        setData={setData}
        categories={categories}
        selectedCategoryId={createFlowCategoryId || selectedCategoryId}
        seedCreateDraft={seedCreateDraft}
        resetCreateDraft={resetCreateDraft}
        canCreateOutcome={canCreateOutcomeNow}
        canCreateAction={canCreateActionNow}
        isPremiumPlan={isPremiumPlan}
        planLimits={planLimits}
        generationWindowDays={generationWindowDays}
        onOpenPaywall={openPaywall}
        onChangeCategory={() => {
          setCreateFlowOpen(false);
          openCategoryGate({ source: "create-flow", next: "flow" });
        }}
        onClose={() => setCreateFlowOpen(false)}
      />
      <PlusExpander
        open={plusOpen}
        anchorRect={plusAnchorRect}
        anchorEl={plusAnchorElRef.current}
        onClose={closePlusExpander}
        onChooseObjective={handleChooseObjective}
        onChooseAction={handleChooseAction}
        onResumeDraft={hasDraft ? handleResumeDraft : null}
        hasDraft={hasDraft}
      />
      <PaywallModal
        open={paywallOpen}
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
        onSubscribeMonthly={handlePurchase}
        onSubscribeYearly={handlePurchase}
        onRestore={handleRestorePurchases}
        onOpenTerms={() => setTab("terms")}
        onOpenPrivacy={() => setTab("privacy")}
      />
    </>
  );
}
