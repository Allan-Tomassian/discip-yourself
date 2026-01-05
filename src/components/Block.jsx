import React, { useMemo } from "react";
import { Badge, Button, Card, ProgressRing } from "./UI";
import { clamp } from "../utils/helpers";
import { computeHabitProgress, incHabit, decHabit } from "../logic/habits";
import { safePrompt } from "../utils/dialogs";
import { addXp } from "../logic/xp";

// Reserved for future composition; currently unused.
export default function Block({
  block,
  data,
  setData,
  selectedCategory,
  habitsForCategory,
  goalForCategory,
  accent,
}) {
  if (block.type === "WHY") {
    return (
      <Card accentBorder style={{ borderColor: accent }}>
        <div className="p18">
          <div className="row">
            <div>
              <div className="small">Ton pourquoi</div>
              <div className="titleSm" style={{ color: accent }}>Raison non négociable</div>
            </div>
            <Badge>Fixe</Badge>
          </div>

          <div className="mt12 listItem" style={{ borderColor: accent }}>
            <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.95 }}>“{data.profile.whyText}”</div>
            <div className="mt12 row" style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>
              <span>Image: {data.profile.whyImage ? "OK" : "—"}</span>
              <button
                className="linkBtn"
                onClick={() => {
                  const next = safePrompt("Modifie ton pourquoi :", data.profile.whyText);
                  if (!next) return;
                  setData((prev) => ({ ...prev, profile: { ...prev.profile, whyText: next.trim() } }));
                }}
              >
                Modifier
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (block.type === "HABITS") {
    return (
      <Card accentBorder style={{ borderColor: accent }}>
        <div className="p18">
          <div className="row">
            <div>
              <div className="small">Aujourd’hui</div>
              <div className="titleSm" style={{ color: accent }}>Actions — {selectedCategory.name}</div>
            </div>
            <Badge>{habitsForCategory.length} items</Badge>
          </div>

          <div className="mt12 col">
            {habitsForCategory.length === 0 ? (
              <div className="listItem">Aucune action dans cette catégorie.</div>
            ) : (
              habitsForCategory.map((h) => {
                const p = computeHabitProgress(h, data.checks);
                const done = clamp(p.done, 0, p.target);
                const ratio = clamp(p.ratio, 0, 1);

                return (
                  <div key={h.id} className="listItem" style={{ borderColor: accent }}>
                    <div className="row" style={{ alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{h.title}</div>
                        <div className="small2">
                          {h.cadence === "DAILY" ? "Quotidien" : h.cadence === "YEARLY" ? "Annuel" : "Hebdomadaire"} · cible {h.target}
                        </div>
                      </div>
                      <ProgressRing value={ratio} />
                    </div>

                    <div className="mt12 row">
                      <div className="small2">{done}/{p.target} validé{p.target > 1 ? "s" : ""}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          variant="ghost"
                          onClick={() => setData((prev) => decHabit(prev, h.id))}
                        >
                          −
                        </Button>

                        <Button
                          onClick={() =>
                            setData((prev) => {
                              const next = incHabit(prev, h.id);
                              return { ...next, profile: addXp(next.profile, 10) }; // +10 XP par validation
                            })
                          }
                        >
                          +1
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>
    );
  }

  // GOAL
  const categoryRate = useMemo(() => {
    const list = habitsForCategory;
    if (!list.length) return null;
    let sum = 0;
    for (const hh of list) sum += clamp(computeHabitProgress(hh, data.checks).ratio, 0, 1);
    return sum / list.length;
  }, [habitsForCategory, data.checks]);

  return (
    <Card accentBorder style={{ borderColor: accent }}>
      <div className="p18">
        <div className="row">
          <div>
            <div className="small">Objectif</div>
            <div className="titleSm" style={{ color: accent }}>Cible — {selectedCategory.name}</div>
          </div>
          <Badge>{goalForCategory ? (goalForCategory.cadence === "DAILY" ? "Jour" : goalForCategory.cadence === "YEARLY" ? "Année" : "Semaine") : "—"}</Badge>
        </div>

        <div className="mt12">
          {goalForCategory ? (
            <div className="listItem" style={{ borderColor: accent }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{goalForCategory.title}</div>
              <div className="small2">
                {goalForCategory.cadence === "DAILY" ? "Objectif quotidien" : goalForCategory.cadence === "YEARLY" ? "Objectif annuel" : "Objectif hebdomadaire"} · cible {goalForCategory.target}
              </div>

              <div className="mt14 grid2">
                <div className="kpi" style={{ borderColor: accent }}>
                  <div className="small2">Taux catégorie</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>
                    {categoryRate === null ? "—" : `${Math.round(categoryRate * 100)}%`}
                  </div>
                </div>
                <div className="kpi" style={{ borderColor: accent }}>
                  <div className="small2">Rappel</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Aujourd’hui</div>
                  <div className="small2 mt10">Ton UI doit te ramener à l’action.</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="listItem">Aucun objectif pour cette catégorie.</div>
          )}
        </div>
      </div>
    </Card>
  );
}
