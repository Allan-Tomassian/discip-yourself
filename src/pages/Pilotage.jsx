import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { todayKey } from "../utils/dates";
import {
  getCategoryCounts,
  getCategoryStatus,
  getDisciplineSummary,
  getLoadSummary,
} from "../logic/pilotage";

// TOUR MAP:
// - primary_action: planifier depuis l'état des catégories
// - key_elements: category status list, load summary, discipline summary
// - optional_elements: empty-today planifier CTA
const STATUS_LABELS = {
  EMPTY: "Vide",
  DONE: "Terminee",
  ACTIVE: "Active",
};

export default function Pilotage({ data, onPlanCategory }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const now = new Date();
  const dayKey = todayKey(now);

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      map.set(c.id, getCategoryCounts(safeData, c.id));
    }
    return map;
  }, [categories, safeData]);

  const statusByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      map.set(c.id, getCategoryStatus(safeData, c.id, now));
    }
    return map;
  }, [categories, safeData, dayKey]);

  const loadSummary = useMemo(() => getLoadSummary(safeData, now), [safeData, dayKey]);
  const disciplineSummary = useMemo(() => getDisciplineSummary(safeData, now), [safeData, dayKey]);

  return (
    <ScreenShell
      headerTitle={<span className="textAccent" data-tour-id="pilotage-title">Pilotage</span>}
      headerSubtitle="Vue d'ensemble"
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="stack stackGap12">
        <Card accentBorder data-tour-id="pilotage-category-status">
          <div className="p18">
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="sectionTitle">Etat des categories</div>
              <Button
                variant="ghost"
                onClick={() => {
                  const activeCategoryId =
                    safeData?.ui?.selectedCategoryId ||
                    safeData?.selectedCategoryId ||
                    categories?.[0]?.id ||
                    null;

                  if (typeof onPlanCategory === "function") onPlanCategory(activeCategoryId);
                }}
                disabled={!categories?.length}
                data-tour-id="pilotage-planifier"
              >
                Planifier
              </Button>
            </div>
            <div className="mt12 col" style={{ gap: 10 }}>
              {categories.map((c) => {
                const counts = countsByCategory.get(c.id) || { outcomesCount: 0, processCount: 0 };
                const label = statusByCategory.get(c.id) || "ACTIVE";
                const summary =
                  counts.outcomesCount || counts.processCount
                    ? `${counts.outcomesCount} objectifs \u00b7 ${counts.processCount} actions`
                    : "Aucun element";

                return (
                  <div key={c.id} className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="itemTitle">{c.name || "Categorie"}</div>
                      <div className="itemSub">{summary}</div>
                    </div>
                    <div className="row" style={{ alignItems: "center", gap: 8 }}>
                      <span className="badge">{STATUS_LABELS[label] || "Active"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card accentBorder data-tour-id="pilotage-load">
          <div className="p18">
            <div className="sectionTitle">Charge</div>
            <div className="mt12 col" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="itemTitle">Aujourd'hui</div>
                <div className="itemSub">
                  {loadSummary.today.done}/{loadSummary.today.planned} terminees
                </div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="itemTitle">Cette semaine</div>
                <div className="itemSub">
                  {loadSummary.week.done}/{loadSummary.week.planned} terminees
                </div>
              </div>
              {loadSummary.emptyToday ? (
                <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                  <div className="small2">Rien de planifie aujourd'hui.</div>
                  <Button
                    variant="ghost"
                    onClick={() => (typeof onPlanCategory === "function" ? onPlanCategory(null) : null)}
                    data-tour-id="pilotage-planifier-empty"
                  >
                    Planifier
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <Card accentBorder data-tour-id="pilotage-discipline">
          <div className="p18">
            <div className="sectionTitle">Discipline</div>
            <div className="mt12 col" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="itemTitle">Sessions annulees (7j)</div>
                <div className="itemSub">{disciplineSummary.cancelledSessions7d}</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="itemTitle">Jours sans execution (7j)</div>
                <div className="itemSub">{disciplineSummary.noExecutionDays7d}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
