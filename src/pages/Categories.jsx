// src/pages/Categories.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeLibraryFocusTarget } from "../app/coachCreatedViewTarget";
import SortableBlocks from "../components/SortableBlocks";
import AccentCategoryRow from "../components/AccentCategoryRow";
import { getCategoryCounts } from "../logic/pilotage";
import { ensureSystemInboxCategory, normalizeCategory, SYSTEM_INBOX_ID } from "../logic/state";
import { updateGoal } from "../logic/goals";
import { removeScheduleRulesForAction } from "../logic/occurrencePlanner";
import { safeUpdateGoal } from "../logic/goalGuards";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import { canCreateCategory } from "../logic/entitlements";
import { LABELS, MAIN_PAGE_COPY, SURFACE_LABELS } from "../ui/labels";
import { getCategoryUiVars } from "../utils/categoryAccent";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { resolveGoalType } from "../domain/goalType";
import { isProcessLinkedToOutcome, linkProcessToOutcome } from "../logic/linking";
import { buildPlanningSections } from "../utils/librarySections";
import { safeConfirm } from "../utils/dialogs";
import { useDraftStore } from "../shared/draft/useDraft";
import { flushDraftScopes, onBeforeLeaveScope } from "../shared/draft/draftGuards";
import {
  getExecutionActiveCategoryId,
  getStoredLibraryActiveCategoryId,
  getVisibleCategories,
  withExecutionActiveCategoryId,
  withLibraryActiveCategoryId,
} from "../domain/categoryVisibility";
import { collectSystemInboxBuckets } from "../domain/systemInboxMigration";
import { useBehaviorFeedback } from "../feedback/behaviorFeedbackStore";
import { deriveBehaviorFeedbackSignal } from "../feedback/feedbackDerivers";
import {
  AppChip,
  AppIconButton,
  AppInput,
  AppScreen,
  AppTextarea,
  GhostButton,
  SectionHeader,
  StatusBadge,
} from "../shared/ui/app";
import "../features/library/library.css";

// TOUR MAP:
// - primary_action: open category detail
// - key_elements: create button, category list, category cards
// - optional_elements: priority badge
function formatCount(count, singular, plural) {
  if (count === 0) return `0 ${plural}`;
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

function parseScopeKey(scopeKey) {
  const raw = String(scopeKey || "");
  const idx = raw.indexOf(":");
  if (idx <= 0) return { kind: "", id: "" };
  return { kind: raw.slice(0, idx), id: raw.slice(idx + 1) };
}

function escapeSelectorValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export default function Categories({
  data,
  setData,
  onOpenPaywall,
  onEditItem,
}) {
  const { emitBehaviorFeedback } = useBehaviorFeedback();
  const safeData = data && typeof data === "object" ? data : {};
  const draftStore = useDraftStore();
  const [editedCategoryId, setEditedCategoryId] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const activeCategories = useMemo(
    () => getVisibleCategories(categories),
    [categories]
  );
  const isEmpty = activeCategories.length === 0;
  const legacyBuckets = useMemo(
    () => collectSystemInboxBuckets({ goals: safeData.goals, categories: safeData.categories }),
    [safeData.categories, safeData.goals]
  );
  const suggestedIds = useMemo(() => {
    const ids = new Set();
    for (const cat of SUGGESTED_CATEGORIES) {
      if (cat?.id) ids.add(cat.id);
    }
    return ids;
  }, []);
  const remainingSuggestions = useMemo(
    () => SUGGESTED_CATEGORIES.filter((s) => s && !categories.some((c) => c?.id === s.id)),
    [categories]
  );
  const activeCategoryIds = useMemo(
    () => new Set(activeCategories.map((c) => c?.id).filter(Boolean)),
    [activeCategories]
  );
  const defaultSuggestionsCollapsed = activeCategories.length > 0;
  const suggestionsCollapsed =
    typeof safeData?.ui?.librarySuggestionsCollapsed === "boolean"
      ? safeData.ui.librarySuggestionsCollapsed
      : defaultSuggestionsCollapsed;
  const suggestionsOpen = !suggestionsCollapsed;
  const getCategoryScopeKey = (categoryId) => `category:${categoryId}`;
  const getGoalScopeKey = (goalId) => `goal:${goalId}`;

  useEffect(() => {
    if (typeof setData !== "function") return;
    if (categories.some((c) => c?.id === SYSTEM_INBOX_ID || c?.system)) return;
    setData((prev) => ensureSystemInboxCategory(prev).state);
  }, [categories, setData]);

  useEffect(() => {
    if (!editedCategoryId) return;
    if (categories.some((c) => c?.id === editedCategoryId)) return;
    draftStore.clearDraft(getCategoryScopeKey(editedCategoryId));
    setEditedCategoryId(null);
  }, [categories, draftStore, editedCategoryId]);

  useEffect(() => {
    if (!editingGoalId) return;
    if (goals.some((g) => g?.id === editingGoalId)) return;
    draftStore.clearDraft(getGoalScopeKey(editingGoalId));
    setEditingGoalId(null);
  }, [draftStore, goals, editingGoalId]);

  useEffect(() => {
    if (editedCategoryId) return;
    if (editingGoalId) draftStore.clearDraft(getGoalScopeKey(editingGoalId));
    setEditingGoalId(null);
  }, [draftStore, editedCategoryId, editingGoalId]);

  useEffect(() => {
    return () => {
      const scopeKeys = draftStore.listDrafts().map((draft) => draft.scopeKey);
      flushDraftScopes({
        store: draftStore,
        scopeKeys,
        resolveRisk: () => "medium",
        resolveValidate: (scopeKey) => {
          const { kind } = parseScopeKey(scopeKey);
          if (kind === "category") {
            return (working) => String(working?.name || "").trim().length > 0;
          }
          if (kind === "goal") {
            return (working) => String(working?.title || "").trim().length > 0;
          }
          return null;
        },
        resolveKnownPaths: (scopeKey) => {
          const { kind } = parseScopeKey(scopeKey);
          if (kind === "category") return ["name", "whyText"];
          if (kind === "goal") return ["title"];
          return null;
        },
        resolveOnCommit: (scopeKey) => {
          const { kind, id } = parseScopeKey(scopeKey);
          if (kind === "category") {
            return (commit) => {
              const patch = commit?.diff?.patch || {};
              if (!Object.keys(patch).length || typeof setData !== "function") return;
              setData((prev) => ({
                ...prev,
                categories: (prev.categories || []).map((cat) =>
                  cat?.id === id ? { ...cat, ...patch } : cat
                ),
              }));
            };
          }
          if (kind === "goal") {
            return (commit) => {
              const nextTitle = String(commit?.diff?.patch?.title || "").trim();
              if (!nextTitle || typeof setData !== "function") return;
              setData((prev) => updateGoal(prev, id, { title: nextTitle }));
            };
          }
          return null;
        },
      });
      draftStore.clearAllDrafts();
    };
  }, [draftStore, setData]);

  function startCategoryEditing(category) {
    if (!category?.id) return;
    draftStore.beginDraft(
      getCategoryScopeKey(category.id),
      { name: category.name || "", whyText: category.whyText || "" },
      { risk: "medium", reset: true, meta: { categoryId: category.id } }
    );
    setEditedCategoryId(category.id);
  }

  function stopCategoryEditing(categoryId = editedCategoryId) {
    if (categoryId) draftStore.clearDraft(getCategoryScopeKey(categoryId));
    if (editingGoalId) draftStore.clearDraft(getGoalScopeKey(editingGoalId));
    setEditedCategoryId(null);
    setEditingGoalId(null);
  }

  function saveCategoryEditing(categoryId = editedCategoryId, options = {}) {
    if (!categoryId || typeof setData !== "function") return null;
    const scopeKey = getCategoryScopeKey(categoryId);
    return onBeforeLeaveScope({
      store: draftStore,
      scopeKey,
      risk: "medium",
      validate: (working) => String(working?.name || "").trim().length > 0,
      knownPaths: ["name", "whyText"],
      onCommit: (commit) => {
        const patch = commit?.diff?.patch || {};
        if (!Object.keys(patch).length) return;
        setData((prev) => ({
          ...prev,
          categories: (prev.categories || []).map((cat) =>
            cat?.id === categoryId ? { ...cat, ...patch } : cat
          ),
        }));
        emitBehaviorFeedback(
          deriveBehaviorFeedbackSignal({
            intent: "clarify_category",
            payload: {
              surface: "library",
              categoryId,
            },
          })
        );
      },
      clearAfterCommit: options.clear === true,
      clearAfterCancel: options.clear === true,
    });
  }

  function beginGoalTitleEditing(goal) {
    if (!goal?.id) return;
    draftStore.beginDraft(
      getGoalScopeKey(goal.id),
      { title: goal.title || "" },
      { risk: "medium", reset: true, meta: { goalId: goal.id } }
    );
    setEditingGoalId(goal.id);
  }

  function cancelGoalTitleEditing(goalId) {
    if (!goalId) return;
    draftStore.cancelDraft(getGoalScopeKey(goalId), { clear: true });
    if (editingGoalId === goalId) setEditingGoalId(null);
  }

  function saveGoalTitleEditing(goalId = editingGoalId, options = {}) {
    if (!goalId || typeof setData !== "function") return null;
    const scopeKey = getGoalScopeKey(goalId);
    const result = onBeforeLeaveScope({
      store: draftStore,
      scopeKey,
      risk: "medium",
      validate: (working) => String(working?.title || "").trim().length > 0,
      knownPaths: ["title"],
      onCommit: (commit) => {
        const nextTitle = String(commit?.diff?.patch?.title || "").trim();
        if (!nextTitle) return;
        setData((prev) => updateGoal(prev, goalId, { title: nextTitle }));
      },
      clearAfterCommit: options.clear !== false,
      clearAfterCancel: options.clear !== false,
    });
    if (editingGoalId === goalId && options.keepEditing !== true) {
      setEditingGoalId(null);
    }
    return result;
  }

  function deleteOutcome(goal) {
    if (!goal?.id || typeof setData !== "function") return;
    const ok = safeConfirm(`Supprimer ce ${LABELS.goalLower} ?`);
    if (!ok) return;
    setData((prev) => {
      const nextGoals = (prev.goals || [])
        .filter((g) => g && g.id !== goal.id)
        .map((g) =>
          g && g.parentId === goal.id ? { ...g, parentId: null, outcomeId: null } : g
        );
      const nextCategories = (prev.categories || []).map((cat) =>
        cat.mainGoalId === goal.id ? { ...cat, mainGoalId: null } : cat
      );
      return { ...prev, goals: nextGoals, categories: nextCategories };
    });
  }

  function deleteAction(goal) {
    if (!goal?.id || typeof setData !== "function") return;
    const ok = safeConfirm("Supprimer cette action ?");
    if (!ok) return;
    const goalId = goal.id;
    setData((prev) => {
      const nextGoals = (prev.goals || []).filter((g) => g && g.id !== goalId);
      const nextOccurrences = (prev.occurrences || []).filter((o) => o && o.goalId !== goalId);
      const nextReminders = (prev.reminders || []).filter((r) => r && r.goalId !== goalId);
      const nextSessions = Array.isArray(prev.sessions)
        ? prev.sessions
            .map((s) => {
              if (!s || typeof s !== "object") return s;
              const habitIds = Array.isArray(s.habitIds) ? s.habitIds.filter((id) => id !== goalId) : [];
              const doneHabitIds = Array.isArray(s.doneHabitIds) ? s.doneHabitIds.filter((id) => id !== goalId) : [];
              return { ...s, habitIds, doneHabitIds };
            })
            .filter((s) => {
              if (!s || typeof s !== "object") return false;
              const hasHabits = Array.isArray(s.habitIds) && s.habitIds.length > 0;
              const hasDone = Array.isArray(s.doneHabitIds) && s.doneHabitIds.length > 0;
              return hasHabits || hasDone;
            })
        : prev.sessions;
      let nextChecks = prev.checks;
      if (nextChecks && typeof nextChecks === "object") {
        const cleaned = {};
        for (const [key, bucket] of Object.entries(nextChecks)) {
          const habits = Array.isArray(bucket?.habits) ? bucket.habits.filter((id) => id !== goalId) : [];
          const micro = bucket?.micro && typeof bucket.micro === "object" ? bucket.micro : {};
          if (habits.length || Object.keys(micro).length) cleaned[key] = { ...bucket, habits, micro };
        }
        nextChecks = cleaned;
      }
      const nextUi = { ...(prev.ui || {}) };
      if (nextUi.activeSession?.habitIds) {
        const kept = nextUi.activeSession.habitIds.filter((id) => id !== goalId);
        nextUi.activeSession = kept.length ? { ...nextUi.activeSession, habitIds: kept } : null;
      }
      if (nextUi.sessionDraft?.objectiveId === goalId) nextUi.sessionDraft = null;
      const nextState = {
        ...prev,
        goals: nextGoals,
        occurrences: nextOccurrences,
        reminders: nextReminders,
        sessions: nextSessions,
        checks: nextChecks,
        ui: nextUi,
      };
      return removeScheduleRulesForAction(nextState, goalId);
    });
  }

  function openEditItemRoute(goal) {
    if (!goal?.id) return;
    if (editingGoalId) {
      saveGoalTitleEditing(editingGoalId);
    }
    if (typeof onEditItem === "function") {
      onEditItem({
        id: goal.id,
        type: resolveGoalType(goal),
        categoryId: goal.categoryId || null,
      });
    }
  }

  function handleReclassifyLegacyGoal(goal, categoryId) {
    if (!goal?.id || !categoryId || typeof setData !== "function") return;
    setData((prev) => {
      const result = safeUpdateGoal(prev, goal.id, { categoryId }, { onOpenPaywall });
      return result.state;
    });
  }

  function activateSuggestedCategory(cat) {
    if (!cat || typeof setData !== "function") return;
    if (!canCreateCategory(safeData)) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite de catégories atteinte.");
      return;
    }
    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      if (prevCategories.some((c) => c?.id === cat.id)) return prev;
      if (prevCategories.some((c) => String(c?.name || "").trim().toLowerCase() === String(cat.name || "").trim().toLowerCase())) {
        return prev;
      }
      const created = normalizeCategory({ id: cat.id, name: cat.name, color: cat.color }, prevCategories.length);
      return { ...prev, categories: [...prevCategories, created] };
    });
  }

  function deactivateSuggestedCategory(cat) {
    if (!cat || typeof setData !== "function") return;
    setData((prev) => {
      let next = prev;
      const ensured = ensureSystemInboxCategory(next);
      next = ensured.state;
      const sysId = ensured.category?.id || SYSTEM_INBOX_ID;
      const nextCategories = (next.categories || []).filter((c) => c.id !== cat.id);
      const nextGoals = (next.goals || []).map((g) =>
        g && g.categoryId === cat.id ? { ...g, categoryId: sysId } : g
      );
      const nextHabits = (next.habits || []).map((h) =>
        h && h.categoryId === cat.id ? { ...h, categoryId: sysId } : h
      );
      const fallbackSelectedId = getVisibleCategories(nextCategories)[0]?.id || null;
      const prevUi = next.ui || {};
      let nextUi = prevUi;
      if (getExecutionActiveCategoryId(prevUi) === cat.id) {
        nextUi = withExecutionActiveCategoryId(nextUi, fallbackSelectedId);
      }
      if (getStoredLibraryActiveCategoryId(prevUi) === cat.id) {
        nextUi = withLibraryActiveCategoryId(nextUi, fallbackSelectedId);
      }
      return {
        ...next,
        categories: nextCategories,
        goals: nextGoals,
        habits: nextHabits,
        ui: nextUi,
      };
    });
  }

  function toggleSuggestionsOpen() {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      const prevCategories = getVisibleCategories(prev.categories);
      const hasActive = prevCategories.length > 0;
      const fallbackCollapsed = hasActive;
      const currentCollapsed =
        typeof prevUi.librarySuggestionsCollapsed === "boolean"
          ? prevUi.librarySuggestionsCollapsed
          : fallbackCollapsed;
      return {
        ...prev,
        ui: { ...prevUi, librarySuggestionsCollapsed: !currentCollapsed },
      };
    });
  }

  // IMPORTANT:
  // This page must not mutate ui.selectedCategoryId (used by Plan / CategoryDetail).
  // We isolate the Library selection in the library namespace, with execution as entry fallback only.
  const librarySelectedCategoryId = getStoredLibraryActiveCategoryId(safeData) || null;
  const homeSelectedCategoryId = getExecutionActiveCategoryId(safeData) || null;
  const libraryDetailExpandedId = safeData?.ui?.libraryDetailExpandedId || null;
  const libraryFocusTarget = normalizeLibraryFocusTarget(safeData?.ui?.libraryFocusTarget);
  const libraryViewSelectedId = librarySelectedCategoryId || homeSelectedCategoryId || null;
  const activeLibraryCategory = activeCategories.find((category) => category.id === libraryViewSelectedId) || null;

  function setLibraryCategory(categoryId) {
    if (!categoryId) return;

    // Keep Library selection local to Library page only
    if (typeof setData === "function") {
      setData((prev) => {
        const prevUi = prev.ui || {};
        return {
          ...prev,
          ui: withLibraryActiveCategoryId(prevUi, categoryId),
        };
      });
    }
  }

  function setLibraryDetailExpanded(categoryId) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (prevUi.libraryDetailExpandedId === categoryId) return prev;
      return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: categoryId } };
    });
  }

  function clearLibraryDetailExpanded() {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (!prevUi.libraryDetailExpandedId) return prev;
      return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: null } };
    });
  }

  const clearLibraryFocusTarget = useCallback(() => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (!prevUi.libraryFocusTarget) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          libraryFocusTarget: null,
        },
      };
    });
  }, [setData]);

  function handleOpenDetail(categoryId) {
    if (!categoryId) return;
    if (libraryDetailExpandedId === categoryId) {
      if (editedCategoryId === categoryId) {
        saveGoalTitleEditing();
        saveCategoryEditing(categoryId);
        stopCategoryEditing();
      }
      clearLibraryDetailExpanded();
      return;
    }
    if (editedCategoryId && editedCategoryId !== categoryId) {
      saveGoalTitleEditing();
      saveCategoryEditing(editedCategoryId);
      stopCategoryEditing();
    }
    setLibraryCategory(categoryId);
    setLibraryDetailExpanded(categoryId);
  }

  useEffect(() => {
    const target = libraryFocusTarget;
    const categoryId = target?.categoryId || null;
    if (!categoryId || typeof setData !== "function") return;

    if (libraryViewSelectedId !== categoryId || libraryDetailExpandedId !== categoryId) {
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const nextUi = withLibraryActiveCategoryId(prevUi, categoryId);
        const nextSelectedGoalByCategory =
          target.outcomeId && prevUi.selectedGoalByCategory?.[categoryId] !== target.outcomeId
            ? {
                ...(nextUi.selectedGoalByCategory || {}),
                [categoryId]: target.outcomeId,
              }
            : nextUi.selectedGoalByCategory || {};
        const nextLibraryDetailExpandedId =
          prevUi.libraryDetailExpandedId === categoryId ? prevUi.libraryDetailExpandedId : categoryId;
        return {
          ...prev,
          ui: {
            ...nextUi,
            libraryDetailExpandedId: nextLibraryDetailExpandedId,
            selectedGoalByCategory: nextSelectedGoalByCategory,
          },
        };
      });
      return;
    }

    if (typeof document === "undefined" || typeof window === "undefined") return;
    const categorySelector = `[data-library-focus-category="${escapeSelectorValue(categoryId)}"]`;
    const targetSection = target.section === "objectives" ? "objectives" : "actions";
    const targetRowId =
      targetSection === "objectives" && target.outcomeId
        ? `outcome:${target.outcomeId}`
        : targetSection === "actions" && target.actionIds.length === 1
        ? `action:${target.actionIds[0]}`
        : "";

    let timeoutId = 0;
    const frameId = window.requestAnimationFrame(() => {
      const container = document.querySelector(categorySelector);
      if (!container) return;
      const sectionNode = container.querySelector(
        `[data-library-focus-section="${escapeSelectorValue(targetSection)}"]`
      );
      const rowNode = targetRowId
        ? container.querySelector(`[data-library-focus-row="${escapeSelectorValue(targetRowId)}"]`)
        : null;
      const focusNode = rowNode || sectionNode;
      if (!focusNode || typeof focusNode.scrollIntoView !== "function") return;
      focusNode.scrollIntoView({ behavior: "smooth", block: rowNode ? "center" : "start" });
      focusNode.classList.add("flashPulse");
      clearLibraryFocusTarget();
      timeoutId = window.setTimeout(() => {
        focusNode.classList.remove("flashPulse");
      }, 1600);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [clearLibraryFocusTarget, libraryDetailExpandedId, libraryFocusTarget, libraryViewSelectedId, setData]);

  const categoryRailOrder = useMemo(
    () => (Array.isArray(safeData?.ui?.categoryRailOrder) ? safeData.ui.categoryRailOrder : []),
    [safeData?.ui?.categoryRailOrder]
  );
  const orderedUserCategories = useMemo(() => {
    const visibleIds = new Set(activeCategories.map((category) => category.id));
    const hasUserOrder = categoryRailOrder.some((id) => id && visibleIds.has(id));
    if (hasUserOrder) {
      const map = new Map(activeCategories.map((c) => [c.id, c]));
      const ordered = categoryRailOrder.filter((id) => visibleIds.has(id)).map((id) => map.get(id)).filter(Boolean);
      const missing = activeCategories.filter((c) => !categoryRailOrder.includes(c.id));
      return ordered.concat(missing);
    }
    const byName = [...activeCategories];
    byName.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "fr", { sensitivity: "base" })
    );
    return byName;
  }, [activeCategories, categoryRailOrder]);

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const c of activeCategories) {
      const counts = getCategoryCounts({ goals }, c.id);
      map.set(c.id, { habits: counts.processCount, objectives: counts.outcomesCount });
    }
    return map;
  }, [activeCategories, goals]);

  const selectedCategory = categories.find((c) => c.id === libraryDetailExpandedId) || null;
  const outcomeGoals = useMemo(() => {
    if (!selectedCategory?.id) return [];
    return goals.filter((g) => g.categoryId === selectedCategory.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, selectedCategory?.id]);
  const processGoals = useMemo(() => {
    if (!selectedCategory?.id) return [];
    return goals.filter((g) => g.categoryId === selectedCategory.id && resolveGoalType(g) === "PROCESS");
  }, [goals, selectedCategory?.id]);
  const { unlinkedHabits, actionSections } = useMemo(() => {
    const unlinked = [];
    for (const habit of processGoals) {
      const linkedOutcome = outcomeGoals.find((g) => g?.id && isProcessLinkedToOutcome(habit, g.id)) || null;
      if (!linkedOutcome?.id) unlinked.push(habit);
    }
    return {
      unlinkedHabits: unlinked,
      actionSections: buildPlanningSections(processGoals, outcomeGoals),
    };
  }, [processGoals, outcomeGoals]);
  const unlinkedHabitIds = useMemo(() => new Set(unlinkedHabits.map((h) => h.id)), [unlinkedHabits]);
  const linkTargetId =
    (selectedCategory?.mainGoalId && outcomeGoals.some((g) => g.id === selectedCategory.mainGoalId)
      ? selectedCategory.mainGoalId
      : outcomeGoals[0]?.id) || null;

  function renderCategoryItem(category, drag, allowDrag = true) {
    if (!category) return null;
    const counts = countsByCategory.get(category.id) || { habits: 0, objectives: 0 };
    const objectives = counts.objectives;
    const habits = counts.habits;
    const hasContent = objectives > 0 || habits > 0;
    const summary =
      objectives || habits
        ? `${formatCount(objectives, LABELS.goalLower, LABELS.goalsLower)} · ${formatCount(habits, LABELS.actionLower, LABELS.actionsLower)}`
        : "Aucun élément";

    const isSelected = libraryViewSelectedId === category.id;
    const isExpanded = libraryDetailExpandedId === category.id;
    const isEditing = editedCategoryId === category.id;
    const isSuggested = suggestedIds.has(category.id);
    const detailAccentVars = getCategoryUiVars(category, { level: "surface" });
    const detailWhy = (category.whyText || "").trim() || "Aucun mini-why pour cette catégorie.";
    const categoryDraft = isEditing ? draftStore.getDraft(getCategoryScopeKey(category.id)) : null;
    const draftCategoryName = categoryDraft?.working?.name ?? category.name ?? "";
    const draftCategoryWhy = categoryDraft?.working?.whyText ?? category.whyText ?? "";
    const { attributes, listeners, setActivatorNodeRef } = drag || {};

    return (
      <div key={category.id} className="col gap8">
        <AccentCategoryRow
          category={category}
          selected={isSelected}
          rightSlot={
            <span className="row gap8">
              <span className="small2 textMuted2">
                {isExpanded ? "−" : "+"}
              </span>
              {allowDrag && drag ? (
                <AppIconButton
                  ref={setActivatorNodeRef}
                  {...listeners}
                  {...attributes}
                  className="libraryDragHandle"
                  aria-label="Réorganiser"
                >
                  ⋮⋮
                </AppIconButton>
              ) : null}
            </span>
          }
          onClick={() => handleOpenDetail(category.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpenDetail(category.id);
            }
          }}
        >
          <div>
            {isEditing ? (
              <AppInput
                value={draftCategoryName}
                onChange={(event) =>
                  draftStore.patchDraft(getCategoryScopeKey(category.id), { name: event.target.value })
                }
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveCategoryEditing(category.id);
                  }
                }}
                onBlur={() => saveCategoryEditing(category.id)}
                aria-label="Nom de la catégorie"
                data-testid={`library-detail-name-${category.id}`}
              />
            ) : (
              <div className="itemTitle">{category.name}</div>
            )}
            <div className="itemSub">{summary}</div>
          </div>
        </AccentCategoryRow>
        {isExpanded ? (
          <div
            className="col gap8 libraryDetailStack"
            style={detailAccentVars}
            data-library-focus-category={category.id}
          >
            <div className="row rowBetween alignCenter">
              <div className="small2 textMuted2">
                Détails
              </div>
              <div className="row gap8">
                <GhostButton
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (isEditing) {
                      saveGoalTitleEditing();
                      saveCategoryEditing(category.id);
                      stopCategoryEditing();
                      return;
                    }
                    if (editedCategoryId && editedCategoryId !== category.id) {
                      saveGoalTitleEditing();
                      saveCategoryEditing(editedCategoryId);
                      stopCategoryEditing();
                    }
                    startCategoryEditing(category);
                  }}
                  aria-pressed={isEditing}
                >
                  {isEditing ? "Terminer" : "Gérer"}
                </GhostButton>
                {isSuggested && category.id !== SYSTEM_INBOX_ID ? (
                  <GhostButton
                    type="button"
                    size="sm"
                    onClick={() => deactivateSuggestedCategory(category)}
                    disabled={hasContent}
                  >
                    Désactiver
                  </GhostButton>
                ) : null}
              </div>
            </div>
            <AccentCategoryRow className="listItem" style={detailAccentVars}>
              <div className="small2 textMuted">
                Mini-why
              </div>
              {isEditing ? (
                <div className="mt6">
                  <AppTextarea
                    value={draftCategoryWhy}
                    onChange={(event) =>
                      draftStore.patchDraft(getCategoryScopeKey(category.id), { whyText: event.target.value })
                    }
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        saveCategoryEditing(category.id);
                      }
                    }}
                    onBlur={() => saveCategoryEditing(category.id)}
                    aria-label="Mini-why"
                    data-testid={`library-detail-why-${category.id}`}
                  />
                </div>
              ) : (
                <div className="small2 mt6">
                  {detailWhy}
                </div>
              )}
            </AccentCategoryRow>
            <div className="col gap8" data-library-focus-section="objectives">
              <div className="small2 textMuted">
                {LABELS.goals}
              </div>
              {outcomeGoals.length ? (
                <div className="col gap8">
                  {outcomeGoals.map((g) => {
                    const isPrimaryGoal = category.mainGoalId && g.id === category.mainGoalId;
                    const isEditingGoalTitle = isEditing && editingGoalId === g.id;
                    const goalDraft = isEditingGoalTitle ? draftStore.getDraft(getGoalScopeKey(g.id)) : null;
                    const draftTitle = goalDraft?.working?.title ?? g.title ?? "";
                    return (
                      <AccentCategoryRow
                        key={g.id}
                        className="listItem"
                        style={detailAccentVars}
                        data-library-focus-row={`outcome:${g.id}`}
                      >
                        <div className="row rowBetween gap8">
                          <div className="col gap6 minW0">
                            {isEditingGoalTitle ? (
                              <AppInput
                                value={draftTitle}
                                onChange={(event) =>
                                  draftStore.patchDraft(getGoalScopeKey(g.id), { title: event.target.value })
                                }
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => {
                                  event.stopPropagation();
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    saveGoalTitleEditing(g.id);
                                  } else if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelGoalTitleEditing(g.id);
                                  }
                                }}
                                onBlur={() => saveGoalTitleEditing(g.id)}
                                aria-label={`Nom du ${LABELS.goalLower}`}
                                data-testid={`library-project-title-input-${g.id}`}
                              />
                            ) : (
                              <div
                                className="itemTitle"
                                onClick={(event) => {
                                  if (!isEditing) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  beginGoalTitleEditing(g);
                                }}
                              >
                                {g.title || LABELS.goal}
                              </div>
                            )}
                          </div>
                          <div className="row gap8 alignCenter">
                            {isPrimaryGoal ? (
                              <StatusBadge tone="info">
                                Prioritaire
                              </StatusBadge>
                            ) : null}
                            {isEditing ? (
                              <>
                                <GhostButton
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    if (isEditingGoalTitle) {
                                      saveGoalTitleEditing(g.id);
                                      return;
                                    }
                                    beginGoalTitleEditing(g);
                                  }}
                                  data-testid={`library-project-rename-${g.id}`}
                                >
                                  {isEditingGoalTitle ? "OK" : "Renommer"}
                                </GhostButton>
                                <GhostButton
                                  type="button"
                                  size="sm"
                                  onClick={() => deleteOutcome(g)}
                                  data-testid={`library-project-delete-${g.id}`}
                                >
                                  ✕
                                </GhostButton>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </AccentCategoryRow>
                    );
                  })}
                </div>
              ) : (
                <div className="small2">Aucun {LABELS.goalLower} dans cette catégorie.</div>
              )}
            </div>
            {actionSections.length ? (
              <div className="col gap8" data-library-focus-section="actions">
                <div className="small2 textMuted">Actions</div>
                <div className="col gap8">
                  {actionSections.map((section) => (
                    <div key={section.key} className="col gap8">
                      <div className="small2 textMuted">{section.title}</div>
                      <div className="col gap8">
                        {section.items.map(({ goal, badges }) => {
                          const canLink = unlinkedHabitIds.has(goal.id) && linkTargetId && typeof setData === "function";
                          const isEditingGoalTitle = isEditing && editingGoalId === goal.id;
                          const goalDraft = isEditingGoalTitle ? draftStore.getDraft(getGoalScopeKey(goal.id)) : null;
                          const draftTitle = goalDraft?.working?.title ?? goal.title ?? "";
                          return (
                            <AccentCategoryRow
                              key={goal.id}
                              className="listItem"
                              style={detailAccentVars}
                              data-library-focus-row={`action:${goal.id}`}
                            >
                              <div className="row rowBetween gap8">
                                <div className="col gap6 minW0">
                                  {isEditingGoalTitle ? (
                                    <AppInput
                                      value={draftTitle}
                                      onChange={(event) =>
                                        draftStore.patchDraft(getGoalScopeKey(goal.id), { title: event.target.value })
                                      }
                                      onClick={(event) => event.stopPropagation()}
                                      onKeyDown={(event) => {
                                        event.stopPropagation();
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          saveGoalTitleEditing(goal.id);
                                        } else if (event.key === "Escape") {
                                          event.preventDefault();
                                          cancelGoalTitleEditing(goal.id);
                                        }
                                      }}
                                      onBlur={() => saveGoalTitleEditing(goal.id)}
                                      aria-label="Nom de l’action"
                                      data-testid={`library-action-title-input-${goal.id}`}
                                    />
                                  ) : (
                                    <div
                                      className="itemTitle"
                                      onClick={(event) => {
                                        if (!isEditing) return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        beginGoalTitleEditing(goal);
                                      }}
                                    >
                                      {goal.title || "Action"}
                                    </div>
                                  )}
                                  {badges.length ? (
                                      <div className="row wrap libraryBadgeRow">
                                        {badges.map((label, idx) => (
                                        <StatusBadge key={`${goal.id}-b-${idx}`} className="libraryBadge">
                                          {label}
                                        </StatusBadge>
                                      ))}
                                      </div>
                                  ) : null}
                                </div>
                                {canLink ? (
                                  <GhostButton
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      if (!linkTargetId || typeof setData !== "function") return;
                                      setData((prev) => linkProcessToOutcome(prev, goal.id, linkTargetId));
                                    }}
                                  >
                                    Lier
                                  </GhostButton>
                                ) : null}
                                {isEditing ? (
                                  <>
                                    <GhostButton
                                      type="button"
                                      size="sm"
                                      onClick={() => {
                                        if (isEditingGoalTitle) {
                                          saveGoalTitleEditing(goal.id);
                                          return;
                                        }
                                        beginGoalTitleEditing(goal);
                                      }}
                                      data-testid={`library-action-rename-${goal.id}`}
                                    >
                                      {isEditingGoalTitle ? "OK" : "Renommer"}
                                    </GhostButton>
                                    <GhostButton
                                      type="button"
                                      size="sm"
                                      onClick={() => openEditItemRoute(goal)}
                                      data-testid={`library-action-edit-${goal.id}`}
                                    >
                                      Éditer
                                    </GhostButton>
                                    <GhostButton
                                      type="button"
                                      size="sm"
                                      onClick={() => deleteAction(goal)}
                                      data-testid={`library-action-delete-${goal.id}`}
                                    >
                                      ✕
                                    </GhostButton>
                                  </>
                                ) : null}
                              </div>
                            </AccentCategoryRow>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {!linkTargetId && unlinkedHabits.length ? (
                    <div className="small2 textMuted">
                      Ajoute un {LABELS.goalLower} pour pouvoir lier ces actions.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="small2">Aucune action dans cette catégorie.</div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <AppScreen
      pageId="library"
      headerTitle={<span data-tour-id="library-title">{SURFACE_LABELS.library}</span>}
      headerSubtitle={MAIN_PAGE_COPY.library.orientation}
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="mainPageStack libraryPage">
        {legacyBuckets.reclassifyCandidates.length ? (
          <section className="mainPageSection">
            <SectionHeader
              title={MAIN_PAGE_COPY.library.reclassifyTitle}
              actions={
                <div className="small2 textMuted2">
                  {legacyBuckets.reclassifyCandidates.length} action{legacyBuckets.reclassifyCandidates.length > 1 ? "s" : ""} hors catégorie stable
                </div>
              }
            />
            <div className="mainPageSectionBody">
              <div className="librarySectionFlat col gap10">
                <div className="small2 textMuted">
                  Les actions héritées de <strong>Général</strong> restent hors de ta carte active tant qu&apos;elles ne sont pas rattachées à une catégorie stable.
                </div>
                <div className="col gap8">
                  {legacyBuckets.reclassifyCandidates.map(({ goal, inferredCategoryId }) => {
                    const inferredCategory = activeCategories.find((category) => category.id === inferredCategoryId) || null;
                    return (
                      <AccentCategoryRow
                        key={goal.id}
                        color={inferredCategory?.color || "#64748B"}
                        className="listItem"
                      >
                        <div className="row rowBetween gap8">
                          <div className="col gap6 minW0">
                            <div className="itemTitle">{goal.title || "Action"}</div>
                            <div className="itemSub">
                              {inferredCategory
                                ? `À rattacher à ${inferredCategory.name}`
                                : "Choisis une catégorie stable avant de la réutiliser."}
                            </div>
                          </div>
                          <div className="row gap8 alignCenter">
                            {inferredCategory ? (
                              <GhostButton
                                type="button"
                                size="sm"
                                onClick={() => handleReclassifyLegacyGoal(goal, inferredCategory.id)}
                              >
                                Classer
                              </GhostButton>
                            ) : null}
                            <GhostButton
                              type="button"
                              size="sm"
                              onClick={() => openEditItemRoute(goal)}
                            >
                              Éditer
                            </GhostButton>
                          </div>
                        </div>
                      </AccentCategoryRow>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mainPageSection">
          <SectionHeader
            title={MAIN_PAGE_COPY.library.primaryTitle}
            actions={
              !isEmpty ? (
                <div className="small2 textMuted2">
                  {orderedUserCategories.length} catégorie{orderedUserCategories.length > 1 ? "s" : ""} active{orderedUserCategories.length > 1 ? "s" : ""}
                </div>
              ) : null
            }
          />
          <div className="mainPageSectionBody">
            <div
              className="libraryPrimaryStack"
              style={activeLibraryCategory ? getCategoryUiVars(activeLibraryCategory, { level: "surface" }) : undefined}
              data-tour-id="library-category-list"
            >
              {isEmpty ? <div className="small2 textMuted">Aucune catégorie active. Commence par poser un premier chantier durable.</div> : null}
              {orderedUserCategories.length ? (
                <SortableBlocks
                  items={orderedUserCategories}
                  getId={(item) => item.id}
                  onReorder={(nextItems) => {
                    if (typeof setData !== "function") return;
                    const nextIds = nextItems.map((item) => item.id).filter(Boolean);
                    setData((prev) => ({
                      ...prev,
                      ui: { ...(prev.ui || {}), categoryRailOrder: nextIds },
                    }));
                  }}
                  className="col"
                  renderItem={(category, drag) => renderCategoryItem(category, drag, true)}
                />
              ) : null}
              {remainingSuggestions.length ? (
                <div className="col gap8">
                  <div className="row rowBetween alignCenter librarySuggestionsHeader">
                    <div className="small2 textMuted">
                      {MAIN_PAGE_COPY.library.suggestionsTitle}
                      <span className="textMuted2"> ({remainingSuggestions.length})</span>
                    </div>
                    <GhostButton
                      type="button"
                      size="sm"
                      className="librarySuggestionsToggle"
                      aria-expanded={suggestionsOpen}
                      onClick={toggleSuggestionsOpen}
                    >
                      {suggestionsOpen ? "Réduire" : "Afficher"}
                    </GhostButton>
                  </div>
                  {suggestionsOpen ? (
                    <div className="categoryGateList isCollapsed librarySuggestionsList">
                      {remainingSuggestions.map((cat) => (
                        <div key={cat.id} className="categoryGateItem">
                          <span className="categoryGateSwatch" style={{ background: resolveCategoryColor(cat, "#4F7CFF") }} />
                          <span className="categoryGateName">{cat.name || "Catégorie"}</span>
                          <AppChip
                            active={activeCategoryIds.has(cat.id)}
                            className="categoryGateSwitch"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (activeCategoryIds.has(cat.id)) {
                                deactivateSuggestedCategory(cat);
                              } else {
                                activateSuggestedCategory(cat);
                              }
                            }}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            aria-pressed={activeCategoryIds.has(cat.id)}
                            title="Active pour l’utiliser et créer du contenu."
                          >
                            {activeCategoryIds.has(cat.id) ? "Activée" : "Activer"}
                          </AppChip>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppScreen>
  );
}
