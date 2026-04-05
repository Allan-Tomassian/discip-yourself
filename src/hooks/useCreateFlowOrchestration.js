import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  normalizeRouteOrigin,
  resolveMainTabForSurface,
  resolveRouteOriginLibraryMode,
} from "../app/routeOrigin";
import {
  createEmptyCreateItemDraft,
  hasCreateItemDraft,
  normalizeActionDraft,
  normalizeCreateItemDraft,
  normalizeCreationProposal,
  normalizeOutcomeDraft,
} from "../creation/createItemDraft";
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
import { ensureSystemInboxCategory } from "../logic/state";

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
  if (safeSource === "library" || safeSource === "objectives") return "library";
  if (
    safeSource === "today" ||
    safeSource === "planning" ||
    safeSource === "timeline" ||
    safeSource === "pilotage" ||
    safeSource === "insights"
  ) {
    return "execution";
  }
  if (
    tab === "library" ||
    tab === "objectives" ||
    tab === "category-detail" ||
    tab === "category-progress" ||
    tab === "edit-item"
  ) {
    return "library";
  }
  if (tab === "today" || tab === "planning" || tab === "timeline" || tab === "pilotage" || tab === "insights") {
    return "execution";
  }
  return "none";
}

export function dispatchOpenCreateTask({
  request = {},
  tab,
  librarySelectedCategoryId = null,
  resolvePreferredCategoryId,
  seedCreateDraft,
  onCreateTaskOpen,
  setTab,
  setPlusOpen,
}) {
  const {
    categoryId,
    source,
    kind = "action",
    outcomeId,
    preserveDraft = false,
    origin,
    proposal,
  } = request;
  const resolvedCategoryId = resolvePreferredCategoryId({ categoryId, source });
  const sourceSurface = source || tab;
  const nextMainTab = resolveMainTabForSurface(sourceSurface, tab);
  const nextOrigin = normalizeRouteOrigin(
    origin || {
      mainTab: nextMainTab,
      sourceSurface,
      categoryId: resolvedCategoryId,
      libraryMode: resolveRouteOriginLibraryMode({
        mainTab: nextMainTab,
        sourceSurface,
        categoryId: sourceSurface === "library" ? resolvedCategoryId : librarySelectedCategoryId,
      }),
    }
  );
  const normalizedProposal = proposal ? normalizeCreationProposal(proposal, nextOrigin) : null;

  setPlusOpen?.(false);
  seedCreateDraft?.({
    source,
    categoryId: resolvedCategoryId,
    outcomeId,
    kind,
    preserveDraft,
    origin: nextOrigin,
    proposal: normalizedProposal,
  });
  onCreateTaskOpen?.({
    origin: nextOrigin,
    kind,
    proposal: normalizedProposal,
  });
  setTab?.("create-item", {
    historyState: {
      task: "create-item",
      origin: nextOrigin,
      createKind: kind,
    },
  });

  return {
    resolvedCategoryId,
    nextOrigin,
    normalizedProposal,
  };
}

export function useCreateFlowOrchestration({
  tab,
  setTab,
  safeData,
  categories,
  setData,
  onCreateTaskOpen,
}) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [plusAnchorRect, setPlusAnchorRect] = useState(null);
  const [plusContext, setPlusContext] = useState({ source: null, categoryId: null });
  const plusAnchorElRef = useRef(null);

  const draft = useMemo(() => normalizeCreateItemDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const hasDraft = useMemo(() => hasCreateItemDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);

  const resetCreateDraft = () => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: createEmptyCreateItemDraft(),
          createDraftWasCanceled: true,
          createDraftWasCompleted: false,
        },
      };
    });
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

  const seedCreateDraft = useCallback(({ source, categoryId, outcomeId, kind, preserveDraft = false, origin, proposal } = {}) => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      const shouldReset = prevUi.createDraftWasCompleted || prevUi.createDraftWasCanceled;
      const baseUi = shouldReset
        ? {
            ...prevUi,
            createDraft: createEmptyCreateItemDraft(),
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
      const currentDraft = preserveDraft ? normalizeCreateItemDraft(baseUiWithInbox.createDraft) : createEmptyCreateItemDraft();
      const sourceSurface = source || tab;
      const nextMainTab = resolveMainTabForSurface(sourceSurface, tab);
      const nextOrigin = normalizeRouteOrigin(
        origin || {
          mainTab: nextMainTab,
          sourceSurface,
          categoryId: resolvedCategoryId,
          libraryMode: resolveRouteOriginLibraryMode({
            mainTab: nextMainTab,
            sourceSurface,
            categoryId: sourceSurface === "library" ? resolvedCategoryId : safeData?.ui?.librarySelectedCategoryId || null,
          }),
        }
      );
      const nextKind = kind || currentDraft.kind || "action";
      const normalizedProposal = proposal ? normalizeCreationProposal(proposal, nextOrigin) : null;
      const nextDraft = {
        ...currentDraft,
        kind: nextKind,
        origin: nextOrigin,
        intent: {
          kind: nextKind,
          sourceSurface: source || nextOrigin.sourceSurface,
          sourceCategoryId: resolvedCategoryId,
          sourceOutcomeId: resolvedOutcomeId,
          origin: nextOrigin,
        },
        proposal: normalizedProposal,
        actionDraft: normalizedProposal?.actionDrafts?.[0]
          ? normalizeActionDraft(
              {
                ...normalizedProposal.actionDrafts[0],
                categoryId: normalizedProposal.actionDrafts[0]?.categoryId || resolvedCategoryId,
                outcomeId: normalizedProposal.actionDrafts[0]?.outcomeId || resolvedOutcomeId,
              },
              resolvedCategoryId
            )
          : normalizeActionDraft(
              {
                ...currentDraft.actionDraft,
                categoryId: currentDraft.actionDraft?.categoryId || resolvedCategoryId,
                outcomeId: currentDraft.actionDraft?.outcomeId || resolvedOutcomeId,
              },
              resolvedCategoryId
            ),
        outcomeDraft: normalizedProposal?.outcomeDraft
          ? normalizeOutcomeDraft(
              {
                ...normalizedProposal.outcomeDraft,
                categoryId: normalizedProposal.outcomeDraft?.categoryId || resolvedCategoryId,
              },
              resolvedCategoryId
            )
          : normalizeOutcomeDraft(
              {
                ...currentDraft.outcomeDraft,
                categoryId: currentDraft.outcomeDraft?.categoryId || resolvedCategoryId,
              },
              resolvedCategoryId
            ),
        status: "draft",
      };
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
          createDraft: nextDraft,
          createDraftWasCanceled: shouldReset ? false : baseUiWithInbox.createDraftWasCanceled,
          createDraftWasCompleted: false,
        },
      };
    });
  }, [categories, safeData?.ui?.librarySelectedCategoryId, setData, tab]);

  const openCreateTask = useCallback(
    (request = {}) =>
      dispatchOpenCreateTask({
        request,
        tab,
        librarySelectedCategoryId: safeData?.ui?.librarySelectedCategoryId || null,
        resolvePreferredCategoryId,
        seedCreateDraft,
        onCreateTaskOpen,
        setTab,
        setPlusOpen,
      }),
    [onCreateTaskOpen, resolvePreferredCategoryId, safeData?.ui?.librarySelectedCategoryId, seedCreateDraft, setTab, tab]
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

  const openCreateOutcome = ({ source, categoryId } = {}) => {
    const preferredCategoryId = resolvePreferredCategoryId({ categoryId, source });
    openCreateTask({
      source,
      categoryId: preferredCategoryId,
      kind: "outcome",
    });
  };

  const openCreateAction = ({ source, categoryId, outcomeId } = {}) => {
    const preferredCategoryId = resolvePreferredCategoryId({ categoryId, source });
    openCreateTask({
      source,
      categoryId: preferredCategoryId,
      outcomeId,
      kind: "action",
      preserveDraft: Boolean(outcomeId),
    });
  };

  const openCreateGuided = ({ source, categoryId } = {}) => {
    const preferredCategoryId = resolvePreferredCategoryId({ categoryId, source });
    openCreateTask({
      source,
      categoryId: preferredCategoryId,
      kind: "guided",
    });
  };

  const openCreateAssistant = ({ source, categoryId, proposal, origin } = {}) => {
    const normalizedProposal = normalizeCreationProposal(
      proposal,
      origin || {
        mainTab: resolveMainTabForSurface(source || tab, tab),
        sourceSurface: source || tab,
        categoryId,
      }
    );
    openCreateTask({
      source,
      categoryId:
        categoryId ||
        normalizedProposal?.categoryDraft?.id ||
        normalizedProposal?.actionDrafts?.[0]?.categoryId ||
        null,
      kind: "assistant",
      proposal: normalizedProposal,
      origin,
    });
  };

  const handleChooseObjective = () => {
    const { source, categoryId } = plusContext || {};
    openCreateOutcome({ source, categoryId });
  };

  const handleChooseAction = () => {
    const { source, categoryId } = plusContext || {};
    openCreateAction({ source, categoryId });
  };

  const resumeCreateDraft = () => {
    openCreateTask({
      source: draft?.intent?.sourceSurface || draft?.origin?.sourceSurface || "resume-draft",
      categoryId: draft?.actionDraft?.categoryId || draft?.outcomeDraft?.categoryId || draft?.proposal?.categoryDraft?.id || null,
      outcomeId: draft?.actionDraft?.outcomeId || null,
      kind: draft?.kind,
      preserveDraft: true,
      origin: draft?.origin,
      proposal: draft?.proposal,
    });
  };

  return {
    draft,
    hasDraft,
    plusOpen,
    plusAnchorRect,
    plusAnchorElRef,
    resetCreateDraft,
    seedCreateDraft,
    openCreateTask,
    openCreateExpander,
    closePlusExpander,
    handleChooseObjective,
    handleChooseAction,
    resumeCreateDraft,
    openCreateOutcome,
    openCreateAction,
    openCreateGuided,
    openCreateAssistant,
  };
}
