import React, { useEffect, useState } from "react";
import TopNav from "./components/TopNav";
import { migrate, usePersistedState } from "./logic/state";
import { autoActivateScheduledGoals } from "./logic/goals";

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

  useEffect(() => {
    runSelfTests();
    setData((prev) => migrate(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => autoActivateScheduledGoals(prev, new Date()));
    }, 60000);
    return () => clearInterval(id);
  }, [setData]);

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
    </>
  );
}
