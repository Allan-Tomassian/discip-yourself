import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import {
  applyCreateFlowDraftMeta,
  getDefaultCreationStepForMode,
  normalizeCreateFlowMode,
} from "../creation/createFlowController";
import { isValidCreationStep, STEP_HABIT_TYPE } from "../creation/creationSchema";
import {
  CATEGORY_VIEW,
  getExecutionActiveCategoryId,
  getFirstVisibleCategoryId,
  getSelectedCategoryForView,
  getStoredLibraryActiveCategoryId,
  resolvePreferredVisibleCategoryId,
  withExecutionActiveCategoryId,
  withLibraryActiveCategoryId,
} from "../domain/categoryVisibility";
import { canCreateCategory } from "../logic/entitlements";
import { ensureSystemInboxCategory, normalizeCategory } from "../logic/state";
import { findSuggestedCategory } from "../utils/categoriesSuggested";
import { uid } from "../utils/helpers";

function normalizeAnchorRect(rect) {
  if (!rect) return null;
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function resolveCategoryContextNamespace({ source, tab }) {
  const safeSource = typeof source === "string" ? source.trim() : "";
  if (safeSource === "library") return "library";
  if (safeSource === "today" || safeSource === "planning" || safeSource === "pilotage") return "execution";
  if (tab === "library" || tab === "category-detail" || tab === "category-progress" || tab === "edit-item") return "library";
  if (tab === "today" || tab === "planning" || tab === "pilotage") return "execution";
  return "none";
}

export function useCreateFlowOrchestration({
  tab,
  setTab,
  safeData,
  categories,
  setData,
  dataRef,
  openPaywall,
}) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [plusAnchorRect, setPlusAnchorRect] = useState(null);
  const [plusContext, setPlusContext] = useState({ source: null, categoryId: null });
  const plusAnchorElRef = useRef(null);
  const [createFlowOpen, setCreateFlowOpen] = useState(false);
  const [createFlowCategoryId, setCreateFlowCategoryId] = useState(null);
  const [createFlowConfig, setCreateFlowConfig] = useState({
    source: null,
    mode: "action",
    step: STEP_HABIT_TYPE,
    habitType: null,
  });
  const [categoryGateOpen, setCategoryGateOpen] = useState(false);
  const [categoryGateContext, setCategoryGateContext] = useState({
    source: null,
    intent: null,
    anchorRect: null,
    anchorEl: null,
    next: null,
  });

  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const hasDraft = Boolean(
    (draft.outcomes && draft.outcomes.length) ||
      (draft.habits && draft.habits.length) ||
      (draft.createdActionIds && draft.createdActionIds.length) ||
      draft.createdOutcomeId
  );

  const resetCreateDraft = () => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: createEmptyDraft(),
          createDraftWasCanceled: true,
          createDraftWasCompleted: false,
        },
      };
    });
  };

  const openCategoryGate = ({ source, intent, anchorRect, anchorEl, next } = {}) => {
    setPlusOpen(false);
    setCategoryGateContext({
      source: source || "unknown",
      intent: intent || null,
      anchorRect: normalizeAnchorRect(anchorRect),
      anchorEl: anchorEl || null,
      next: next || null,
    });
    setCategoryGateOpen(true);
  };

  const resolvePreferredCategoryId = useCallback(({ categoryId: explicitCategoryId, source } = {}) => {
    const contextNamespace = resolveCategoryContextNamespace({ source, tab });
    const executionCategoryId = getExecutionActiveCategoryId(safeData);
    const libraryCategoryId = getStoredLibraryActiveCategoryId(safeData);
    const candidates =
      contextNamespace === "library"
        ? [explicitCategoryId, libraryCategoryId, executionCategoryId]
        : contextNamespace === "execution"
          ? [explicitCategoryId, executionCategoryId, libraryCategoryId]
          : [
              explicitCategoryId,
              getSelectedCategoryForView(safeData, CATEGORY_VIEW.LIBRARY),
              getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY),
              safeData?.ui?.selectedCategoryId,
            ];
    return resolvePreferredVisibleCategoryId({
      categories,
      candidates,
    });
  }, [categories, safeData, tab]);

  const seedCreateDraft = useCallback(({ source, categoryId, outcomeId, step, mode, preserveDraft = false, habitType } = {}) => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      const shouldReset = prevUi.createDraftWasCompleted || prevUi.createDraftWasCanceled;
      const baseUi = shouldReset
        ? {
            ...prevUi,
            createDraft: createEmptyDraft(),
            createDraftWasCanceled: false,
            createDraftWasCompleted: false,
          }
        : prevUi;
      const baseState = shouldReset ? { ...prev, ui: baseUi } : prev;
      const stateWithInbox = ensureSystemInboxCategory(baseState).state;
      const baseUiWithInbox = stateWithInbox.ui || baseUi;
      const prevCategories = Array.isArray(categories) && categories.length
        ? categories
        : Array.isArray(stateWithInbox.categories)
          ? stateWithInbox.categories.filter((category) => category && !category.system && !category.isSystem)
          : [];
      let resolvedCategoryId = categoryId || null;
      const contextNamespace = resolveCategoryContextNamespace({ source, tab });
      if (!resolvedCategoryId) {
        if (contextNamespace === "library") {
          resolvedCategoryId =
            getStoredLibraryActiveCategoryId(baseUiWithInbox) ||
            getExecutionActiveCategoryId(baseUiWithInbox) ||
            null;
        } else if (contextNamespace === "execution") {
          resolvedCategoryId =
            getExecutionActiveCategoryId(baseUiWithInbox) ||
            null;
        } else {
          resolvedCategoryId =
            getExecutionActiveCategoryId(baseUiWithInbox) ||
            getStoredLibraryActiveCategoryId(baseUiWithInbox) ||
            null;
        }
      }
      if (resolvedCategoryId && !prevCategories.some((c) => c.id === resolvedCategoryId)) {
        resolvedCategoryId = null;
      }
      if (!resolvedCategoryId) {
        resolvedCategoryId = getFirstVisibleCategoryId(prevCategories) || null;
      }
      let resolvedOutcomeId = outcomeId || null;
      if (resolvedOutcomeId && !Array.isArray(stateWithInbox.goals)) resolvedOutcomeId = null;
      if (resolvedOutcomeId && !stateWithInbox.goals.some((g) => g && g.id === resolvedOutcomeId)) {
        resolvedOutcomeId = null;
      }
      const nextMode = normalizeCreateFlowMode(mode);
      const nextDraft = preserveDraft ? normalizeCreationDraft(baseUiWithInbox.createDraft) : createEmptyDraft();
      if (resolvedCategoryId) nextDraft.category = { mode: "existing", id: resolvedCategoryId };
      if (resolvedOutcomeId) nextDraft.activeOutcomeId = resolvedOutcomeId;
      if (habitType) nextDraft.habitType = String(habitType).trim().toUpperCase();
      if (isValidCreationStep(step)) nextDraft.step = step;
      else nextDraft.step = getDefaultCreationStepForMode(nextMode);
      const draftWithMeta = applyCreateFlowDraftMeta(nextDraft, { mode: nextMode, source });
      let nextUi = baseUiWithInbox;
      if (resolvedCategoryId && contextNamespace === "execution") {
        nextUi = withExecutionActiveCategoryId(nextUi, resolvedCategoryId);
      } else if (resolvedCategoryId && contextNamespace === "library") {
        nextUi = withLibraryActiveCategoryId(nextUi, resolvedCategoryId);
      }
      return {
        ...stateWithInbox,
        ui: {
          ...nextUi,
          createDraft: draftWithMeta,
          createDraftWasCanceled: shouldReset ? false : baseUiWithInbox.createDraftWasCanceled,
          createDraftWasCompleted: false,
        },
      };
    });
  }, [categories, setData, tab]);

  const openCreateFlowModal = useCallback(
    ({ categoryId, source, mode, step, outcomeId, preserveDraft = false, habitType } = {}) => {
      const nextMode = normalizeCreateFlowMode(mode);
      const resolvedCategoryId = resolvePreferredCategoryId({ categoryId, source });
      const nextStep = isValidCreationStep(step) ? step : getDefaultCreationStepForMode(nextMode);
      setPlusOpen(false);
      setCreateFlowCategoryId(resolvedCategoryId);
      setCreateFlowConfig({
        source: source || "unknown",
        mode: nextMode,
        step: nextStep,
        habitType: typeof habitType === "string" ? habitType.trim().toUpperCase() : null,
      });
      seedCreateDraft({
        source,
        categoryId: resolvedCategoryId,
        outcomeId,
        step: nextStep,
        mode: nextMode,
        preserveDraft,
        habitType,
      });
      setCreateFlowOpen(true);
    },
    [resolvePreferredCategoryId, seedCreateDraft]
  );

  const resolveTopNavAnchor = () => {
    if (typeof document === "undefined") return { anchorRect: null, anchorEl: null };
    const bottomEl = document.querySelector("[data-create-anchor='bottomrail']");
    if (bottomEl) {
      return { anchorRect: normalizeAnchorRect(bottomEl.getBoundingClientRect()), anchorEl: bottomEl };
    }
    const topEl = document.querySelector("[data-create-anchor='topnav']");
    if (!topEl) return { anchorRect: null, anchorEl: null };
    return { anchorRect: normalizeAnchorRect(topEl.getBoundingClientRect()), anchorEl: topEl };
  };

  const createCategoryFromGate = useCallback(
    ({ name, color }) => {
      if (!name || typeof setData !== "function") return null;
      let createdId = null;
      setData((prev) => {
        const ensured = ensureSystemInboxCategory(prev);
        const prevCategories = Array.isArray(ensured.state.categories) ? ensured.state.categories : [];
        const exists = prevCategories.some(
          (c) => String(c?.name || "").trim().toLowerCase() === String(name).trim().toLowerCase()
        );
        if (exists) return ensured.state;
        const created = normalizeCategory(
          { id: `cat_${uid()}`, name: String(name).trim(), color: color || "#7C3AED" },
          prevCategories.length
        );
        createdId = created.id;
        return { ...ensured.state, categories: [...prevCategories, created] };
      });
      return createdId;
    },
    [setData]
  );

  const toggleCategoryActive = useCallback(
    (cat, nextActive, opts = {}) => {
      const mode = opts?.mode || "migrate";
      const debugSink = opts?.__debugSink;
      const logDebug = typeof debugSink === "function" ? debugSink : null;
      const catId = cat?.id || null;
      if (!catId || typeof setData !== "function") return;
      if (logDebug) {
        logDebug(`IN ${cat?.name || ""}/${catId} nextActive=${nextActive} mode=${mode}`);
      }
      if (nextActive) {
        const current =
          dataRef.current && typeof dataRef.current === "object" ? dataRef.current : safeData;
        if (!canCreateCategory(current)) {
          openPaywall("Limite de catégories atteinte.");
          return;
        }
        const suggested = findSuggestedCategory(catId);
        const name = (typeof cat === "object" && cat?.name) || suggested?.name || "Catégorie";
        const color = (typeof cat === "object" && cat?.color) || suggested?.color || "#F97316";
        setData((prev) => {
          const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
          const exists = prevCategories.some((c) => c?.id === catId);
          const nameConflict =
            !exists &&
            prevCategories.some(
              (c) => String(c?.name || "").trim().toLowerCase() === String(name).trim().toLowerCase()
            );
          if (nameConflict) return prev;
          let nextCategories = prevCategories;
          if (!exists) {
            const created = normalizeCategory({ id: catId, name, color }, prevCategories.length);
            nextCategories = [...prevCategories, created];
          }
          const prevUi = prev.ui || {};
          const prevOrder = Array.isArray(prevUi.categoryRailOrder) ? prevUi.categoryRailOrder : [];
          const nextOrder = prevOrder.includes(catId) ? prevOrder : [...prevOrder, catId];
          if (logDebug) logDebug(`AFTER activated id=${catId} railOrder=${nextOrder.length}`);
          if (exists && nextOrder.length === prevOrder.length) return prev;
          return { ...prev, categories: nextCategories, ui: { ...prevUi, categoryRailOrder: nextOrder } };
        });
        return;
      }
      setData((prev) => {
        let next = prev;
        const ensured = ensureSystemInboxCategory(next);
        next = ensured.state;
        const sysId = ensured.category?.id || getInboxId(ensured.state || next || {});
        if (catId === sysId) return next;
        const prevGoals = Array.isArray(next.goals) ? next.goals : [];
        const prevHabits = Array.isArray(next.habits) ? next.habits : [];
        const prevCategories = Array.isArray(next.categories) ? next.categories : [];
        const exists = prevCategories.some((c) => c?.id === catId);
        const nextCategories = exists ? prevCategories.filter((c) => c.id !== catId) : prevCategories;
        const fallbackSelectedId = getFirstVisibleCategoryId(nextCategories);
        let nextUi = { ...(next.ui || {}) };
        if (Array.isArray(nextUi.categoryRailOrder)) {
          nextUi.categoryRailOrder = nextUi.categoryRailOrder.filter((id) => id !== catId);
        }
        if (getExecutionActiveCategoryId(nextUi) === catId) {
          nextUi = withExecutionActiveCategoryId(nextUi, fallbackSelectedId);
        }
        if (getStoredLibraryActiveCategoryId(nextUi) === catId) {
          nextUi = withLibraryActiveCategoryId(nextUi, fallbackSelectedId);
        }
        if (!exists) {
          if (logDebug) {
            const orderLen = Array.isArray(nextUi.categoryRailOrder) ? nextUi.categoryRailOrder.length : 0;
            logDebug(`MISSING category id=${catId}`);
            logDebug(`AFTER deactivated id=${catId} railOrder=${orderLen}`);
          }
          return { ...next, ui: nextUi };
        }
        let nextGoals = prevGoals;
        let nextHabits = prevHabits;
        let removedIds = new Set();

        if (mode === "delete") {
          const removedGoals = prevGoals.filter((g) => g && g.categoryId === catId);
          const keptGoals = prevGoals.filter((g) => !g || g.categoryId !== catId);
          const removedHabits = prevHabits.filter((h) => h && h.categoryId === catId);
          const keptHabits = prevHabits.filter((h) => !h || h.categoryId !== catId);
          removedIds = new Set([
            ...removedGoals.map((g) => g.id).filter(Boolean),
            ...removedHabits.map((h) => h.id).filter(Boolean),
          ]);
          nextGoals = keptGoals;
          nextHabits = keptHabits;
          if (Array.isArray(next.occurrences) && removedIds.size) {
            next = {
              ...next,
              occurrences: next.occurrences.filter((o) => !o || !removedIds.has(o.goalId)),
            };
          }
          if (Array.isArray(next.reminders) && removedIds.size) {
            next = {
              ...next,
              reminders: next.reminders.filter((r) => !r || !removedIds.has(r.goalId)),
            };
          }
        } else {
          nextGoals = prevGoals.map((g) => (g && g.categoryId === catId ? { ...g, categoryId: sysId } : g));
          nextHabits = prevHabits.map((h) => (h && h.categoryId === catId ? { ...h, categoryId: sysId } : h));
        }

        if (logDebug) {
          const orderLen = Array.isArray(nextUi.categoryRailOrder) ? nextUi.categoryRailOrder.length : 0;
          logDebug(`AFTER deactivated id=${catId} railOrder=${orderLen}`);
        }
        return {
          ...next,
          categories: nextCategories,
          goals: nextGoals,
          habits: nextHabits,
          ui: nextUi,
        };
      });
    },
    [setData, safeData, openPaywall, dataRef]
  );

  const handleCategoryGateConfirm = (categoryId) => {
    if (!categoryId || typeof setData !== "function") return;
    const existing = categories.find((c) => c?.id === categoryId) || null;
    const suggestion = !existing ? findSuggestedCategory(categoryId) : null;
    if (!existing && suggestion && !canCreateCategory(safeData)) {
      openPaywall("Limite de catégories atteinte.");
      return;
    }
    setCategoryGateOpen(false);
    setData((prev) => {
      let next = prev;
      const ensured = ensureSystemInboxCategory(next);
      next = ensured.state;
      const prevCategories = Array.isArray(next.categories) ? next.categories : [];
      let nextCategories = prevCategories;
      const prevUi = next.ui || {};
      const prevOrder = Array.isArray(prevUi.categoryRailOrder) ? prevUi.categoryRailOrder : [];
      let nextOrder = prevOrder;
      if (!prevCategories.some((c) => c?.id === categoryId) && suggestion) {
        const created = normalizeCategory(
          { id: suggestion.id, name: suggestion.name, color: suggestion.color || "#F97316" },
          prevCategories.length
        );
        nextCategories = [...prevCategories, created];
        if (!prevOrder.includes(created.id)) nextOrder = [...prevOrder, created.id];
      }
      const contextNamespace = resolveCategoryContextNamespace({ source: categoryGateContext?.source, tab });
      let nextUi = prevUi;
      if (contextNamespace === "execution") {
        nextUi = withExecutionActiveCategoryId(nextUi, categoryId);
      } else if (contextNamespace === "library") {
        nextUi = withLibraryActiveCategoryId(nextUi, categoryId);
      }
      return {
        ...next,
        categories: nextCategories,
        ui: {
          ...nextUi,
          categoryRailOrder: nextOrder,
        },
      };
    });
    const nextFlow = categoryGateContext?.next && typeof categoryGateContext.next === "object" ? categoryGateContext.next : {};
    openCreateFlowModal({
      source: nextFlow.source || categoryGateContext?.source,
      categoryId,
      mode: nextFlow.mode,
      step: nextFlow.step,
      outcomeId: nextFlow.outcomeId,
      preserveDraft: Boolean(nextFlow.preserveDraft),
      habitType: nextFlow.habitType,
    });
  };

  const openCreateExpander = ({ source, categoryId, anchorRect, anchorEl } = {}) => {
    const normalizedRect = normalizeAnchorRect(anchorRect);
    const hasExplicitAnchor = Boolean(normalizedRect || anchorEl);
    const fallback = hasExplicitAnchor ? { anchorRect: normalizedRect, anchorEl } : resolveTopNavAnchor();
    plusAnchorElRef.current = anchorEl || fallback.anchorEl || null;
    setPlusAnchorRect(normalizedRect || fallback.anchorRect || null);
    setPlusContext({ source: source || "unknown", categoryId: categoryId || null });
    setPlusOpen(true);
  };

  const closePlusExpander = () => setPlusOpen(false);

  const openCreateOutcomeDirect = ({ source, categoryId, skipCategoryGate } = {}) => {
    const preferredCategoryId = resolvePreferredCategoryId({ categoryId, source });
    if (skipCategoryGate === true || preferredCategoryId) {
      openCreateFlowModal({
        source,
        categoryId: preferredCategoryId,
        mode: "project",
        step: getDefaultCreationStepForMode("project"),
      });
      return;
    }
    openCategoryGate({
      source: source || "unknown",
      intent: "project",
      next: {
        mode: "project",
        step: getDefaultCreationStepForMode("project"),
      },
    });
  };

  const openCreateHabitDirect = ({ source, categoryId, outcomeId, skipCategoryGate } = {}) => {
    const preferredCategoryId = resolvePreferredCategoryId({ categoryId, source });
    if (skipCategoryGate === true || preferredCategoryId) {
      openCreateFlowModal({
        source,
        categoryId: preferredCategoryId,
        outcomeId,
        mode: "action",
        step: getDefaultCreationStepForMode("action"),
        preserveDraft: Boolean(outcomeId),
      });
      return;
    }
    openCategoryGate({
      source: source || "unknown",
      intent: "action",
      next: {
        mode: "action",
        step: getDefaultCreationStepForMode("action"),
        outcomeId: outcomeId || null,
        preserveDraft: Boolean(outcomeId),
      },
    });
  };

  const handleChooseObjective = () => {
    const { source, categoryId } = plusContext || {};
    openCreateOutcomeDirect({ source, categoryId });
  };

  const handleChooseAction = () => {
    const { source, categoryId } = plusContext || {};
    openCreateHabitDirect({ source, categoryId });
  };

  const handleResumeDraft = () => {
    openCreateFlowModal({
      source: draft?.sourceContext?.source || "resume-draft",
      categoryId:
        (draft?.category?.mode === "existing" ? draft.category.id : null) ||
        draft?.pendingCategoryId ||
        null,
      outcomeId: draft?.activeOutcomeId || draft?.createdOutcomeId || null,
      mode: draft?.mode,
      step: draft?.step,
      preserveDraft: true,
      habitType: draft?.habitType,
    });
  };

  return {
    draft,
    hasDraft,
    plusOpen,
    plusAnchorRect,
    plusAnchorElRef,
    createFlowOpen,
    setCreateFlowOpen,
    createFlowCategoryId,
    createFlowConfig,
    categoryGateOpen,
    setCategoryGateOpen,
    categoryGateContext,
    resetCreateDraft,
    seedCreateDraft,
    openCategoryGate,
    openCreateFlowModal,
    createCategoryFromGate,
    toggleCategoryActive,
    handleCategoryGateConfirm,
    openCreateExpander,
    closePlusExpander,
    handleChooseObjective,
    handleChooseAction,
    handleResumeDraft,
    openCreateOutcomeDirect,
    openCreateHabitDirect,
  };
}
