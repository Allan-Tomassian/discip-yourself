import React, { useEffect, useRef, useState } from "react";
import TopNav from "./components/TopNav";
import { migrate, usePersistedState } from "./logic/state";
import { autoActivateScheduledGoals } from "./logic/goals";
import { getDueReminders, playReminderSound, sendReminderNotification } from "./logic/reminders";
import { Button, Card } from "./components/UI";
import { markIOSRootClass } from "./utils/dialogs";

import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Categories from "./pages/Categories";
import Settings from "./pages/Settings";
import CategoryDetail from "./pages/CategoryDetail";

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

export default function App() {
  const [data, setData] = usePersistedState(React);
  const [tab, setTab] = useState("today");
  const [activeReminder, setActiveReminder] = useState(null);
  const dataRef = useRef(data);
  const lastReminderRef = useRef({});
  const activeReminderRef = useRef(activeReminder);

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
      setActiveReminder({ reminder, goal, habit });
      playReminderSound();
      if ((reminder.channel || "IN_APP") === "NOTIFICATION") {
        sendReminderNotification(reminder, goal?.title || habit?.title || "");
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!data?.ui?.openCategoryDetailId) return;
    setTab("plan");
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), openCategoryDetailId: null },
    }));
  }, [data?.ui?.openCategoryDetailId, setData]);

  const onboarded = isOnboarded(data);

  if (!onboarded) {
    return <Onboarding data={data} setData={setData} onDone={() => setTab("today")} />;
  }

  return (
    <>
      {tab === "today" ? (
        <Home data={data} setData={setData} onOpenLibrary={() => setTab("library")} onOpenPlan={() => setTab("plan")} />
      ) : tab === "plan" ? (
        <CategoryDetail
          data={data}
          setData={setData}
          categoryId={data?.ui?.selectedCategoryId}
          onBack={() => setTab("library")}
          initialEditGoalId={data?.ui?.openGoalEditId || null}
          onSelectCategory={(nextId) => {
            setData((prev) => ({ ...prev, ui: { ...(prev.ui || {}), selectedCategoryId: nextId } }));
          }}
        />
      ) : tab === "library" ? (
        <Categories
          data={data}
          setData={setData}
          onOpenPlan={(categoryId) => {
            setData((prev) => ({
              ...prev,
              ui: { ...(prev.ui || {}), selectedCategoryId: categoryId, openCategoryDetailId: categoryId },
            }));
          }}
        />
      ) : (
        <Settings data={data} setData={setData} />
      )}

      <TopNav
        active={tab}
        setActive={(next) => setTab(next)}
        onOpenSettings={() => setTab("settings")}
      />

      {activeReminder ? (
        <div className="modalBackdrop">
          <Card accentBorder style={{ maxWidth: 420, width: "100%" }}>
            <div className="p18">
              <div className="titleSm">{activeReminder.reminder?.label || "Rappel"}</div>
              <div className="small2" style={{ marginTop: 6 }}>
                {activeReminder.goal
                  ? `Objectif: ${activeReminder.goal.title || "Objectif"}`
                  : activeReminder.habit
                    ? `Habitude: ${activeReminder.habit.title || "Habitude"}`
                    : "Ouvre l’app pour continuer."}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <Button variant="ghost" onClick={() => setActiveReminder(null)}>
                  OK
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
