import React, { useMemo } from "react";
import { Badge, Button, Card, ProgressRing } from "./UI";
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
  }, [accent]);

  const blockRailStyle = useMemo(() => {
    const rail = accent || "#6EE7FF";
    return {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      background: `linear-gradient(180deg, ${rail}, ${rail}55)`,
      opacity: 0.9,
    };
  }, [accent]);

  const categoryRate = useMemo(() => {
    const list = habitsForCategory;
    if (!list.length) return null;
    let sum = 0;
    for (const hh of list) sum += clamp(computeHabitProgress(hh, data.checks).ratio, 0, 1);
    return sum / list.length;
  }, [habitsForCategory, data.checks]);

  if (block.type === "WHY") {
    return (
      <Card style={blockCardStyle}>
        <div style={blockRailStyle} />
        <div className="p18">
          <div className="row">
            <div>
              <div className="small">Ton pourquoi</div>
              <div className="titleSm" style={{ color: accent }}>Raison non négociable</div>
            </div>
            <Badge>Fixe</Badge>
          </div>

          <div
            className="mt12 listItem"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
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
      <Card style={blockCardStyle}>
        <div style={blockRailStyle} />
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
                  <div
                    key={h.id}
                    className="listItem"
                    style={{
                      borderColor: "rgba(255,255,255,0.10)",
                      background: `linear-gradient(90deg, rgba(0,0,0,0), ${(accent || "#6EE7FF")}12)`,
                    }}
                  >
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
  return (
    <Card style={blockCardStyle}>
      <div style={blockRailStyle} />
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
            <div
              className="listItem"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: `linear-gradient(90deg, rgba(0,0,0,0), ${(accent || "#6EE7FF")}12)`,
              }}
            >
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
            </div>
          ) : (
            <div className="listItem">Aucun objectif pour cette catégorie.</div>
          )}
        </div>
      </div>
    </Card>
  );
}
