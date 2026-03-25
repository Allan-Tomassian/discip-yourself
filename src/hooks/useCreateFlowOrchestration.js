import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { isValidCreationStep, STEP_HABIT_TYPE } from "../creation/creationSchema";
import {
  CATEGORY_VIEW,
  getFirstVisibleCategoryId,
  getSelectedCategoryForView,
  resolvePreferredVisibleCategoryId,
  withSelectedCategoryByView,
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

export function useCreateFlowOrchestration({
  tab,
  isCreateTab,
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

  const resolvePreferredCategoryId = useCallback((explicitCategoryId) => {
    return resolvePreferredVisibleCategoryId({
      categories,
      candidates: [
        explicitCategoryId,
        getSelectedCategoryForView(safeData, CATEGORY_VIEW.LIBRARY),
        getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY),
        safeData?.ui?.selectedCategoryId,
      ],
    });
  }, [categories, safeData]);

  const openCreateFlowModal = ({ categoryId } = {}) => {
    setPlusOpen(false);
    setCreateFlowCategoryId(resolvePreferredCategoryId(categoryId));
    setCreateFlowOpen(true);
  };

  useEffect(() => {
    if (!isCreateTab || typeof setData !== "function") return;
    if (!categoryGateOpen) openCategoryGate({ source: "create-block", next: "flow" });
    if (tab !== "today") setTab("today");
  }, [isCreateTab, setData, categoryGateOpen, tab]);

  const seedCreateDraft = ({ source, categoryId, outcomeId, step } = {}) => {
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
      if (!resolvedCategoryId) {
        if (source === "library") {
          resolvedCategoryId =
            getSelectedCategoryForView(baseUiWithInbox, CATEGORY_VIEW.LIBRARY) ||
            baseUiWithInbox?.librarySelectedCategoryId ||
            getSelectedCategoryForView(baseUiWithInbox, CATEGORY_VIEW.TODAY) ||
            baseUiWithInbox?.selectedCategoryId ||
            null;
        } else if (source === "pilotage") {
          resolvedCategoryId =
            getSelectedCategoryForView(baseUiWithInbox, CATEGORY_VIEW.PILOTAGE) ||
            getSelectedCategoryForView(baseUiWithInbox, CATEGORY_VIEW.TODAY) ||
            baseUiWithInbox?.selectedCategoryId ||
            null;
        } else if (source === "today") {
          resolvedCategoryId =
            getSelectedCategoryForView(baseUiWithInbox, CATEGORY_VIEW.TODAY) ||
            baseUiWithInbox?.selectedCategoryId ||
            null;
        } else {
          resolvedCategoryId =
            getSelectedCategoryForView(baseUiWithInbox, CATEGORY_VIEW.TODAY) ||
            baseUiWithInbox?.selectedCategoryId ||
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
      const nextDraft = createEmptyDraft();
      if (resolvedCategoryId) nextDraft.category = { mode: "existing", id: resolvedCategoryId };
      if (resolvedOutcomeId) nextDraft.activeOutcomeId = resolvedOutcomeId;
      if (isValidCreationStep(step)) nextDraft.step = step;
      else nextDraft.step = STEP_HABIT_TYPE;
      return {
        ...stateWithInbox,
        ui: {
          ...withSelectedCategoryByView(baseUiWithInbox, {
            ...(resolvedCategoryId ? { today: resolvedCategoryId } : {}),
          }),
          createDraft: nextDraft,
          createDraftWasCanceled: shouldReset ? false : baseUiWithInbox.createDraftWasCanceled,
          createDraftWasCompleted: false,
        },
      };
    });
  };

  useEffect(() => {
    if (!isCreateTab) return;
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      let nextUi = prevUi;
      let nextDraft = prevUi.createDraft;
      let changed = false;
      if (!nextDraft || typeof nextDraft !== "object") {
        nextDraft = normalizeCreationDraft(nextDraft);
        nextUi = { ...nextUi, createDraft: nextDraft };
        changed = true;
      } else if (nextDraft !== prevUi.createDraft) {
        nextUi = { ...nextUi, createDraft: nextDraft };
        changed = true;
      }
      if (!changed) return prev;
      return { ...prev, ui: nextUi };
    });
  }, [isCreateTab, setData, tab]);

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
        nextUi = withSelectedCategoryByView(nextUi, {
          ...(getSelectedCategoryForView(nextUi, CATEGORY_VIEW.TODAY) === catId
            ? { today: fallbackSelectedId, selectedCategoryId: fallbackSelectedId }
            : {}),
          ...(getSelectedCategoryForView(nextUi, CATEGORY_VIEW.PLANNING) === catId
            ? { planning: fallbackSelectedId }
            : {}),
          ...(getSelectedCategoryForView(nextUi, CATEGORY_VIEW.LIBRARY) === catId
            ? { library: fallbackSelectedId, librarySelectedCategoryId: fallbackSelectedId }
            : {}),
          ...(getSelectedCategoryForView(nextUi, CATEGORY_VIEW.PILOTAGE) === catId
            ? { pilotage: fallbackSelectedId }
            : {}),
        });
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
      return {
        ...next,
        categories: nextCategories,
        ui: {
          ...withSelectedCategoryByView(prevUi, {
            today: categoryId,
            planning: categoryId,
            library: categoryId,
            pilotage: categoryId,
            selectedCategoryId: categoryId,
            librarySelectedCategoryId: categoryId,
          }),
          categoryRailOrder: nextOrder,
        },
      };
    });
    openCreateFlowModal({ categoryId });
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
    if (skipCategoryGate === true) {
      openCreateFlowModal({ categoryId: resolvePreferredCategoryId(categoryId) });
      return;
    }
    openCategoryGate({ source: source || "unknown", intent: "action", next: "flow" });
  };

  const openCreateHabitDirect = ({ source, categoryId, outcomeId, skipCategoryGate } = {}) => {
    void outcomeId;
    if (skipCategoryGate === true) {
      openCreateFlowModal({ categoryId: resolvePreferredCategoryId(categoryId) });
      return;
    }
    openCategoryGate({ source: source || "unknown", intent: "habit", next: "flow" });
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
    openCategoryGate({ source: "resume-draft", next: "flow" });
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
