import React, { useEffect, useRef, useState } from "react";
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
import Session from "./pages/Session";
import { applyThemeTokens, getThemeName } from "./theme/themeTokens";
import { todayKey } from "./utils/dates";

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
  "settings",
]);
function normalizeTab(t) {
  return TABS.has(t) ? t : "today";
}

export default function App() {
  const [data, setData] = usePersistedState(React);
  const initialTab =
    typeof window !== "undefined" && window.location.pathname.startsWith("/session") ? "session" : "today";
  const [tab, _setTab] = useState(initialTab);
  const [libraryCategoryId, setLibraryCategoryId] = useState(null);
  const [activeReminder, setActiveReminder] = useState(null);
  const dataRef = useRef(data);
  const lastReminderRef = useRef({});
  const activeReminderRef = useRef(activeReminder);

  const setTab = (next) => {
    const t = normalizeTab(next);
    _setTab(t);
    // persist last tab for better UX (non-blocking)
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), lastTab: t },
    }));
    if (typeof window !== "undefined") {
      const nextPath = t === "session" ? "/session" : "/";
      if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
    }
  };

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    activeReminderRef.current = activeReminder;
  }, [activeReminder]);

  useEffect(() => {
    runSelfTests();
    setData((prev) => migrate(prev));
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

  useEffect(() => {
    applyThemeTokens(themeName);
  }, [themeName]);
  useEffect(() => {
    // Do not restore tab during onboarding flows.
    const completed = Boolean(safeData?.ui?.onboardingCompleted);
    if (!completed) return;
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/session")) return;
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
          onOpenSession={() => setTab("session")}
        />
      ) : tab === "plan" ? (
        <CategoryDetail
          data={data}
          setData={setData}
          categoryId={data?.ui?.selectedCategoryId || data?.categories?.[0]?.id || null}
          onBack={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
          initialEditGoalId={data?.ui?.openGoalEditId || null}
          onSelectCategory={(nextId) => {
            setData((prev) => ({ ...prev, ui: { ...(prev.ui || {}), selectedCategoryId: nextId } }));
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
          onDone={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
        />
      ) : tab === "create-goal" ? (
        <CreateGoal
          data={data}
          setData={setData}
          onCancel={() => setTab("create")}
          onDone={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
        />
      ) : tab === "create-habit" ? (
        <CreateHabit
          data={data}
          setData={setData}
          onCancel={() => setTab("create")}
          onDone={() => {
            setLibraryCategoryId(null);
            setTab("library");
          }}
        />
      ) : tab === "session" ? (
        <Session
          data={data}
          setData={setData}
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

      <TopNav
        active={tab}
        setActive={(next) => {
          if (next === "library") setLibraryCategoryId(null);
          setTab(next);
        }}
        onOpenSettings={() => setTab("settings")}
      />

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
