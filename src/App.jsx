import React, { useEffect, useMemo, useRef, useState } from "react";
import TopNav from "./components/TopNav";
import { migrate, usePersistedState } from "./logic/state";
import { autoActivateScheduledGoals } from "./logic/goals";
import { getDueReminders, playReminderSound, sendReminderNotification } from "./logic/reminders";
import { startSession } from "./logic/sessions";
import { Button, Card } from "./components/UI";
import ScreenShell from "./pages/_ScreenShell";
import { markIOSRootClass } from "./utils/dialogs";

import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Categories from "./pages/Categories";
import CreateV2 from "./pages/CreateV2";
import CreateV2Category from "./pages/CreateV2Category";
import CreateV2Outcome from "./pages/CreateV2Outcome";
import CreateV2Habits from "./pages/CreateV2Habits";
import CreateV2Rhythm from "./pages/CreateV2Rhythm";
import CreateV2Review from "./pages/CreateV2Review";
import Settings from "./pages/Settings";
import CategoryView from "./pages/CategoryView";
import EditItem from "./pages/EditItem";
import CategoryDetailView from "./pages/CategoryDetailView";
import CategoryProgress from "./pages/CategoryProgress";
import Session from "./pages/Session";
import Pilotage from "./pages/Pilotage";
import { applyThemeTokens, getThemeName } from "./theme/themeTokens";
import { fromLocalDateKey, toLocalDateKey, todayLocalKey } from "./utils/dateKey";
import { isPrimaryCategory, normalizePriorities } from "./logic/priority";
import { getCategoryCounts } from "./logic/pilotage";
import { resolveGoalType } from "./domain/goalType";
import { FIRST_USE_TOUR_STEPS, TOUR_VERSION } from "./tour/tourSpec";
import { useTour } from "./tour/useTour";
import TourOverlay from "./tour/TourOverlay";
import { createEmptyDraft, normalizeCreationDraft } from "./creation/creationDraft";
import { STEP_CATEGORY, STEP_HABITS, STEP_OUTCOME, isValidCreationStep } from "./creation/creationSchema";
import DiagnosticOverlay from "./components/DiagnosticOverlay";

function runSelfTests() {
  // minimal sanity
  console.assert(typeof window !== "undefined", "browser env");
}

function parseLocalDateKey(key) {
  return fromLocalDateKey(key);
}

function localDateKey(d = new Date()) {
  return toLocalDateKey(d);
}

function appDowFromDateKey(key) {
  const d = parseLocalDateKey(key);
  const js = d.getDay(); // 0..6 (Sun..Sat)
  return js === 0 ? 7 : js; // 1..7 (Mon..Sun)
}

function getHomeSelectedCategoryId(data) {
  const safe = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safe.categories) ? safe.categories : [];
  const goals = Array.isArray(safe.goals) ? safe.goals : [];
  const homeSelectedId = safe.ui?.selectedCategoryByView?.home || safe.ui?.selectedCategoryId || null;
  if (homeSelectedId && categories.some((c) => c.id === homeSelectedId)) return homeSelectedId;
  const primary = categories.find((c) => isPrimaryCategory(c)) || null;
  if (primary) return primary.id;
  const withGoal = categories.find((c) =>
    goals.some((g) => g.categoryId === c.id && resolveGoalType(g) === "OUTCOME")
  );
  return withGoal?.id || categories[0]?.id || null;
}

function isOnboarded(data) {
  const nameOk = Boolean((data?.profile?.name || "").trim());
  const whyOk = Boolean((data?.profile?.whyText || "").trim());
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  if (!nameOk || !whyOk || categories.length === 0) return false;
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const outcomes = goals.filter((g) => resolveGoalType(g) === "OUTCOME");
  if (!outcomes.length) return false;
  const outcomeIds = new Set(outcomes.map((g) => g.id));
  const hasProcess = goals.some(
    (g) => resolveGoalType(g) === "PROCESS" && g.parentId && outcomeIds.has(g.parentId)
  );
  return hasProcess;
}

function getEmptyStateConfig(data) {
  const safe = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safe.categories) ? safe.categories : [];
  const goals = Array.isArray(safe.goals) ? safe.goals : [];
  const outcomes = goals.filter((g) => resolveGoalType(g) === "OUTCOME");
  const outcomeIds = new Set(outcomes.map((g) => g.id));
  const hasOutcome = outcomes.length > 0;
  const hasHabit = goals.some(
    (g) => resolveGoalType(g) === "PROCESS" && g.parentId && outcomeIds.has(g.parentId)
  );
  const firstCategoryId = categories[0]?.id || null;
  const outcomeCategoryId = outcomes[0]?.categoryId || firstCategoryId;

  if (!categories.length) {
    return {
      title: "Aucune catégorie",
      subtitle: "Crée une catégorie pour reprendre.",
      cta: "Créer une catégorie",
      targetTab: "create-category",
      categoryId: null,
      openGoalEditId: null,
    };
  }
  if (!hasOutcome) {
    return {
      title: "Aucun objectif",
      subtitle: "Crée un objectif principal pour cette catégorie.",
      cta: "Créer un objectif",
      targetTab: "create-goal",
      categoryId: firstCategoryId,
      openGoalEditId: null,
    };
  }
  if (!hasHabit) {
    return {
      title: "Aucune action",
      subtitle: "Crée une action liée à ton objectif principal.",
      cta: "Créer une action",
      targetTab: "create-habit",
      categoryId: outcomeCategoryId,
      openGoalEditId: null,
    };
  }
  return {
    title: "État incomplet",
    subtitle: "Complète la configuration pour continuer.",
    cta: "Ouvrir la bibliothèque",
    targetTab: "library",
    categoryId: firstCategoryId,
    openGoalEditId: null,
  };
}

const TABS = new Set([
  "today",
  "library",
  "pilotage",
  "create",
  "create-category",
  "create-goal",
  "create-habit",
  "create-rhythm",
  "create-review",
  "edit-item",
  "session",
  "category-progress",
  "category-detail",
  "settings",
]);
function normalizeTab(t) {
  if (t === "tools" || t === "plan") return "pilotage";
  return TABS.has(t) ? t : "today";
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
  const initialPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const initialSearch =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const pathParts = initialPath.split("/").filter(Boolean);
  const initialCategoryProgressId =
    pathParts[0] === "category" && pathParts[2] === "progress"
      ? decodeURIComponent(pathParts[1] || "")
      : null;
  const initialCategoryDetailId =
    pathParts[0] === "category" && pathParts.length === 2 ? decodeURIComponent(pathParts[1] || "") : null;
  const isPilotagePath = initialPath.startsWith("/pilotage") || initialPath.startsWith("/tools");
  const initialTab = isPilotagePath
    ? "pilotage"
    : initialPath.startsWith("/session")
      ? "session"
      : initialCategoryProgressId
        ? "category-progress"
        : initialCategoryDetailId
          ? "category-detail"
          : "today";
  const [tab, _setTab] = useState(initialTab);
  const [categoryDetailId, setCategoryDetailId] = useState(initialCategoryDetailId);
  const [categoryProgressId, setCategoryProgressId] = useState(initialCategoryProgressId);
  const [libraryCategoryId, setLibraryCategoryId] = useState(null);
  const [sessionCategoryId, setSessionCategoryId] = useState(initialSearch?.get("cat") || null);
  const [sessionDateKey, setSessionDateKey] = useState(initialSearch?.get("date") || null);
  const [activeReminder, setActiveReminder] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [createFlowCategoryId, setCreateFlowCategoryId] = useState(null);
  const [createFlowGoalId, setCreateFlowGoalId] = useState(null);
  const dataRef = useRef(data);
  const lastReminderRef = useRef({});
  const activeReminderRef = useRef(activeReminder);
  const prevTabRef = useRef(tab);
  const tour = useTour({ data, setData, steps: FIRST_USE_TOUR_STEPS, tourVersion: TOUR_VERSION });

  const setTab = (next, opts = {}) => {
    const t = normalizeTab(next);
    const nextSessionCategoryId =
      typeof opts.sessionCategoryId === "string" ? opts.sessionCategoryId : sessionCategoryId;
    const nextSessionDateKey =
      typeof opts.sessionDateKey === "string" ? opts.sessionDateKey : sessionDateKey;
    const nextCategoryProgressId =
      typeof opts.categoryProgressId === "string" ? opts.categoryProgressId : categoryProgressId;
    const nextCategoryDetailId =
      typeof opts.categoryDetailId === "string" ? opts.categoryDetailId : categoryDetailId;
    if (t === "session" && typeof opts.sessionCategoryId === "string") {
      setSessionCategoryId(opts.sessionCategoryId);
    } else if (t === "session" && opts.sessionCategoryId === null) {
      setSessionCategoryId(null);
    }
    if (t === "session" && typeof opts.sessionDateKey === "string") {
      setSessionDateKey(opts.sessionDateKey);
    } else if (t === "session" && opts.sessionDateKey === null) {
      setSessionDateKey(null);
    }
    if (t === "category-progress" && typeof opts.categoryProgressId === "string") {
      setCategoryProgressId(opts.categoryProgressId);
    } else if (t === "category-progress" && opts.categoryProgressId === null) {
      setCategoryProgressId(null);
    }
    if (t === "category-detail" && typeof opts.categoryDetailId === "string") {
      setCategoryDetailId(opts.categoryDetailId);
    } else if (t === "category-detail" && opts.categoryDetailId === null) {
      setCategoryDetailId(null);
    }
    _setTab(t);
    // persist last tab for better UX (non-blocking)
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), lastTab: t },
    }));
    if (typeof window !== "undefined") {
      const nextPath =
        t === "session"
          ? nextSessionCategoryId || nextSessionDateKey
            ? `/session?${[
                nextSessionCategoryId ? `cat=${encodeURIComponent(nextSessionCategoryId)}` : "",
                nextSessionDateKey ? `date=${encodeURIComponent(nextSessionDateKey)}` : "",
              ]
                .filter(Boolean)
                .join("&")}`
            : "/session"
          : t === "category-progress"
            ? nextCategoryProgressId
              ? `/category/${nextCategoryProgressId}/progress`
              : "/category"
          : t === "category-detail"
            ? nextCategoryDetailId
              ? `/category/${nextCategoryDetailId}`
              : "/category"
            : t === "pilotage"
              ? "/pilotage"
              : "/";
      if (window.location.pathname !== nextPath) {
        const state =
          t === "session"
            ? { categoryId: nextSessionCategoryId || null, date: nextSessionDateKey || null }
            : {};
        window.history.pushState(state, "", nextPath);
      }
    }
  };

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    activeReminderRef.current = activeReminder;
  }, [activeReminder]);

  const reminderFingerprint = useMemo(() => {
    const reminders = Array.isArray(data?.reminders) ? data.reminders : [];
    const goals = Array.isArray(data?.goals) ? data.goals : [];
    const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
    const reminderSig = reminders
      .map((r) => {
        const days = Array.isArray(r?.days) ? r.days.join(",") : "";
        return `${r?.id || ""}:${r?.goalId || ""}:${r?.time || ""}:${r?.enabled === false ? 0 : 1}:${days}:${
          r?.channel || ""
        }`;
      })
      .sort()
      .join("|");
    const scheduleSig = goals
      .filter((g) => (g?.type || g?.kind || "").toString().toUpperCase() === "PROCESS")
      .map((g) => {
        const slots = Array.isArray(g?.schedule?.timeSlots) ? g.schedule.timeSlots.join(",") : "";
        const days = Array.isArray(g?.schedule?.daysOfWeek) ? g.schedule.daysOfWeek.join(",") : "";
        const enabled = g?.schedule?.remindersEnabled ? 1 : 0;
        return `${g?.id || ""}:${slots}:${days}:${enabled}`;
      })
      .sort()
      .join("|");
    const occurrenceSig = occurrences
      .map((o) => `${o?.id || ""}:${o?.goalId || ""}:${o?.date || ""}:${o?.start || ""}:${o?.status || ""}`)
      .sort()
      .join("|");
    return `${reminderSig}||${scheduleSig}||${occurrenceSig}`;
  }, [data?.reminders, data?.goals, data?.occurrences]);

  useEffect(() => {
    lastReminderRef.current = {};
    if (typeof window !== "undefined" && window.__debugReminders) {
      // eslint-disable-next-line no-console
      console.debug("[reminders] cache cleared");
    }
  }, [reminderFingerprint]);

  useEffect(() => {
    if (
      tab === "create-category" ||
      tab === "create-goal" ||
      tab === "create-habit" ||
      tab === "create-rhythm" ||
      tab === "create-review"
    ) {
      return;
    }
    setCreateFlowCategoryId(null);
    setCreateFlowGoalId(null);
  }, [tab]);

  useEffect(() => {
    runSelfTests();
    setData((prev) => normalizePriorities(migrate(prev)));
    markIOSRootClass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => autoActivateScheduledGoals(prev, new Date()));
    }, 60000);
    return () => clearInterval(id);
  }, [setData]);

  useEffect(() => {
    const id = setInterval(() => {
      const debug = typeof window !== "undefined" && window.__debugReminders;
      if (activeReminderRef.current) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.debug("[reminders] skipped: active reminder");
        }
        return;
      }
      const current = dataRef.current;
      const now = new Date();
      const due = getDueReminders(current, now, lastReminderRef.current);
      if (debug) {
        // eslint-disable-next-line no-console
        console.debug("[reminders] tick", { now: now.toISOString(), due: due.length });
      }
      if (!due.length) return;
      const reminder = due[0];
      const goal = (current.goals || []).find((g) => g.id === reminder.goalId) || null;
      const habit = !goal ? (current.habits || []).find((h) => h.id === reminder.goalId) || null : null;
      const soundEnabled = Boolean(current?.ui?.soundEnabled);
      if (debug) {
        // eslint-disable-next-line no-console
        console.debug("[reminders] dispatch", {
          goalId: reminder.goalId,
          id: reminder.id,
          source: reminder.__source || "unknown",
          time: reminder.time,
        });
      }
      setActiveReminder({ reminder, goal, habit });
      if (soundEnabled) playReminderSound();
      if ((reminder.channel || "IN_APP") === "NOTIFICATION") {
        sendReminderNotification(reminder, goal?.title || habit?.title || "");
      }
    }, 30000);
    return () => clearInterval(id);
  }, [setData]);


  const safeData = data && typeof data === "object" ? data : {};
  const isCreateTab =
    tab === "create" ||
    tab === "create-category" ||
    tab === "create-goal" ||
    tab === "create-habit" ||
    tab === "create-rhythm" ||
    tab === "create-review";
  const themeName = getThemeName(safeData);
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const categoryIdsKey = categories.map((c) => c.id).join("|");
  const categoryRailOrder = useMemo(
    () => ensureOrder(safeData?.ui?.categoryRailOrder, categories),
    [safeData?.ui?.categoryRailOrder, categoryIdsKey]
  );
  const orderedCategories = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    return categoryRailOrder.map((id) => map.get(id)).filter(Boolean);
  }, [categoryIdsKey, categoryRailOrder]);
  const railDateKey = safeData?.ui?.selectedDate || localDateKey();
  const railDow = useMemo(() => appDowFromDateKey(railDateKey), [railDateKey]);
  const plannedCategoryIds = useMemo(() => {
    if (!goals.length) return new Set();
    const ids = new Set();
    for (const g of goals) {
      if (resolveGoalType(g) !== "PROCESS") continue;
      if (g.status && g.status !== "active") continue;
      const days = Array.isArray(g?.schedule?.daysOfWeek) ? g.schedule.daysOfWeek : null;
      const plannedToday = !days || days.length === 0 ? true : days.includes(railDow);
      if (plannedToday && g.categoryId) ids.add(g.categoryId);
    }
    return ids;
  }, [goals, railDow]);
  const railCategories = useMemo(() => orderedCategories, [orderedCategories]);
  const librarySelectedCategoryId = safeData?.ui?.librarySelectedCategoryId || null;
  const libraryDetailExpandedId = safeData?.ui?.libraryDetailExpandedId || null;
  const homeActiveCategoryId =
    safeData?.ui?.selectedCategoryByView?.home || safeData?.ui?.selectedCategoryId || null;
  const homeSelectedCategoryId = getHomeSelectedCategoryId(safeData);
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
  const seedCreateDraft = ({ source, categoryId, outcomeId, step } = {}) => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (prevUi.createDraftWasCanceled) {
        return {
          ...prev,
          ui: {
            ...prevUi,
            createDraft: createEmptyDraft(),
            createDraftWasCanceled: true,
            createDraftWasCompleted: false,
          },
        };
      }
      const shouldReset = prevUi.createDraftWasCompleted;
      if (shouldReset) {
        return {
          ...prev,
          ui: {
            ...prevUi,
            createDraft: createEmptyDraft(),
            createDraftWasCanceled: false,
            createDraftWasCompleted: false,
          },
        };
      }
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const prevGoals = Array.isArray(prev.goals) ? prev.goals : [];
      let resolvedCategoryId = categoryId || null;
      if (!resolvedCategoryId) {
        if (source === "library") {
          resolvedCategoryId =
            prevUi?.selectedCategoryByView?.library ||
            prevUi?.librarySelectedCategoryId ||
            prevUi?.selectedCategoryByView?.home ||
            prevUi?.selectedCategoryId ||
            null;
        } else if (source === "pilotage") {
          resolvedCategoryId =
            prevUi?.selectedCategoryByView?.pilotage ||
            prevUi?.selectedCategoryByView?.home ||
            prevUi?.selectedCategoryId ||
            null;
        } else if (source === "today") {
          resolvedCategoryId = prevUi?.selectedCategoryByView?.home || prevUi?.selectedCategoryId || null;
        } else {
          resolvedCategoryId = prevUi?.selectedCategoryByView?.home || prevUi?.selectedCategoryId || null;
        }
      }
      if (resolvedCategoryId && !prevCategories.some((c) => c.id === resolvedCategoryId)) {
        resolvedCategoryId = null;
      }
      let resolvedOutcomeId = outcomeId || null;
      if (resolvedOutcomeId && !prevGoals.some((g) => g && g.id === resolvedOutcomeId)) {
        resolvedOutcomeId = null;
      }
      if (!resolvedOutcomeId && resolvedCategoryId) {
        const outcomeGoals = prevGoals.filter(
          (g) => g && g.categoryId === resolvedCategoryId && resolveGoalType(g) === "OUTCOME"
        );
        const mainGoalId = prevCategories.find((c) => c.id === resolvedCategoryId)?.mainGoalId || null;
        const fallbackOutcomeId = outcomeGoals[0]?.id || null;
        resolvedOutcomeId =
          mainGoalId && outcomeGoals.some((g) => g.id === mainGoalId) ? mainGoalId : fallbackOutcomeId;
      }
      const nextDraft = createEmptyDraft();
      if (resolvedCategoryId) nextDraft.category = { mode: "existing", id: resolvedCategoryId };
      if (resolvedOutcomeId) {
        nextDraft.outcomes = [{ mode: "existing", id: resolvedOutcomeId }];
        nextDraft.activeOutcomeId = resolvedOutcomeId;
      }
      if (isValidCreationStep(step)) nextDraft.step = step;
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: nextDraft,
          createDraftWasCanceled: shouldReset ? false : prevUi.createDraftWasCanceled,
          createDraftWasCompleted: false,
        },
      };
    });
  };
  const openLibraryDetail = () => {
    let touched = false;
    try {
      touched = sessionStorage.getItem("library:selectedCategoryTouched") === "1";
    } catch (_) {
      touched = false;
    }
    const libraryViewSelectedId = touched
      ? safeData?.ui?.selectedCategoryByView?.library || librarySelectedCategoryId || null
      : null;
    const hasLibrarySelection =
      libraryViewSelectedId && categories.some((c) => c.id === libraryViewSelectedId);
    const targetId = hasLibrarySelection ? libraryViewSelectedId : homeSelectedCategoryId;
    if (!targetId) {
      setLibraryCategoryId(null);
      setCategoryDetailId(null);
      setTab("library");
      return;
    }
    if (!hasLibrarySelection) {
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
            librarySelectedCategoryId: targetId,
            selectedCategoryByView: { ...prevSel, library: targetId },
            libraryDetailExpandedId: null,
          },
        };
      });
    }
    if (hasLibrarySelection) {
      setData((prev) => {
        const prevUi = prev.ui || {};
        if (!prevUi.libraryDetailExpandedId) return prev;
        return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: null } };
      });
    }
    setLibraryCategoryId(null);
    setCategoryDetailId(null);
    setTab("library");
  };
  useEffect(() => {
    if (tab !== "library") return;
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (!prevUi.libraryDetailExpandedId) return prev;
      return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: null } };
    });
  }, [tab, setData]);
  useEffect(() => {
    if (!isCreateTab) return;
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      let nextUi = prevUi;
      let nextDraft = prevUi.createDraft;
      let changed = false;
      if (prevUi.createDraftWasCompleted) {
        nextDraft = createEmptyDraft();
        nextUi = { ...nextUi, createDraftWasCompleted: false };
        changed = true;
      }
      if (prevUi.createDraftWasCanceled && tab !== "create") {
        nextUi = { ...nextUi, createDraftWasCanceled: false };
        changed = true;
      }
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
  const handleEditBack = () => {
    const returnTab = editItem?.returnTab || "library";
    if (returnTab === "library") {
      const nextId = editItem?.categoryId || libraryCategoryId || null;
      if (nextId) setLibraryCategoryId(nextId);
    }
    setEditItem(null);
    setTab(returnTab);
  };
  useEffect(() => {
    const prevTab = prevTabRef.current;
    if (prevTab !== "today" && tab === "today") {
      const today = localDateKey();
      setData((prev) => {
        const prevUi = prev.ui || {};
        if (prevUi.selectedDate === today) return prev;
        return { ...prev, ui: { ...prevUi, selectedDate: today } };
      });
    }
    if (prevTab !== "library" && tab === "library") {
      let touched = false;
      try {
        touched = sessionStorage.getItem("library:selectedCategoryTouched") === "1";
      } catch (_) {
        touched = false;
      }
      if (!touched) {
        const libraryId =
          safeData?.ui?.selectedCategoryByView?.library || safeData?.ui?.librarySelectedCategoryId || null;
        const hasHome =
          homeActiveCategoryId && categories.some((category) => category.id === homeActiveCategoryId);
        if (hasHome && homeActiveCategoryId !== libraryId) {
          setData((prev) => {
            const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
            if (!prevCategories.some((category) => category.id === homeActiveCategoryId)) return prev;
            const prevUi = prev.ui || {};
            const prevSel =
              prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
                ? prevUi.selectedCategoryByView
                : {};
            if (prevUi.librarySelectedCategoryId === homeActiveCategoryId && prevSel.library === homeActiveCategoryId) {
              return prev;
            }
            return {
              ...prev,
              ui: {
                ...prevUi,
                librarySelectedCategoryId: homeActiveCategoryId,
                selectedCategoryByView: { ...prevSel, library: homeActiveCategoryId },
              },
            };
          });
        }
      }
    }
    prevTabRef.current = tab;
  }, [
    tab,
    categories,
    homeActiveCategoryId,
    safeData?.ui?.selectedCategoryByView?.library,
    safeData?.ui?.librarySelectedCategoryId,
    setData,
  ]);
  const railSelectedId =
    tab === "category-detail"
      ? categoryDetailId
      : tab === "category-progress"
        ? categoryProgressId
        : tab === "pilotage"
          ? safeData?.ui?.selectedCategoryByView?.pilotage ||
            safeData?.ui?.selectedCategoryByView?.home ||
            safeData?.ui?.selectedCategoryId ||
            null
          : tab === "library" ||
              tab === "create" ||
              tab === "create-category" ||
              tab === "create-goal" ||
              tab === "create-habit" ||
              tab === "create-rhythm" ||
              tab === "create-review" ||
              tab === "edit-item"
            ? safeData?.ui?.selectedCategoryByView?.library ||
              librarySelectedCategoryId ||
              safeData?.ui?.selectedCategoryByView?.home ||
              safeData?.ui?.selectedCategoryId ||
              null
            : safeData?.ui?.selectedCategoryByView?.home || safeData?.ui?.selectedCategoryId || null;
  const detailCategoryId =
    categoryDetailId ||
    safeData?.ui?.selectedCategoryByView?.home ||
    safeData?.ui?.selectedCategoryId ||
    safeData?.categories?.[0]?.id ||
    null;

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
    if (typeof window === "undefined") return;
    if (tab !== "category-detail") return;
    const nextPath = categoryDetailId ? `/category/${categoryDetailId}` : "/category";
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
  }, [tab, categoryDetailId]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tab !== "pilotage") return;
    if (window.location.pathname === "/tools") {
      window.history.replaceState({}, "", "/pilotage");
    }
  }, [tab]);
  useEffect(() => {
    // Do not restore tab during onboarding flows.
    const completed = Boolean(safeData?.ui?.onboardingCompleted);
    if (!completed) return;
    if (
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/session") || window.location.pathname.startsWith("/category"))
    )
      return;
    const last = normalizeTab(safeData?.ui?.lastTab);
    // keep current if already valid
    _setTab((cur) => (normalizeTab(cur) === last ? cur : last));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onboarded = isOnboarded(safeData);
  const onboardingCompleted = Boolean(safeData.ui?.onboardingCompleted);
  const showPlanStep = Boolean(safeData.ui?.showPlanStep);
  const shouldShowEmpty = !onboarded && !showPlanStep && tab === "today";
  const showTourOverlay = onboardingCompleted;
  const handlePlanCategory = (categoryId) => {
    const fallbackId = categories[0]?.id || null;
    const targetId = categoryId || fallbackId;
    if (!targetId) {
      setLibraryCategoryId(null);
      setTab("create-category");
      return;
    }
    const counts = getCategoryCounts(safeData, targetId);
    const outcomeGoals = goals.filter(
      (g) => g && g.categoryId === targetId && resolveGoalType(g) === "OUTCOME"
    );
    const mainGoalId = categories.find((c) => c.id === targetId)?.mainGoalId || null;
    const fallbackGoalId = outcomeGoals[0]?.id || null;
    const goalId =
      mainGoalId && outcomeGoals.some((g) => g.id === mainGoalId) ? mainGoalId : fallbackGoalId;

    setData((prev) => ({
      ...prev,
      ui: {
        ...(prev.ui || {}),
        librarySelectedCategoryId: targetId,
        selectedCategoryByView: { ...(prev.ui?.selectedCategoryByView || {}), library: targetId },
      },
    }));

    seedCreateDraft({
      source: "pilotage",
      categoryId: targetId,
      outcomeId: goalId,
      step: goalId ? STEP_HABITS : STEP_OUTCOME,
    });
    setLibraryCategoryId(null);
    if (counts.outcomesCount === 0 || !goalId) {
      setTab("create");
      return;
    }
    setTab("create");
  };

  if (showPlanStep && onboardingCompleted) {
    return (
      <>
        <Onboarding data={data} setData={setData} onDone={() => setTab("settings")} planOnly />
        <DiagnosticOverlay data={safeData} tab={tab} />
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
  if (shouldShowEmpty) {
    const empty = getEmptyStateConfig(safeData);
    return (
      <>
        <ScreenShell
          data={safeData}
          pageId="home"
          headerTitle="Aujourd’hui"
          headerSubtitle={empty.title}
          backgroundImage={safeData?.profile?.whyImage || ""}
        >
          <Card accentBorder>
            <div className="p18">
              <div className="titleSm">{empty.title}</div>
              <div className="small" style={{ marginTop: 6 }}>
                {empty.subtitle}
              </div>
              <div className="mt12">
                <Button
                  onClick={() => {
                    const step =
                      empty.targetTab === "create-category"
                        ? STEP_CATEGORY
                        : empty.targetTab === "create-goal"
                          ? STEP_OUTCOME
                          : empty.targetTab === "create-habit"
                            ? STEP_HABITS
                            : null;
                    setData((prev) => {
                      const nextUi = { ...(prev.ui || {}), openGoalEditId: null };
                      if (empty.categoryId) nextUi.selectedCategoryId = empty.categoryId;
                      return { ...prev, ui: nextUi };
                    });
                    if (empty.targetTab.startsWith("create")) {
                      seedCreateDraft({ source: "empty", categoryId: empty.categoryId, step });
                      setTab("create");
                      return;
                    }
                    setTab(empty.targetTab);
                  }}
                >
                  {empty.cta}
                </Button>
              </div>
            </div>
          </Card>
        </ScreenShell>
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
      </>
    );
  }

  return (
    <>
        <TopNav
        active={
          tab === "session"
            ? "today"
            : tab === "library" ||
                tab === "create" ||
                tab === "create-category" ||
                tab === "create-goal" ||
                tab === "create-habit" ||
                tab === "create-rhythm" ||
                tab === "create-review" ||
                tab === "edit-item" ||
                tab === "category-detail" ||
                tab === "category-progress"
              ? "library"
              : tab === "pilotage"
                ? "pilotage"
                : tab === "settings"
                  ? "settings"
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
        onCreateCategory={
          tab === "pilotage"
            ? null
            : () => {
                setLibraryCategoryId(null);
                seedCreateDraft({ source: "topnav", step: STEP_CATEGORY });
                setTab("create");
              }
        }
        categories={
          tab === "create" ||
          tab === "create-category" ||
          tab === "create-goal" ||
          tab === "create-habit" ||
          tab === "create-rhythm" ||
          tab === "create-review"
            ? []
            : railCategories
        }
        selectedCategoryId={railSelectedId}
          onSelectCategory={(categoryId) => {
          if (!categoryId) return;
          const markLibraryTouched = () => {
            try {
              sessionStorage.setItem("library:selectedCategoryTouched", "1");
            } catch (_) {}
          };
          const syncCategorySelection = ({ updateLegacy } = {}) => {
            const shouldUpdateLegacy = Boolean(updateLegacy);
            setData((prev) => {
              const prevUi = prev.ui || {};
              const prevSel =
                prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
                  ? prevUi.selectedCategoryByView
                  : {};
              if (
                prevUi.librarySelectedCategoryId === categoryId &&
                prevSel.library === categoryId &&
                prevSel.home === categoryId &&
                (!shouldUpdateLegacy || prevUi.selectedCategoryId === categoryId)
              ) {
                return prev;
              }
              return {
                ...prev,
                ui: {
                  ...prevUi,
                  librarySelectedCategoryId: categoryId,
                  selectedCategoryByView: { ...prevSel, library: categoryId, home: categoryId },
                  ...(shouldUpdateLegacy ? { selectedCategoryId: categoryId } : {}),
                },
              };
            });
          };
          if (tab === "today") {
            syncCategorySelection({ updateLegacy: true });
            setCategoryDetailId(categoryId);
            return;
          }
          if (tab === "library") {
            markLibraryTouched();
            syncCategorySelection();
            if (libraryCategoryId) {
              setLibraryCategoryId(categoryId);
              return;
            }
            setData((prev) => {
              const prevUi = prev.ui || {};
              const prevSel =
                prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
                  ? prevUi.selectedCategoryByView
                  : {};
              const isExpanded = prevUi.libraryDetailExpandedId === categoryId;
              return {
                ...prev,
                ui: {
                  ...prevUi,
                  librarySelectedCategoryId: categoryId,
                  selectedCategoryByView: { ...prevSel, library: categoryId },
                  libraryDetailExpandedId: isExpanded ? null : categoryId,
                },
              };
            });
            setLibraryCategoryId(null);
            setCategoryDetailId(null);
            setTab("library");
            return;
          }
          if (tab === "category-detail") {
            markLibraryTouched();
            syncCategorySelection();
            setLibraryCategoryId(null);
            setCategoryDetailId(null);
            setTab("library");
            return;
          }
          if (tab === "category-progress") {
            markLibraryTouched();
            syncCategorySelection();
            setLibraryCategoryId(null);
            setCategoryProgressId(categoryId);
            setTab("category-progress", { categoryProgressId: categoryId });
            return;
          }
          if (tab === "edit-item") {
            markLibraryTouched();
            syncCategorySelection();
            return;
          }
          if (tab === "pilotage") {
            setData((prev) => ({
              ...prev,
              ui: {
                ...(prev.ui || {}),
                selectedCategoryByView: { ...(prev.ui?.selectedCategoryByView || {}), pilotage: categoryId },
              },
            }));
            return;
          }
          if (tab === "session") {
            setSessionCategoryId(categoryId);
          }
        }}
      />

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
          onOpenCreate={() => {
            setLibraryCategoryId(null);
            seedCreateDraft({ source: "today", categoryId: homeSelectedCategoryId });
            setTab("create");
          }}
          onOpenCreateCategory={() => {
            setLibraryCategoryId(null);
            seedCreateDraft({ source: "today", step: STEP_CATEGORY });
            setTab("create");
          }}
          onOpenSession={({ categoryId, dateKey }) =>
            setTab("session", { sessionCategoryId: categoryId || null, sessionDateKey: dateKey || null })
          }
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
        <Pilotage data={data} setData={setData} onPlanCategory={handlePlanCategory} />
      ) : tab === "edit-item" ? (
        <EditItem data={data} setData={setData} editItem={editItem} onBack={handleEditBack} />
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
          onOpenCreate={() => {
            setLibraryCategoryId(null);
            seedCreateDraft({ source: "library", categoryId: libraryCategoryId });
            setTab("create");
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
          onOpenCreate={() => {
            setLibraryCategoryId(null);
            seedCreateDraft({ source: "library" });
            setTab("create");
          }}
          onOpenManage={(categoryId) => {
            if (!categoryId) return;
            setLibraryCategoryId(categoryId);
            setTab("library");
          }}
        />
      ) : tab === "create" ? (
        <CreateV2
          data={data}
          onBack={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
          onOpenStep={(step) => {
            if (step === "category") setTab("create-category");
            else if (step === "outcome") setTab("create-goal");
            else if (step === "habits") setTab("create-habit");
            else if (step === "rhythm") setTab("create-rhythm");
            else if (step === "review") setTab("create-review");
          }}
        />
      ) : tab === "create-category" ? (
        <CreateV2Category
          data={data}
          setData={setData}
          onBack={() => setTab("create")}
          onCancel={() => {
            resetCreateDraft();
            setTab("library");
          }}
          onNext={() => setTab("create-goal")}
        />
      ) : tab === "create-goal" ? (
        <CreateV2Outcome
          data={data}
          setData={setData}
          onBack={() => setTab("create-category")}
          onCancel={() => {
            resetCreateDraft();
            setTab("library");
          }}
          onNext={() => setTab("create-habit")}
        />
      ) : tab === "create-habit" ? (
        <CreateV2Habits
          data={data}
          setData={setData}
          onBack={() => setTab("create-goal")}
          onCancel={() => {
            resetCreateDraft();
            setTab("library");
          }}
          onNext={() => setTab("create-rhythm")}
        />
      ) : tab === "create-rhythm" ? (
        <CreateV2Rhythm
          data={data}
          setData={setData}
          onBack={() => setTab("create-habit")}
          onCancel={() => {
            resetCreateDraft();
            setTab("library");
          }}
          onNext={() => setTab("create-review")}
        />
      ) : tab === "create-review" ? (
        <CreateV2Review
          data={data}
          setData={setData}
          onBack={() => setTab("create-rhythm")}
          onCancel={() => {
            resetCreateDraft();
            setTab("library");
          }}
          onDone={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
        />
      ) : tab === "session" ? (
        <Session
          data={data}
          setData={setData}
          categoryId={sessionCategoryId}
          dateKey={sessionDateKey}
          onBack={() => {
            setLibraryCategoryId(null);
            setTab("today");
          }}
          onOpenLibrary={() => {
            openLibraryDetail();
          }}
        />
      ) : (
        <Settings data={data} setData={setData} />
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
                      setData((prev) =>
                        startSession(
                          prev,
                          target.id,
                          todayLocalKey(),
                          typeof target.parentId === "string" ? target.parentId : null,
                          Number.isFinite(target.sessionMinutes) ? target.sessionMinutes : null
                        )
                      );
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
    </>
  );
}
