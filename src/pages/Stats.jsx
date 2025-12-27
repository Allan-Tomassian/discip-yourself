import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Badge, Card, ProgressRing } from "../components/UI";
import { clamp } from "../utils/helpers";
import { computeHabitProgress } from "../logic/habits";
import { todayKey, startOfWeekKey } from "../utils/dates";

export default function Stats({ data }) {
  if (!data.categories || data.categories.length === 0) {
    return (
      <ScreenShell
        data={data}
        pageId="stats"
        headerTitle="Stats"
        headerSubtitle="Aucune catégorie"
        backgroundImage={data?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie dans l’onglet Catégories pour commencer.
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const selected = data.categories.find((c) => c.id === data.ui.selectedCategoryId) || data.categories[0];
  const now = new Date();

  const dailyAvg = useMemo(() => {
    const list = data.habits.filter((h) => h.cadence === "DAILY");
    if (!list.length) return 0;
    let s = 0;
    for (const h of list) s += clamp(computeHabitProgress(h, data.checks, now).ratio, 0, 1);
    return s / list.length;
  }, [data.habits, data.checks]);

  const weeklyAvg = useMemo(() => {
    const list = data.habits.filter((h) => h.cadence === "WEEKLY");
    if (!list.length) return 0;
    let s = 0;
    for (const h of list) s += clamp(computeHabitProgress(h, data.checks, now).ratio, 0, 1);
    return s / list.length;
  }, [data.habits, data.checks]);

  return (
    <ScreenShell
      data={data}
      pageId="stats"
      headerTitle="Stats"
      headerSubtitle={`Semaine: ${startOfWeekKey(now)} · Jour: ${todayKey(now)}`}
      backgroundImage={selected.wallpaper || data.profile.whyImage || ""}
    >
      <div className="grid2">
        <Card accentBorder>
          <div className="p18">
            <div className="small">Quotidien</div>
            <div className="mt12 row">
              <div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(dailyAvg * 100)}%</div>
              <ProgressRing value={dailyAvg} />
            </div>
            <div className="small2">Moyenne des habitudes DAILY</div>
          </div>
        </Card>

        <Card accentBorder>
          <div className="p18">
            <div className="small">Hebdomadaire</div>
            <div className="mt12 row">
              <div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(weeklyAvg * 100)}%</div>
              <ProgressRing value={weeklyAvg} />
            </div>
            <div className="small2">Moyenne des habitudes WEEKLY</div>
          </div>
        </Card>
      </div>

      <Card accentBorder style={{ marginTop: 14 }}>
        <div className="p18">
          <div className="row">
            <div>
              <div style={{ fontWeight: 900 }}>Niveau</div>
              <div className="small2">XP en temps réel</div>
            </div>
            <Badge>N{data.profile.level} · XP {data.profile.xp}</Badge>
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
}
