// src/pages/Categories.jsx
import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, AccentItem, Input, Textarea } from "../components/UI";
import SortableBlocks from "../components/SortableBlocks";
import EditItemPanel from "../components/EditItemPanel";
import { getCategoryCounts } from "../logic/pilotage";
import { ensureSystemInboxCategory, normalizeCategory, SYSTEM_INBOX_ID } from "../logic/state";
import { updateGoal } from "../logic/goals";
import { regenerateWindowFromScheduleRules } from "../logic/occurrencePlanner";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import { canCreateCategory, getGenerationWindowDays } from "../logic/entitlements";
import { LABELS } from "../ui/labels";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { resolveGoalType } from "../domain/goalType";
import { isProcessLinkedToOutcome, linkProcessToOutcome } from "../logic/linking";
import { buildPlanningSections } from "../utils/librarySections";
import { safeConfirm } from "../utils/dialogs";
import { uid } from "../utils/helpers";
import { addDays } from "../utils/dates";
import { fromLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { useDraftStore } from "../shared/draft/useDraft";
import { flushDraftScopes, onBeforeLeaveScope } from "../shared/draft/draftGuards";
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

function buildOccurrencesByGoal(list) {
  const entries = Array.isArray(list) ? list : [];
  const map = new Map();
  for (const occ of entries) {
    if (!occ || typeof occ.goalId !== "string") continue;
    const bucket = map.get(occ.goalId) || [];
    bucket.push(occ);
    map.set(occ.goalId, bucket);
  }
  return map;
}

function buildPlanSignature(goal, occurrencesByGoal) {
  if (!goal) return "";
  const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
  const scheduleSig = schedule
    ? JSON.stringify({
        daysOfWeek: Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [],
        timeSlots: Array.isArray(schedule.timeSlots) ? schedule.timeSlots : [],
        durationMinutes: Number.isFinite(schedule.durationMinutes) ? schedule.durationMinutes : null,
        windowStart: schedule.windowStart || "",
        windowEnd: schedule.windowEnd || "",
      })
    : "";
  const occurrences = occurrencesByGoal?.get(goal.id) || [];
  const occurrenceSig = occurrences
    .map((occ) => `${occ?.date || ""}|${occ?.start || ""}|${occ?.status || ""}`)
    .sort()
    .join(",");
  return `${goal.planType || ""}|${goal.startAt || ""}|${scheduleSig}|${occurrenceSig}`;
}

function updateRemindersForGoal(state, goalId, config, fallbackLabel, options = {}) {
  const base = Array.isArray(state?.reminders) ? state.reminders : [];
  const others = base.filter((r) => r.goalId !== goalId);
  const goal = Array.isArray(state?.goals) ? state.goals.find((g) => g?.id === goalId) : null;
  const goalType = resolveGoalType(goal);
  if (goalType !== "PROCESS") return others;

  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const goalOccurrences = occurrences.filter((occ) => occ?.goalId === goalId);
  const hasOccurrences = goalOccurrences.length > 0;
  const schedule = goal && typeof goal.schedule === "object" ? goal.schedule : null;
  const scheduleSlots = Array.isArray(schedule?.timeSlots) ? schedule.timeSlots : [];
  const scheduleDays =
    Array.isArray(schedule?.daysOfWeek) && schedule.daysOfWeek.length ? schedule.daysOfWeek : [1, 2, 3, 4, 5, 6, 7];
  const canUseReminders = hasOccurrences || scheduleSlots.length > 0;
  if (!config || !config.enabled || !canUseReminders) return others;

  const channel = config.channel === "NOTIFICATION" ? "NOTIFICATION" : "IN_APP";
  const label = config.label || fallbackLabel || "Rappel";
  const requestedTimes = Array.isArray(config.times) ? config.times : [];
  const occurrenceTimes = [
    ...new Set(goalOccurrences.map((occ) => (typeof occ?.start === "string" ? occ.start : "")).filter(Boolean)),
  ];
  const times = hasOccurrences
    ? occurrenceTimes.length
      ? occurrenceTimes
      : requestedTimes.length
        ? requestedTimes
        : ["09:00"]
    : scheduleSlots;
  const safeTimes = times.filter((t) => typeof t === "string" && t.trim().length);
  if (!safeTimes.length) return others;

  const existing = base.filter((r) => r.goalId === goalId);
  const forceNewIds = options?.forceNewIds === true;
  const nextForGoal = safeTimes.map((time, index) => {
    const prev = !forceNewIds ? existing[index] : null;
    return {
      id: prev?.id || uid(),
      goalId,
      time,
      enabled: true,
      channel,
      days: scheduleDays,
      label: prev?.label || label,
    };
  });

  return [...others, ...nextForGoal];
}

export default function Categories({
  data,
  setData,
  onOpenPaywall,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const draftStore = useDraftStore();
  const [editedCategoryId, setEditedCategoryId] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editPanelGoalId, setEditPanelGoalId] = useState(null);
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const occurrences = useMemo(
    () => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []),
    [safeData.occurrences]
  );
  const reminders = useMemo(
    () => (Array.isArray(safeData.reminders) ? safeData.reminders : []),
    [safeData.reminders]
  );
  const sysCategory = useMemo(
    () => categories.find((c) => c?.id === SYSTEM_INBOX_ID) || categories.find((c) => c?.system) || null,
    [categories]
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => c && c.id !== SYSTEM_INBOX_ID),
    [categories]
  );
  const isEmpty = activeCategories.length === 0;
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
    () => new Set(categories.map((c) => c?.id).filter(Boolean)),
    [categories]
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
    if (sysCategory || typeof setData !== "function") return;
    setData((prev) => ensureSystemInboxCategory(prev).state);
  }, [sysCategory, setData]);

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
    setEditPanelGoalId(null);
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
    setEditPanelGoalId(null);
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
    if (editPanelGoalId === goal.id) setEditPanelGoalId(null);
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
      return {
        ...prev,
        goals: nextGoals,
        occurrences: nextOccurrences,
        reminders: nextReminders,
        sessions: nextSessions,
        checks: nextChecks,
        ui: nextUi,
      };
    });
    if (editPanelGoalId === goalId) setEditPanelGoalId(null);
  }

  function openActionEditPanel(goal) {
    if (!goal?.id) return;
    if (editingGoalId) {
      saveGoalTitleEditing(editingGoalId);
    }
    setEditPanelGoalId(goal.id);
  }

  function closeActionEditPanel() {
    setEditPanelGoalId(null);
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
      const nextUi = { ...(next.ui || {}) };
      if (nextUi.selectedCategoryId === cat.id) nextUi.selectedCategoryId = sysId;
      if (nextUi.selectedCategoryByView) {
        const scv = { ...nextUi.selectedCategoryByView };
        if (scv.library === cat.id) scv.library = sysId;
        if (scv.plan === cat.id) scv.plan = sysId;
        if (scv.home === cat.id) scv.home = sysId;
        if (scv.pilotage === cat.id) scv.pilotage = sysId;
        nextUi.selectedCategoryByView = scv;
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
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const hasActive = prevCategories.some((c) => c && c.id !== SYSTEM_INBOX_ID);
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
  // We isolate the Library selection using ui.librarySelectedCategoryId.
  const librarySelectedCategoryId = safeData?.ui?.librarySelectedCategoryId || null;
  const homeSelectedCategoryId =
    safeData?.ui?.selectedCategoryByView?.home || safeData?.ui?.selectedCategoryId || null;
  const libraryDetailExpandedId = safeData?.ui?.libraryDetailExpandedId || null;
  const libraryViewSelectedId = librarySelectedCategoryId || homeSelectedCategoryId || null;

  function markLibraryTouched() {
    try {
      sessionStorage.setItem("library:selectedCategoryTouched", "1");
    } catch (err) {
      void err;
    }
  }

  function setLibraryCategory(categoryId) {
    if (!categoryId) return;

    // Keep Library selection local to Library page only
    if (typeof setData === "function") {
      setData((prev) => {
        const prevUi = prev.ui || {};
        const prevSel =
          prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        return {
          ...prev,
          ui: {
            ...prevUi,
            librarySelectedCategoryId: categoryId,
            selectedCategoryByView: { ...prevSel, library: categoryId },
          },
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

  function handleOpenDetail(categoryId) {
    if (!categoryId) return;
    markLibraryTouched();
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

  const categoryRailOrder = useMemo(
    () => (Array.isArray(safeData?.ui?.categoryRailOrder) ? safeData.ui.categoryRailOrder : []),
    [safeData?.ui?.categoryRailOrder]
  );
  const orderedUserCategories = useMemo(() => {
    const hasUserOrder = categoryRailOrder.some((id) => id && id !== SYSTEM_INBOX_ID);
    if (hasUserOrder) {
      const map = new Map(activeCategories.map((c) => [c.id, c]));
      const ordered = categoryRailOrder.map((id) => map.get(id)).filter(Boolean);
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
    for (const c of categories) {
      const counts = getCategoryCounts({ goals }, c.id);
      map.set(c.id, { habits: counts.processCount, objectives: counts.outcomesCount });
    }
    return map;
  }, [categories, goals]);

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
  const editPanelGoal = useMemo(() => {
    if (!editPanelGoalId) return null;
    const goal = goals.find((g) => g?.id === editPanelGoalId);
    if (!goal) return null;
    return {
      ...goal,
      _occurrences: occurrences.filter((occ) => occ?.goalId === editPanelGoalId),
      _reminders: reminders.filter((rem) => rem?.goalId === editPanelGoalId),
    };
  }, [editPanelGoalId, goals, occurrences, reminders]);

  function handleEditPanelSave(payload) {
    if (!editPanelGoalId || typeof setData !== "function") return;
    const goalId = editPanelGoalId;
    const rawPayload = payload && typeof payload === "object" ? payload : {};
    const updates = rawPayload.updates && typeof rawPayload.updates === "object" ? rawPayload.updates : {};
    const reminderConfig = rawPayload.reminderConfig || null;

    setData((prev) => {
      const prevOccurrencesByGoal = buildOccurrencesByGoal(prev?.occurrences);
      const prevGoal = Array.isArray(prev?.goals) ? prev.goals.find((g) => g?.id === goalId) : null;
      const goalType = resolveGoalType(prevGoal);
      const prevPlanSig = buildPlanSignature(prevGoal, prevOccurrencesByGoal);

      let next = updateGoal(prev, goalId, updates);
      const nextOccurrencesByGoal = buildOccurrencesByGoal(next?.occurrences);
      const nextGoal = Array.isArray(next?.goals) ? next.goals.find((g) => g?.id === goalId) : null;
      const nextPlanSig = buildPlanSignature(nextGoal, nextOccurrencesByGoal);
      const planChanged = prevPlanSig !== nextPlanSig;

      if (goalType === "OUTCOME") {
        if (Array.isArray(next.reminders)) {
          const filtered = next.reminders.filter((r) => r.goalId !== goalId);
          if (filtered.length !== next.reminders.length) {
            next = { ...next, reminders: filtered };
          }
        }
      } else if (reminderConfig) {
        const label = updates.title || prevGoal?.title || "Rappel";
        const nextReminders = updateRemindersForGoal(next, goalId, reminderConfig, label, { forceNewIds: planChanged });
        next = { ...next, reminders: nextReminders };
      } else if (Array.isArray(next.reminders)) {
        const filtered = next.reminders.filter((r) => r.goalId !== goalId);
        if (filtered.length !== next.reminders.length) {
          next = { ...next, reminders: filtered };
        }
      }

      if (planChanged && goalType !== "OUTCOME") {
        const days = Number.isFinite(getGenerationWindowDays(next)) ? Math.max(1, getGenerationWindowDays(next)) : 14;
        const fromKey = todayLocalKey();
        const baseDate = fromLocalDateKey(fromKey);
        const toKey = baseDate ? toLocalDateKey(addDays(baseDate, Math.max(0, days - 1))) : fromKey;
        next = regenerateWindowFromScheduleRules(next, goalId, fromKey, toKey);
      }

      return next;
    });
    closeActionEditPanel();
  }

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
    const detailAccentVars = getCategoryAccentVars(category.color);
    const detailWhy = (category.whyText || "").trim() || "Aucun mini-why pour cette catégorie.";
    const categoryDraft = isEditing ? draftStore.getDraft(getCategoryScopeKey(category.id)) : null;
    const draftCategoryName = categoryDraft?.working?.name ?? category.name ?? "";
    const draftCategoryWhy = categoryDraft?.working?.whyText ?? category.whyText ?? "";
    const { attributes, listeners, setActivatorNodeRef } = drag || {};

    return (
      <div key={category.id} className="col gap8">
        <AccentItem
          color={category.color}
          selected={isSelected}
          rightSlot={
            <span className="row gap8">
              <span className="small2 textMuted2">
                {isExpanded ? "−" : "+"}
              </span>
              {allowDrag && drag ? (
                <button
                  ref={setActivatorNodeRef}
                  {...listeners}
                  {...attributes}
                  className="dragHandle"
                  aria-label="Réorganiser"
                >
                  ⋮⋮
                </button>
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
              <Input
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
        </AccentItem>
        {isExpanded ? (
          <div className="col gap8 pl10" style={detailAccentVars}>
            <div className="row rowBetween alignCenter">
              <div className="small2 textMuted2">
                Détails
              </div>
              <div className="row gap8">
                <Button
                  variant="ghost"
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
                </Button>
                {isSuggested && category.id !== SYSTEM_INBOX_ID ? (
                  <Button
                    variant="ghost"
                    onClick={() => deactivateSuggestedCategory(category)}
                    disabled={hasContent}
                  >
                    Désactiver
                  </Button>
                ) : null}
              </div>
            </div>
            <AccentItem className="listItem" style={detailAccentVars}>
              <div className="small2 textMuted">
                Mini-why
              </div>
              {isEditing ? (
                <div className="mt6">
                  <Textarea
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
            </AccentItem>
            <div className="col gap8">
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
                      <AccentItem key={g.id} className="listItem" style={detailAccentVars}>
                        <div className="row rowBetween gap8">
                          <div className="col gap6 minW0">
                            {isEditingGoalTitle ? (
                              <Input
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
                              <span className="badge badgeAccent">
                                Prioritaire
                              </span>
                            ) : null}
                            {isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
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
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => deleteOutcome(g)}
                                  data-testid={`library-project-delete-${g.id}`}
                                >
                                  ✕
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </AccentItem>
                    );
                  })}
                </div>
              ) : (
                <div className="small2">Aucun {LABELS.goalLower} dans cette catégorie.</div>
              )}
            </div>
            {actionSections.length ? (
              <div className="col gap8">
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
                            <AccentItem key={goal.id} className="listItem" style={detailAccentVars}>
                              <div className="row rowBetween gap8">
                                <div className="col gap6 minW0">
                                  {isEditingGoalTitle ? (
                                    <Input
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
                                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                      {badges.map((label, idx) => (
                                        <span key={`${goal.id}-b-${idx}`} className="badge">
                                          {label}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                                {canLink ? (
                                  <Button
                                    variant="ghost"
                                    onClick={() => {
                                      if (!linkTargetId || typeof setData !== "function") return;
                                      setData((prev) => linkProcessToOutcome(prev, goal.id, linkTargetId));
                                    }}
                                  >
                                    Lier
                                  </Button>
                                ) : null}
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="ghost"
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
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      onClick={() => openActionEditPanel(goal)}
                                      data-testid={`library-action-edit-${goal.id}`}
                                    >
                                      Éditer
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      onClick={() => deleteAction(goal)}
                                      data-testid={`library-action-delete-${goal.id}`}
                                    >
                                      ✕
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </AccentItem>
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

  const sysCategoryDisplay = useMemo(
    () => sysCategory || { id: SYSTEM_INBOX_ID, name: "Général", color: "#64748B" },
    [sysCategory]
  );
  const orderedRealCategories = useMemo(
    () => [sysCategoryDisplay, ...orderedUserCategories].filter(Boolean),
    [sysCategoryDisplay, orderedUserCategories]
  );

  return (
      <ScreenShell
        headerTitle={<span data-tour-id="library-title">Bibliothèque</span>}
        headerSubtitle="Catégories"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
      <div className="stack stackGap12 pageNarrow">
        <Card>
          <div className="p18">
            <div className="row rowBetween alignCenter">
              <div className="sectionTitle">Catégories</div>
            </div>

            <div className="mt12 col gap10" data-tour-id="library-category-list">
              {isEmpty ? <div className="small2 textMuted">Aucune catégorie active.</div> : null}
              {orderedRealCategories.length ? (
                <SortableBlocks
                  items={orderedRealCategories}
                  getId={(item) => item.id}
                  onReorder={(nextItems) => {
                    if (typeof setData !== "function") return;
                    const nextIds = nextItems.map((item) => item.id).filter(Boolean);
                    const filtered = nextIds.filter((id) => id !== SYSTEM_INBOX_ID);
                    const nextOrder = [SYSTEM_INBOX_ID, ...filtered];
                    setData((prev) => ({
                      ...prev,
                      ui: { ...(prev.ui || {}), categoryRailOrder: nextOrder },
                    }));
                  }}
                  className="col"
                  renderItem={(category, drag) =>
                    renderCategoryItem(category, drag, category?.id !== SYSTEM_INBOX_ID)
                  }
                />
              ) : null}
              {remainingSuggestions.length ? (
                <div className="col gap8">
                  <div
                    className="row rowBetween alignCenter"
                    role="button"
                    tabIndex={0}
                    onClick={toggleSuggestionsOpen}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSuggestionsOpen();
                      }
                    }}
                  >
                    <div className="small2">
                      Suggestions de catégories
                      <span className="textMuted2"> ({remainingSuggestions.length})</span>
                    </div>
                    <span className="small2 textMuted2">
                      {suggestionsOpen ? "Réduire" : "Afficher"}
                    </span>
                  </div>
                  {suggestionsOpen ? (
                    <div className="categoryGateList isCollapsed">
                      {remainingSuggestions.map((cat) => (
                        <div key={cat.id} className="categoryGateItem">
                          <span className="categoryGateSwatch" style={{ background: cat.color || "#F97316" }} />
                          <span className="categoryGateName">{cat.name || "Catégorie"}</span>
                          <button
                            type="button"
                            className={`categoryGateSwitch${activeCategoryIds.has(cat.id) ? " isActive" : ""}`}
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
                            <span className="categoryGateSwitchLabel">
                              {activeCategoryIds.has(cat.id) ? "Activée" : "Activer"}
                            </span>
                            <span className="categoryGateSwitchThumb" aria-hidden="true">
                              {activeCategoryIds.has(cat.id) ? "✓" : ""}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
      {editPanelGoal ? (
        <EditItemPanel
          item={editPanelGoal}
          type={resolveGoalType(editPanelGoal)}
          onSave={handleEditPanelSave}
          onDelete={() => {
            const goalType = resolveGoalType(editPanelGoal);
            if (goalType === "OUTCOME") {
              deleteOutcome(editPanelGoal);
            } else {
              deleteAction(editPanelGoal);
            }
          }}
          onClose={closeActionEditPanel}
        />
      ) : null}
    </ScreenShell>
  );
}
