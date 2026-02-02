import React, { useMemo } from "react";
import AccentContext from "./AccentContext";
import { AccentItem, Badge, Button, Card, ProgressRing } from "./UI";
import { clamp } from "../utils/helpers";
import { computeHabitProgress, incHabit, decHabit } from "../logic/habits";
import { addXp } from "../logic/xp";
import { safePrompt } from "../utils/dialogs";

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
  const blockCardStyle = useMemo(() => {
    // “Aujourd'hui”-style container: subtle glass + soft border. Accent is expressed via a left rail.
    return {
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(10, 14, 20, 0.52)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      overflow: "hidden",
      position: "relative",
    };
  }, []);

  const categoryRate = useMemo(() => {
    const list = habitsForCategory;
    if (!list.length) return null;
    let sum = 0;
    for (const hh of list) sum += clamp(computeHabitProgress(hh, data).ratio, 0, 1);
    return sum / list.length;
  }, [habitsForCategory, data]);

  if (block.type === "WHY") {
    return (
      <AccentContext.Provider value={{ accent }}>
        <Card accentBorder style={blockCardStyle}>
          <div className="p18">
          <div className="row">
            <div>
              <div className="small">Ton pourquoi</div>
              <div className="titleSm" style={{ color: accent }}>Raison non négociable</div>
            </div>
            <Badge>Fixe</Badge>
          </div>

          <AccentItem className="mt12 listItem" tone="neutral">
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
          </AccentItem>
        </div>
      </Card>
      </AccentContext.Provider>
    );
  }

  if (block.type === "HABITS") {
    return (
      <AccentContext.Provider value={{ accent }}>
        <Card accentBorder style={blockCardStyle}>
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
                const p = computeHabitProgress(h, data);
                const done = clamp(p.done, 0, p.target);
                const ratio = clamp(p.ratio, 0, 1);

                return (
                  <AccentItem key={h.id} className="listItem" color={accent}>
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
                  </AccentItem>
                );
              })
            )}
          </div>
        </div>
      </Card>
      </AccentContext.Provider>
    );
  }

  // GOAL
  return (
    <AccentContext.Provider value={{ accent }}>
      <Card accentBorder style={blockCardStyle}>
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
            <AccentItem className="listItem" color={accent}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{goalForCategory.title}</div>
              <div className="small2">
                {goalForCategory.cadence === "DAILY" ? "Objectif quotidien" : goalForCategory.cadence === "YEARLY" ? "Objectif annuel" : "Objectif hebdomadaire"} · cible {goalForCategory.target}
              </div>

              <div className="mt14 grid2">
                <div
                  className="kpi"
                  style={{
                    borderColor: "rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="small2">Taux catégorie</div>
                  <div style={{ fontSize: 26, fontWeight: 800 }}>
                    {categoryRate === null ? "—" : `${Math.round(categoryRate * 100)}%`}
                  </div>
                </div>
                <div
                  className="kpi"
                  style={{
                    borderColor: "rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="small2">Rappel</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Aujourd’hui</div>
                  <div className="small2 mt10">Ton UI doit te ramener à l’action.</div>
                </div>
              </div>
            </AccentItem>
          ) : (
            <div className="listItem">Aucun objectif pour cette catégorie.</div>
          )}
        </div>
      </div>
    </Card>
    </AccentContext.Provider>
  );
}
