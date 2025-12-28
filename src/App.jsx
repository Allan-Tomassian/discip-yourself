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
import WhyPage from "./pages/WhyPage";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";

function runSelfTests() {
  // minimal sanity
  console.assert(typeof window !== "undefined", "browser env");
}

export default function App() {
  const [data, setData] = usePersistedState(React);
  const [tab, setTab] = useState("home");
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
    if (data?.ui?.openCategoryDetailId) {
      setTab("categories");
    }
  }, [data?.ui?.openCategoryDetailId]);

  const onboarded = Boolean((data?.profile?.whyText || "").trim());

  if (!onboarded) {
    return <Onboarding data={data} setData={setData} onDone={() => setTab("home")} />;
  }

  return (
    <>
      {tab === "home" ? (
        <Home data={data} setData={setData} />
      ) : tab === "categories" ? (
        <Categories data={data} setData={setData} />
      ) : tab === "why" ? (
        <WhyPage data={data} setData={setData} />
      ) : tab === "stats" ? (
        <Stats data={data} />
      ) : (
        <Settings data={data} setData={setData} />
      )}

      <TopNav active={tab} setActive={setTab} />

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
