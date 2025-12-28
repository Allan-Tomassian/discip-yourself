import React, { useMemo, useRef, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Badge, Button, Card, ProgressRing } from "../components/UI";
import { clamp, uid } from "../utils/helpers";
import { todayKey } from "../utils/dates";
import { computeHabitProgress } from "../logic/habits";
import { getBackgroundCss, getAccentForPage } from "../utils/_theme";
import { computePriorities } from "../logic/priorities";
import { activateGoal, computeAggregateProgress, scheduleStart } from "../logic/goals";
import { safeAlert, safeConfirm, safePrompt } from "../utils/dialogs";

export default function Home({ data, setData }) {
  const [showMainWhy, setShowMainWhy] = useState(true);
  function addCategory() {
    const name = safePrompt("Nom :", "Nouvelle");
    if (!name) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    const color = safePrompt("Couleur HEX :", "#FFFFFF") || "#FFFFFF";
    const cleanColor = color.trim();
    const id = uid();

    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const nextCategories = [...prevCategories, { id, name: cleanName, color: cleanColor, wallpaper: "" }];
      const prevUi = prev.ui || {};
      const nextSelected = prevCategories.length === 0 ? id : prevUi.selectedCategoryId || id;
      return { ...prev, categories: nextCategories, ui: { ...prevUi, selectedCategoryId: nextSelected } };
    });
  }

  if (!data.categories || data.categories.length === 0) {
    return (
      <ScreenShell
        accent={getAccentForPage(data, "home")}
        backgroundCss={getBackgroundCss({ data, pageId: "home", image: data?.profile?.whyImage || "" })}
        backgroundImage={data?.profile?.whyImage || ""}
        headerTitle="Accueil"
        headerSubtitle="Aucune catégorie"
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12">
              <Button onClick={addCategory}>+ Ajouter une catégorie</Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const selectedCategory =
    data.categories.find((c) => c.id === data.ui.selectedCategoryId) || data.categories[0];

  const blocks = data.ui.blocks;
  const activeGoals = useMemo(() => (data.goals || []).filter((g) => g.status === "active"), [data.goals]);
  const mainGoalId = data.ui?.mainGoalId || null;
  const mainGoal = useMemo(() => {
    if (!activeGoals.length) return null;
    if (mainGoalId) return activeGoals.find((g) => g.id === mainGoalId) || activeGoals[0];
    return activeGoals[0];
  }, [activeGoals, mainGoalId]);

  const focusCategory = useMemo(() => {
    if (!mainGoal) return selectedCategory;
    return data.categories.find((c) => c.id === mainGoal.categoryId) || selectedCategory;
  }, [mainGoal, data.categories, selectedCategory]);

  const mainWhy = focusCategory?.whyText || "";
  const primaryAggregate = useMemo(
    () => computeAggregateProgress({ goals: data.goals || [] }, mainGoal?.id),
    [data.goals, mainGoal?.id]
  );

  // Thème calculé ici (palier 7.3)
  const accent = getAccentForPage(data, "home");
  const backgroundImage = focusCategory?.wallpaper || data.profile.whyImage || "";
  const backgroundCss = getBackgroundCss({ data, pageId: "home", image: backgroundImage });

  // Palier 9 — Moteur de priorité (sans UI)
  const { nextGoals } = useMemo(() => {
    return computePriorities(data, new Date(), 3);
  }, [data]);

  const nextAction = useMemo(() => {
    if (!focusCategory) return null;
    const hs = (data.habits || []).filter((h) => h.categoryId === focusCategory.id);
    if (!hs.length) return null;
    const first = hs[0];
    return { label: first.title || first.name || "Habitude", hint: "Prochaine action" };
  }, [data.habits, focusCategory]);

  function formatStartAtFr(value) {
    if (!value) return "—";
    const dt = new Date(value);
    if (!Number.isNaN(dt.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(
        dt.getMinutes()
      )}`;
    }
    if (typeof value === "string" && value.includes("T")) {
      const [date, time = ""] = value.split("T");
      const parts = date.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]} ${time.slice(0, 5)}`;
    }
    return value;
  }

  function formatStartAtForUpdate(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  }

  function onStartGoal(goalId) {
    if (!goalId) return;
    const goalForUi = (data.goals || []).find((g) => g.id === goalId);
    let res;
    setData((prev) => {
      res = activateGoal(prev, goalId, { navigate: true, now: new Date() });
      return res.state;
    });
    if (res && !res.ok) {
      const blockers =
        res.blockers && res.blockers.length
          ? `\n\nBloquants:\n${res.blockers
              .map((b) => `- ${b.title || b.name || "Objectif"} (${b.startAt || "—"})`)
              .join("\n")}`
          : "";
      const conflicts =
        res.conflicts && res.conflicts.length
          ? `\n\nChevauchements:\n${res.conflicts
              .map((c) => `- ${c.title || "Objectif"} (${formatStartAtFr(c.startAt)} → ${formatStartAtFr(c.endAt)})`)
              .join("\n")}`
          : "";

      if (res.reason === "START_IN_FUTURE") {
        const wantsStartNow = safeConfirm(`Date de début future.${blockers}\n\nDémarrer maintenant ?`);
        if (wantsStartNow) {
          let res2;
          setData((prev) => {
            const now = new Date();
            const scheduled = scheduleStart(prev, goalId, formatStartAtForUpdate(now), goalForUi?.sessionMinutes);
            if (!scheduled.ok) {
              res2 = { ok: false, reason: "OVERLAP", conflicts: scheduled.conflicts, state: prev };
              return prev;
            }
            res2 = activateGoal(scheduled.state, goalId, { navigate: true, now });
            return res2.state;
          });
          if (res2 && !res2.ok) {
            const overlapList =
              res2.conflicts && res2.conflicts.length
                ? `\n\nChevauchements:\n${res2.conflicts
                    .map((c) => `- ${c.title || "Objectif"} (${formatStartAtFr(c.startAt)} → ${formatStartAtFr(c.endAt)})`)
                    .join("\n")}`
                : "";
            safeAlert(`Chevauchement détecté.${overlapList}`);
            return;
          }
          return;
        }
      } else if (res.reason === "OVERLAP") {
        safeAlert(`Chevauchement détecté.${conflicts}`);
      } else {
        const wantsEdit = safeConfirm(`Activation bloquée.${blockers}\n\nModifier la date ?`);
        if (!wantsEdit) return;
      }

      setData((prev) => ({
        ...prev,
        ui: {
          ...prev.ui,
          openCategoryDetailId: goalForUi?.categoryId || focusCategory?.id || prev.ui.selectedCategoryId,
          openGoalEditId: goalId,
        },
      }));
    }
  }

  const itemRefs = useRef({});
  const [dragId, setDragId] = useState(null);
  const dragActiveRef = useRef(false);

  function reorder(fromId, toId) {
    if (!fromId || fromId === toId) return;
    const idxFrom = blocks.findIndex((b) => b.id === fromId);
    const idxTo = blocks.findIndex((b) => b.id === toId);
    if (idxFrom < 0 || idxTo < 0) return;

    const next = [...blocks];
    const [m] = next.splice(idxFrom, 1);
    next.splice(idxTo, 0, m);

    setData((prev) => ({ ...prev, ui: { ...prev.ui, blocks: next } }));
  }

  function getOverId(clientY) {
    const entries = Object.entries(itemRefs.current);
    for (const [id, el] of entries) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY < mid) return id;
    }
    const last = entries[entries.length - 1];
    return last ? last[0] : null;
  }

  function onPointerDown(id, e) {
    dragActiveRef.current = true;
    setDragId(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  }

  function onPointerMove(e) {
    if (!dragActiveRef.current || !dragId) return;
    const over = getOverId(e.clientY);
    if (over && over !== dragId) {
      reorder(dragId, over);
      setDragId(over);
    }
  }

  function onPointerUp(e) {
    dragActiveRef.current = false;
    setDragId(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  const overall = useMemo(() => {
    if (!data.habits.length) return 0;
    let sum = 0;
    for (const h of data.habits) {
      sum += clamp(computeHabitProgress(h, data.checks).ratio, 0, 1);
    }
    return sum / data.habits.length;
  }, [data.habits, data.checks]);

  return (
    <ScreenShell
      accent={accent}
      backgroundCss={backgroundCss}
      backgroundImage={backgroundImage}
      headerTitle={`Accueil — ${focusCategory?.name || selectedCategory.name}`}
      headerSubtitle={`Niveau ${data.profile.level} · XP ${data.profile.xp}`}
    >
      {/* V2 — Focus objectif */}
      <Card accentBorder style={{ borderColor: accent }}>
        <div className="p18">
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="titleSm">Objectif principal</div>
              <div className="small" style={{ marginTop: 4 }}>
                Fil conducteur tant qu’il est actif.
              </div>

              <div style={{ marginTop: 12 }}>
                {mainGoal ? (
                  <>
                    <div className="listItem" style={{ marginBottom: 12 }}>
                      <div className="row">
                        <div className="small">Pourquoi principal</div>
                        <button className="linkBtn" onClick={() => setShowMainWhy((v) => !v)}>
                          {showMainWhy ? "Masquer" : "Afficher"}
                        </button>
                      </div>
                      {showMainWhy ? (
                        <div className="small2" style={{ marginTop: 6 }}>
                          {mainWhy || "Ajoute un mini-why dans la catégorie principale."}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div
                        className="dot"
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: focusCategory?.color || accent,
                        }}
                      />
                      <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
                        {mainGoal.title || mainGoal.name || mainGoal.label || "Objectif"}
                      </div>
                      <Badge>PRINCIPAL</Badge>
                    </div>

                    <div className="small" style={{ marginTop: 8, opacity: 0.9 }}>
                      Catégorie : <b>{focusCategory?.name || "—"}</b>
                    </div>

                    <div className="small" style={{ marginTop: 8, opacity: 0.9 }}>
                      Deadline : <b>{mainGoal.deadline || "—"}</b>
                      {mainGoal.deadline ? (
                        <span className="small" style={{ marginLeft: 8, opacity: 0.85 }}>
                          · Aujourd’hui : {todayKey()}
                        </span>
                      ) : null}
                    </div>

                    <div className="small" style={{ marginTop: 8, opacity: 0.9 }}>
                      Progression principale : <b>{Math.round(primaryAggregate.progress * 100)}%</b>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div className="small" style={{ opacity: 0.9 }}>
                        {nextAction ? nextAction.hint : "Prochaine action"}
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 700 }}>
                        {nextAction ? nextAction.label : "Ajoute au moins une habitude dans cette catégorie."}
                      </div>
                    </div>

                    <div className="small" style={{ marginTop: 10, opacity: 0.9 }}>
                      Prochaine session : <b>{formatStartAtFr(mainGoal.startAt)}</b>
                    </div>

                    <div className="row" style={{ marginTop: 14, gap: 10, flexWrap: "wrap" }}>
                      <Button onClick={() => onStartGoal(mainGoal.id)}>Commencer maintenant</Button>

                      <Button
                        variant="ghost"
                        onClick={() =>
                          setData((prev) => ({
                            ...prev,
                            ui: {
                              ...prev.ui,
                              selectedCategoryId: focusCategory?.id || prev.ui.selectedCategoryId,
                              openCategoryDetailId: focusCategory?.id || prev.ui.selectedCategoryId,
                              openGoalEditId: null,
                            },
                          }))
                        }
                      >
                        Voir la catégorie
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={() =>
                          setData((prev) => ({
                            ...prev,
                            ui: {
                              ...prev.ui,
                              selectedCategoryId: focusCategory?.id || prev.ui.selectedCategoryId,
                              openCategoryDetailId: focusCategory?.id || prev.ui.selectedCategoryId,
                              openGoalEditId: null,
                            },
                          }))
                        }
                      >
                        Changer l’objectif principal
                      </Button>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div className="small" style={{ opacity: 0.9 }}>
                        Enfants liés
                      </div>
                      {primaryAggregate.linked.length ? (
                        <div className="mt8 col">
                          {primaryAggregate.linked.map((item) => {
                            const child = item.goal;
                            const cat = data.categories.find((x) => x.id === child.categoryId);
                            return (
                              <div key={child.id} className="small2">
                                • {child.title || "Objectif"} · {cat?.name || "—"} · poids {item.weight}%
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="small2" style={{ opacity: 0.7 }}>
                          Aucun enfant lié.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Aucun objectif principal</div>
                    <div className="small" style={{ marginTop: 6 }}>
                      Crée un objectif dans Catégories &gt; (ouvrir une catégorie).
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              <div style={{ textAlign: "right" }}>
                <div className="titleSm">Ta discipline</div>
                <div className="small">Progression globale</div>
              </div>
              <ProgressRing value={overall} />
            </div>
          </div>
        </div>
      </Card>

      {/* V2 — File des prochains objectifs */}
      <div className="mt16">
        <Card accentBorder style={{ borderColor: "rgba(255,255,255,.14)" }}>
          <div className="p18">
            <div className="row">
              <div>
                <div className="titleSm">Prochains objectifs</div>
                <div className="small">Planification visible, exécution un par un.</div>
              </div>
              <Badge>{nextGoals.length}</Badge>
            </div>

            <div className="mt12 col">
              {nextGoals.length ? (
                nextGoals.map((g, idx) => {
                  const c = data.categories.find((x) => x.id === g.categoryId);
                  return (
                    <div key={g.id} className="listItem">
                      <div className="row">
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <Badge>#{idx + 2}</Badge>
                          <div className="dot" style={{ background: c?.color || "rgba(255,255,255,.35)" }} />
                          <div style={{ fontWeight: 700 }}>
                            {g.title || g.name || g.label || "Objectif"}
                            <span className="small" style={{ marginLeft: 8, opacity: 0.8 }}>
                              {g.deadline ? `· deadline ${g.deadline}` : "· deadline —"}
                            </span>
                          </div>
                          <span className="small" style={{ opacity: 0.85 }}>
                            · {c?.name || "—"}
                          </span>
                        </div>

                        <Button variant="ghost" onClick={() => onStartGoal(g.id)}>
                          Mettre actif
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="small">Ajoute 2–3 objectifs pour créer une file d’exécution.</div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Widgets (facultatif) */}
      <div className="mt16">
        <Card accentBorder style={{ borderColor: accent }}>
          <div className="p18">
            <div className="row">
              <div>
                <div className="titleSm">Widgets (optionnel)</div>
                <div className="small">Personnalise l’affichage. N’impacte pas l’exécution des objectifs.</div>
              </div>
              <Badge>Drag</Badge>
            </div>

            <div className="mt12 col">
              {blocks.map((b) => (
                <div
                  key={b.id}
                  ref={(el) => (itemRefs.current[b.id] = el)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className="listItem"
                  style={{ opacity: b.enabled ? 1 : 0.65 }}
                >
                  <div className="row">
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button className="dragHandle" onPointerDown={(e) => onPointerDown(b.id, e)}>
                        ⠿
                      </button>

                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {b.type === "WHY" ? "Pourquoi" : b.type === "HABITS" ? "Habitudes" : "Objectif"}
                      </div>

                      <Badge>{b.type === "WHY" ? "identité" : b.type === "HABITS" ? "action" : "cible"}</Badge>
                    </div>

                    <Button
                      variant={b.enabled ? "primary" : "ghost"}
                      onClick={() =>
                        setData((prev) => ({
                          ...prev,
                          ui: {
                            ...prev.ui,
                            blocks: prev.ui.blocks.map((x) => (x.id === b.id ? { ...x, enabled: !x.enabled } : x)),
                          },
                        }))
                      }
                      className=""
                    >
                      {b.enabled ? "ON" : "OFF"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

    </ScreenShell>
  );
}
