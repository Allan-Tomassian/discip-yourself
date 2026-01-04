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
import Create from "./pages/Create";
import CreateCategory from "./pages/CreateCategory";
import CreateGoal from "./pages/CreateGoal";
import CreateHabit from "./pages/CreateHabit";
import Settings from "./pages/Settings";
import CategoryDetail from "./pages/CategoryDetail";
import CategoryView from "./pages/CategoryView";
import CategoryDetailView from "./pages/CategoryDetailView";
import CategoryProgress from "./pages/CategoryProgress";
import Session from "./pages/Session";
import { applyThemeTokens, getThemeName } from "./theme/themeTokens";
import { todayKey } from "./utils/dates";
import { normalizePriorities } from "./logic/priority";

function runSelfTests() {
  // minimal sanity
  console.assert(typeof window !== "undefined", "browser env");
}

function resolveGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  if (raw === "STATE") return "OUTCOME";
  if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
  const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
  if (legacy === "OUTCOME") return "OUTCOME";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  return "PROCESS";
}

function parseLocalDateKey(key) {
  if (typeof key !== "string") return new Date();
  const [y, m, d] = key.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
}

function appDowFromDateKey(key) {
  const d = parseLocalDateKey(key);
  const js = d.getDay(); // 0..6 (Sun..Sat)
  return js === 0 ? 7 : js; // 1..7 (Mon..Sun)
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
      title: "Aucune habitude",
      subtitle: "Crée une habitude liée à ton objectif principal.",
      cta: "Créer une habitude",
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
  "plan",
  "create",
  "create-category",
  "create-goal",
  "create-habit",
  "session",
  "category-progress",
  "category-detail",
  "settings",
]);
function normalizeTab(t) {
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
  const initialTab = initialPath.startsWith("/session")
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
  const [createFlowCategoryId, setCreateFlowCategoryId] = useState(null);
  const [createFlowGoalId, setCreateFlowGoalId] = useState(null);
  const dataRef = useRef(data);
  const lastReminderRef = useRef({});
  const activeReminderRef = useRef(activeReminder);

  const setTab = (next, opts = {}) => {
    const t = normalizeTab(next);
    const nextSessionCategoryId =
      typeof opts.sessionCategoryId === "string" ? opts.sessionCategoryId : sessionCategoryId;
    const nextSessionDateKey =
      typeof opts.sessionDateKey === "string" ? opts.sessionDateKey : sessionDateKey;
    const nextCategoryProgressId =
      typeof opts.categoryProgressId === "string" ? opts.categoryProgressId : categoryProgressId;
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
            ? categoryDetailId
              ? `/category/${categoryDetailId}`
              : "/category"
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

  useEffect(() => {
    if (tab === "create-category" || tab === "create-goal" || tab === "create-habit") return;
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
      if (activeReminderRef.current) return;
      const current = dataRef.current;
      const due = getDueReminders(current, new Date(), lastReminderRef.current);
      if (!due.length) return;
      const reminder = due[0];
      const goal = (current.goals || []).find((g) => g.id === reminder.goalId) || null;
      const habit = !goal ? (current.habits || []).find((h) => h.id === reminder.goalId) || null : null;
      const soundEnabled = Boolean(current?.ui?.soundEnabled);
      setActiveReminder({ reminder, goal, habit });
      if (soundEnabled) playReminderSound();
      if ((reminder.channel || "IN_APP") === "NOTIFICATION") {
        sendReminderNotification(reminder, goal?.title || habit?.title || "");
      }
    }, 30000);
    return () => clearInterval(id);
  }, [setData]);


  const safeData = data && typeof data === "object" ? data : {};
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
  const railDateKey = safeData?.ui?.selectedDate || todayKey(new Date());
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
  const railCategories = useMemo(() => {
    return orderedCategories.filter((c) => plannedCategoryIds.has(c.id));
  }, [orderedCategories, plannedCategoryIds]);
  const librarySelectedCategoryId = safeData?.ui?.librarySelectedCategoryId || null;
  const railSelectedId =
    tab === "category-detail"
      ? categoryDetailId
      : tab === "category-progress"
        ? categoryProgressId
        : tab === "library" ||
            tab === "create" ||
            tab === "create-category" ||
            tab === "create-goal" ||
            tab === "create-habit"
          ? librarySelectedCategoryId ||
            safeData?.ui?.selectedCategoryByView?.home ||
            safeData?.ui?.selectedCategoryId ||
            null
          : tab === "plan"
            ? safeData?.ui?.selectedCategoryByView?.plan ||
              safeData?.ui?.selectedCategoryId ||
              safeData?.ui?.selectedCategoryByView?.home ||
              null
            : safeData?.ui?.selectedCategoryByView?.home || safeData?.ui?.selectedCategoryId || null;

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

  if (showPlanStep && onboardingCompleted) {
    return <Onboarding data={data} setData={setData} onDone={() => setTab("settings")} planOnly />;
  }
  if (!onboardingCompleted) {
    return <Onboarding data={data} setData={setData} onDone={() => setTab("today")} />;
  }
  if (shouldShowEmpty) {
    const empty = getEmptyStateConfig(safeData);
    return (
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
                  setData((prev) => {
                    const nextUi = { ...(prev.ui || {}), openGoalEditId: null };
                    if (empty.categoryId) nextUi.selectedCategoryId = empty.categoryId;
                    return { ...prev, ui: nextUi };
                  });
                  setTab(empty.targetTab);
                }}
              >
                {empty.cta}
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
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
                tab === "category-detail" ||
                tab === "category-progress"
              ? "library"
              : tab === "plan"
                ? "plan"
                : tab === "settings"
                  ? "settings"
                  : tab
        }
        setActive={(next) => {
          if (next === "library") setLibraryCategoryId(null);
          setTab(next);
        }}
        onOpenSettings={() => setTab("settings")}
        onCreateCategory={() => {
          setLibraryCategoryId(null);
          setTab("create-category");
        }}
        categories={
          tab === "create" ||
          tab === "create-category" ||
          tab === "create-goal" ||
          tab === "create-habit"
            ? []
            : railCategories
        }
        selectedCategoryId={railSelectedId}
        onSelectCategory={(categoryId) => {
          if (!categoryId) return;
          if (tab === "today") {
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
                  selectedCategoryId: categoryId,
                  selectedCategoryByView: { ...prevSel, home: categoryId },
                },
              };
            });
            return;
          }
          if (tab === "library") {
            setData((prev) => ({
              ...prev,
              ui: { ...(prev.ui || {}), librarySelectedCategoryId: categoryId },
            }));
            return;
          }
          if (tab === "plan") {
            setData((prev) => {
              const prevUi = prev.ui || {};
              const prevSel =
                prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
                  ? prevUi.selectedCategoryByView
                  : {};
              return {
                ...prev,
                ui: { ...prevUi, selectedCategoryByView: { ...prevSel, plan: categoryId } },
              };
            });
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
            setLibraryCategoryId(null);
            setTab("library");
          }}
          onOpenCreate={() => {
            setLibraryCategoryId(null);
            setTab("create");
          }}
          onOpenCreateCategory={() => {
            setLibraryCategoryId(null);
            setTab("create-category");
          }}
          onOpenSession={({ categoryId, dateKey }) =>
            setTab("session", { sessionCategoryId: categoryId || null, sessionDateKey: dateKey || null })
          }
        />
      ) : tab === "category-detail" ? (
        <CategoryDetailView
          data={data}
          categoryId={
            categoryDetailId ||
            data?.ui?.selectedCategoryByView?.home ||
            data?.ui?.selectedCategoryId ||
            data?.categories?.[0]?.id ||
            null
          }
          onBack={() => {
            setCategoryDetailId(null);
            setTab("today");
          }}
          onOpenLibrary={() => {
            setCategoryDetailId(null);
            setLibraryCategoryId(null);
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
      ) : tab === "plan" ? (
        <CategoryDetail
          data={data}
          setData={setData}
          categoryId={
            data?.ui?.selectedCategoryByView?.plan ||
            data?.ui?.selectedCategoryId ||
            data?.categories?.[0]?.id ||
            null
          }
          onBack={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
          initialEditGoalId={data?.ui?.openGoalEditId || null}
          onSelectCategory={(nextId) => {
            setData((prev) => {
              const prevUi = prev.ui || {};
              const prevSel =
                prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
                  ? prevUi.selectedCategoryByView
                  : {};
              return {
                ...prev,
                ui: { ...prevUi, selectedCategoryByView: { ...prevSel, plan: nextId } },
              };
            });
          }}
        />
      ) : tab === "library" && libraryCategoryId ? (
        <CategoryView
          data={data}
          setData={setData}
          categoryId={libraryCategoryId}
          onBack={() => setLibraryCategoryId(null)}
          onOpenPlan={() => {
            setLibraryCategoryId(null);
            setTab("plan");
          }}
          onOpenCreate={() => {
            setLibraryCategoryId(null);
            setTab("create");
          }}
          onOpenProgress={(categoryIdValue) => {
            if (!categoryIdValue) return;
            setCategoryProgressId(categoryIdValue);
            setTab("category-progress", { categoryProgressId: categoryIdValue });
          }}
        />
      ) : tab === "library" ? (
        <Categories
          data={data}
          setData={setData}
          onOpenLibraryCategory={(categoryId) => {
            setLibraryCategoryId(categoryId);
            setTab("library");
          }}
          onOpenCreate={() => {
            setLibraryCategoryId(null);
            setTab("create");
          }}
        />
      ) : tab === "create" ? (
        <Create
          data={data}
          onBack={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
          onOpenCategory={() => setTab("create-category")}
          onOpenGoal={() => setTab("create-goal")}
          onOpenHabit={() => setTab("create-habit")}
        />
      ) : tab === "create-category" ? (
        <CreateCategory
          data={data}
          setData={setData}
          onCancel={() => setTab("create")}
          onDone={({ categoryId }) => {
            setCreateFlowCategoryId(categoryId || null);
            setCreateFlowGoalId(null);
            setTab("create-goal");
          }}
        />
      ) : tab === "create-goal" ? (
        <CreateGoal
          data={data}
          setData={setData}
          initialCategoryId={createFlowCategoryId}
          onCancel={() => {
            if (createFlowCategoryId) {
              setCreateFlowGoalId(null);
              setTab("create-category");
              return;
            }
            setTab("create");
          }}
          onDone={({ goalId, categoryId }) => {
            setCreateFlowCategoryId(categoryId || createFlowCategoryId || null);
            setCreateFlowGoalId(goalId || null);
            setTab("create-habit");
          }}
        />
      ) : tab === "create-habit" ? (
        <CreateHabit
          data={data}
          setData={setData}
          initialCategoryId={createFlowCategoryId}
          initialGoalId={createFlowGoalId}
          onCancel={() => {
            if (createFlowGoalId) {
              setTab("create-goal");
              return;
            }
            setTab("create");
          }}
          onDone={() => {
            setCreateFlowCategoryId(null);
            setCreateFlowGoalId(null);
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
            setLibraryCategoryId(null);
            setTab("library");
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
                {activeReminder.goal?.title || activeReminder.habit?.title || "Habitude"}
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
                          todayKey(),
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
                      setTab("plan");
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
    </>
  );
}
