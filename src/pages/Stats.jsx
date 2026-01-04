import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Badge, Card, ProgressRing } from "../components/UI";
import { clamp } from "../utils/helpers";
import { computeHabitProgress, getHabitList } from "../logic/habits";
import { todayKey, startOfWeekKey } from "../utils/dates";

export default function Stats({ data }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const habits = getHabitList(safeData);
  const checks = safeData.checks && typeof safeData.checks === "object" ? safeData.checks : {};

  if (categories.length === 0) {
    return (
      <ScreenShell
        data={safeData}
        pageId="stats"
        headerTitle="Statistiques"
        headerSubtitle="Aucune catégorie"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie dans l’onglet Bibliothèque pour commencer.
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const selected = categories.find((c) => c.id === safeData.ui?.selectedCategoryId) || categories[0];
  const now = new Date();

  const dailyAvg = useMemo(() => {
    const list = habits.filter((h) => h.cadence === "DAILY");
    if (!list.length) return 0;
    let s = 0;
    for (const h of list) s += clamp(computeHabitProgress(h, checks, now).ratio, 0, 1);
    return s / list.length;
  }, [habits, checks]);

  const weeklyAvg = useMemo(() => {
    const list = habits.filter((h) => h.cadence === "WEEKLY");
    if (!list.length) return 0;
    let s = 0;
    for (const h of list) s += clamp(computeHabitProgress(h, checks, now).ratio, 0, 1);
    return s / list.length;
  }, [habits, checks]);

  return (
    <ScreenShell
      data={safeData}
      pageId="stats"
      headerTitle="Statistiques"
      headerSubtitle={`Semaine: ${startOfWeekKey(now)} · Jour: ${todayKey(now)}`}
      backgroundImage={selected?.wallpaper || safeData.profile?.whyImage || ""}
    >
      <div className="grid2">
        <Card accentBorder>
          <div className="p18">
            <div className="small">Quotidien</div>
            <div className="mt12 row">
              <div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(dailyAvg * 100)}%</div>
              <ProgressRing value={dailyAvg} />
            </div>
            <div className="small2">Moyenne des habitudes quotidiennes</div>
          </div>
        </Card>

        <Card accentBorder>
          <div className="p18">
            <div className="small">Hebdomadaire</div>
            <div className="mt12 row">
              <div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round(weeklyAvg * 100)}%</div>
              <ProgressRing value={weeklyAvg} />
            </div>
            <div className="small2">Moyenne des habitudes hebdomadaires</div>
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
            <Badge>N{safeData.profile?.level || 0} · XP {safeData.profile?.xp || 0}</Badge>
            </div>
          </div>
        </Card>
      </ScreenShell>
  );
}
