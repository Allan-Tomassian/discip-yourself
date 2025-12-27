import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import CategoryDetail from "./CategoryDetail";
import { Badge, Button, Card, Input, Textarea } from "../components/UI";
import { uid } from "../utils/helpers";
import { activateGoal, updateGoal } from "../logic/goals";

const WHY_LIMIT = 150;

const UNIT_LABELS = {
  DAY: ["jour", "jours"],
  WEEK: ["semaine", "semaines"],
  MONTH: ["mois", "mois"],
  QUARTER: ["trimestre", "trimestres"],
  YEAR: ["an", "ans"],
};

function formatCadence(cadence) {
  if (cadence === "DAILY") return "Quotidien";
  if (cadence === "YEARLY") return "Annuel";
  return "Hebdomadaire";
}

function formatDateFr(value) {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [y, m, d] = parts;
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function parseStartAt(value) {
  if (!value) return { date: "", time: "" };
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return {
      date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
      time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
    };
  }
  if (typeof value === "string" && value.includes("T")) {
    const [date, time = ""] = value.split("T");
    return { date: date || "", time: time.slice(0, 5) || "" };
  }
  return { date: value, time: "" };
}

function formatStartAtFr(value) {
  if (!value) return "—";
  const parsed = parseStartAt(value);
  if (!parsed.date) return value;
  const date = formatDateFr(parsed.date);
  if (!parsed.time) return date;
  return `${date} ${parsed.time}`;
}

function formatStartAtForUpdate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function getUnitLabel(unit, count) {
  const pair = UNIT_LABELS[unit];
  if (!pair) return "";
  return count > 1 ? pair[1] : pair[0];
}

function formatGoalMeta(goal) {
  const type = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  const rawCount = typeof goal?.freqCount === "number" ? goal.freqCount : goal?.target;
  const count = Number.isFinite(rawCount) ? Math.max(1, Math.floor(rawCount)) : 1;
  const minutes = Number.isFinite(goal?.sessionMinutes) ? Math.max(5, Math.floor(goal.sessionMinutes)) : null;

  if (type === "ONE_OFF" || goal?.freqUnit === "ONCE") {
    const date = formatDateFr(goal?.oneOffDate || goal?.deadline) || "—";
    return `1 fois — le ${date}`;
  }

  if (type === "STATE") {
    const parts = ["Suivi via tracker/habitude liée"];
    if (goal?.deadline) parts.push(`deadline ${formatDateFr(goal.deadline)}`);
    return parts.join(" · ");
  }

  const parts = [];
  if (goal?.freqUnit) {
    parts.push(`${count} fois par ${getUnitLabel(goal.freqUnit, count)}`);
  } else {
    parts.push(formatCadence(goal?.cadence));
  }
  if (goal?.deadline) {
    parts.push(`deadline ${formatDateFr(goal.deadline)}`);
  }
  if (minutes) parts.push(`${minutes} min`);
  return parts.join(" · ");
}

export default function Categories({ data, setData }) {
  const [detailCategoryId, setDetailCategoryId] = useState(null);
  const [detailEditGoalId, setDetailEditGoalId] = useState(null);
  const [openCategoryId, setOpenCategoryId] = useState(
    data.ui?.selectedCategoryId || data.categories?.[0]?.id || null
  );
  const [whyOpenByCatId, setWhyOpenByCatId] = useState({});
  const [activeOpenByCatId, setActiveOpenByCatId] = useState({});
  const [queuedOpenByCatId, setQueuedOpenByCatId] = useState({});
  const [manageOpenByCatId, setManageOpenByCatId] = useState({});
  const [activationError, setActivationError] = useState(null);

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const goals = Array.isArray(data.goals) ? data.goals : [];
  const selected = categories.find((c) => c.id === data.ui.selectedCategoryId) || categories[0];
  const activeCategoryId = data.ui?.selectedCategoryId || selected?.id || null;
  const activeCategoryIds = useMemo(() => {
    const ids = new Set();
    for (const g of goals) {
      if (g?.status === "active" && g?.categoryId) ids.add(g.categoryId);
    }
    return ids;
  }, [goals]);
  const resolvedOpenCategoryId = categories.some((c) => c.id === openCategoryId) ? openCategoryId : null;
  const pendingDetailId = data.ui?.openCategoryDetailId || null;
  const pendingEditId = data.ui?.openGoalEditId || null;

  useEffect(() => {
    if (!pendingDetailId) return;
    setDetailCategoryId(pendingDetailId);
    setDetailEditGoalId(pendingEditId || null);
    setOpenCategoryId(pendingDetailId);
    setData((prev) => ({
      ...prev,
      ui: {
        ...(prev.ui || {}),
        selectedCategoryId: pendingDetailId,
        openCategoryDetailId: null,
        openGoalEditId: null,
      },
    }));
  }, [pendingDetailId, pendingEditId, setData]);

  const categoriesOrdered = useMemo(() => {
    if (!activeCategoryIds.size) return categories;
    const active = categories.filter((c) => activeCategoryIds.has(c.id));
    const rest = categories.filter((c) => !activeCategoryIds.has(c.id));
    return [...active, ...rest];
  }, [categories, activeCategoryIds]);

  const goalsByCategory = useMemo(() => {
    const map = new Map();
    for (const g of goals) {
      if (!g?.categoryId) continue;
      const list = map.get(g.categoryId) || [];
      list.push(g);
      map.set(g.categoryId, list);
    }
    return map;
  }, [goals]);

  function addCategory() {
    const name = prompt("Nom :", "Nouvelle");
    if (!name) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    const color = prompt("Couleur HEX :", "#FFFFFF") || "#FFFFFF";
    const cleanColor = color.trim();
    const id = uid();

    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const nextCategories = [...prevCategories, { id, name: cleanName, color: cleanColor, wallpaper: "" }];
      const prevUi = prev.ui || {};
      const nextSelected = prevCategories.length === 0 ? id : prevUi.selectedCategoryId || id;
      return { ...prev, categories: nextCategories, ui: { ...prevUi, selectedCategoryId: nextSelected } };
    });
    setOpenCategoryId(id);
  }

  if (categories.length === 0) {
    return (
      <ScreenShell
        data={data}
        pageId="categories"
        headerTitle="Catégories"
        headerSubtitle="Aucune catégorie"
        backgroundImage={data?.profile?.whyImage || ""}
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

  if (detailCategoryId) {
    return (
      <CategoryDetail
        data={data}
        setData={setData}
        categoryId={detailCategoryId}
        onBack={() => {
          setDetailCategoryId(null);
          setDetailEditGoalId(null);
        }}
        initialEditGoalId={detailEditGoalId}
        onSelectCategory={(nextId) => {
          setDetailCategoryId(nextId);
          setDetailEditGoalId(null);
          setOpenCategoryId(nextId);
        }}
      />
    );
  }

  function updateCategory(categoryId, patch) {
    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const nextCategories = prevCategories.map((cat) => (cat.id === categoryId ? { ...cat, ...patch } : cat));
      return { ...prev, categories: nextCategories };
    });
  }

  function toggleCategory(categoryId) {
    setOpenCategoryId((prev) => (prev === categoryId ? null : categoryId));
    setActivationError(null);
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (prevUi.selectedCategoryId === categoryId) return prev;
      return { ...prev, ui: { ...prevUi, selectedCategoryId: categoryId } };
    });
  }

  function openDetails(categoryId) {
    setDetailCategoryId(categoryId);
    setOpenCategoryId(categoryId);
    setActivationError(null);
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (prevUi.selectedCategoryId === categoryId) return prev;
      return { ...prev, ui: { ...prevUi, selectedCategoryId: categoryId } };
    });
  }

  function onStartGoal(goalId) {
    if (!goalId) return;
    let res;
    setData((prev) => {
      res = activateGoal(prev, goalId, { navigate: true, now: new Date() });
      return res.state;
    });
    if (res && !res.ok) {
      setActivationError({ ...res, goalId });
      return;
    }
    setActivationError(null);
  }

  function onActivateGoal(goalId) {
    if (!goalId) return;
    let res;
    setData((prev) => {
      res = activateGoal(prev, goalId, { navigate: true, now: new Date() });
      return res.state;
    });
    if (res && !res.ok) {
      setActivationError({ ...res, goalId });
      return;
    }
    setActivationError(null);
  }

  function startNow(goalId) {
    let res;
    const now = new Date();
    setData((prev) => {
      const startAt = formatStartAtForUpdate(now);
      const updated = updateGoal(prev, goalId, { startAt });
      res = activateGoal(updated, goalId, { navigate: true, now });
      return res.state;
    });
    if (res && !res.ok) {
      setActivationError({ ...res, goalId });
      return;
    }
    setActivationError(null);
  }

  function onDeleteCategory(category) {
    if (!category?.id) return;
    const name = category.name || "cette catégorie";
    if (!confirm(`Supprimer "${name}" ?`)) return;

    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const prevGoals = Array.isArray(prev.goals) ? prev.goals : [];
      const prevHabits = Array.isArray(prev.habits) ? prev.habits : [];

      const nextCategories = prevCategories.filter((c) => c.id !== category.id);
      const nextGoals = prevGoals.filter((g) => g.categoryId !== category.id);
      const nextHabits = prevHabits.filter((h) => h.categoryId !== category.id);
      const nextChecks = { ...(prev.checks || {}) };
      for (const h of prevHabits) {
        if (h.categoryId === category.id) delete nextChecks[h.id];
      }

      const prevUi = prev.ui || {};
      const nextSelected =
        prevUi.selectedCategoryId === category.id ? nextCategories[0]?.id || null : prevUi.selectedCategoryId;
      const nextActiveGoalId =
        prevUi.activeGoalId && nextGoals.some((g) => g.id === prevUi.activeGoalId) ? prevUi.activeGoalId : null;

      return {
        ...prev,
        categories: nextCategories,
        goals: nextGoals,
        habits: nextHabits,
        checks: nextChecks,
        ui: { ...prevUi, selectedCategoryId: nextSelected, activeGoalId: nextActiveGoalId },
      };
    });

    setOpenCategoryId((prev) => (prev === category.id ? null : prev));
  }

  return (
    <ScreenShell
      data={data}
      pageId="categories"
      headerTitle="Catégories"
      headerSubtitle="Une catégorie ouverte à la fois"
      backgroundImage={selected.wallpaper || data.profile.whyImage || ""}
    >
      <div className="col">
        {categoriesOrdered.map((c) => {
          const goals = goalsByCategory.get(c.id) || [];
          const activeGoal = goals.find((g) => g.status === "active");
          const queuedGoals = goals
            .filter((g) => g.status === "queued")
            .sort((a, b) => (a.order || 0) - (b.order || 0));

          const isOpen = c.id === resolvedOpenCategoryId;
          const isActive = c.id === activeCategoryId;
          const whyOpen = whyOpenByCatId[c.id] ?? isActive;
          const activeOpen = activeOpenByCatId[c.id] ?? true;
          const queuedOpen = queuedOpenByCatId[c.id] ?? false;
          const manageOpen = manageOpenByCatId[c.id] ?? false;
          const whyVal = (c.whyText || "").slice(0, WHY_LIMIT);
          const errorGoal =
            activationError && activationError.goalId
              ? goals.find((g) => g.id === activationError.goalId)
              : null;

          return (
            <Card
              key={c.id}
              accentBorder
              style={{
                borderColor: isActive ? c.color || "rgba(255,255,255,.25)" : "rgba(255,255,255,.16)",
              }}
            >
              <div className="p18">
                <div
                  className="row"
                  style={{ cursor: "pointer", alignItems: "center" }}
                  onClick={() => toggleCategory(c.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <span className="dot" style={{ background: c.color || "#FFFFFF" }} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="titleSm"
                        style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {c.name}
                      </div>
                      <div className="small2">
                        {activeGoal
                          ? "Objectif actif en cours"
                          : queuedGoals.length
                            ? `${queuedGoals.length} planifié${queuedGoals.length > 1 ? "s" : ""}`
                            : "Aucun objectif planifié"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {activeGoal ? <Badge>ACTIF</Badge> : null}
                    <span style={{ fontSize: 16, opacity: 0.8 }}>{isOpen ? "▾" : "▸"}</span>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt12 col">
                    {isActive ? (
                      <div>
                        <div className="row">
                          <div className="titleSm">Mini-why</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="small2">
                              {whyVal.length}/{WHY_LIMIT}
                            </div>
                            <button
                              className="linkBtn"
                              onClick={() =>
                                setWhyOpenByCatId((prev) => ({ ...prev, [c.id]: !whyOpen }))
                              }
                            >
                              {whyOpen ? "Masquer" : "Afficher"}
                            </button>
                          </div>
                        </div>
                        {whyOpen ? (
                          <>
                            <div className="small2" style={{ marginTop: 4 }}>
                              Écris la réussite comme si elle était déjà là. Exemple: « Parce que je veux un corps sculpté ».
                            </div>
                            <div className="mt10">
                              <Textarea
                                value={whyVal}
                                maxLength={WHY_LIMIT}
                                placeholder="Parce que je veux … (décris le résultat final)."
                                onChange={(e) =>
                                  updateCategory(c.id, { whyText: e.target.value.slice(0, WHY_LIMIT) })
                                }
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    {errorGoal ? (
                      <div className="listItem">
                        <div style={{ fontWeight: 800 }}>Activation bloquée</div>
                        <div className="small2" style={{ marginTop: 6 }}>
                          {activationError.reason === "START_IN_FUTURE"
                            ? "La date de début est dans le futur."
                            : "Un autre objectif bloque l’activation."}
                        </div>
                        {activationError.blockers && activationError.blockers.length ? (
                          <div className="mt10 col">
                            {activationError.blockers.map((b) => (
                              <div key={b.id} className="small2">
                                • {b.title || b.name || "Objectif"} — {formatStartAtFr(b.startAt)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              openDetails(c.id);
                              setDetailEditGoalId(errorGoal.id);
                            }}
                          >
                            Modifier la date
                          </Button>
                          <Button onClick={() => startNow(errorGoal.id)}>Démarrer maintenant</Button>
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <div className="row">
                        <div className="titleSm">Objectif actif</div>
                        <button
                          className="linkBtn"
                          onClick={() =>
                            setActiveOpenByCatId((prev) => ({ ...prev, [c.id]: !activeOpen }))
                          }
                        >
                          {activeOpen ? "Masquer" : "Afficher"}
                        </button>
                      </div>
                      {activeOpen ? (
                        <div className="mt10">
                          {activeGoal ? (
                            <div
                              className="listItem"
                              style={{
                                background: "rgba(255,255,255,.12)",
                                borderColor: c.color || "rgba(255,255,255,.22)",
                              }}
                            >
                              <div className="row" style={{ alignItems: "flex-start" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 800 }}>
                                    {activeGoal.title || activeGoal.name || "Objectif"}
                                  </div>
                                  <div className="small2">
                                    {formatGoalMeta(activeGoal)}
                                  </div>
                                </div>
                              </div>

                              <div className="row" style={{ marginTop: 12, gap: 10, justifyContent: "flex-start" }}>
                                <Button onClick={() => onStartGoal(activeGoal.id)}>Commencer</Button>
                                <Button variant="ghost" onClick={() => openDetails(c.id)}>
                                  Gérer les objectifs
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="listItem">
                              <div className="small">Aucun objectif actif pour cette catégorie.</div>
                              <div className="mt10">
                                <Button variant="ghost" onClick={() => openDetails(c.id)}>
                                  Gérer les objectifs
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <div className="row">
                        <div>
                          <div className="titleSm">Objectifs planifiés</div>
                          <div className="small2">{queuedGoals.length} en attente</div>
                        </div>
                        {queuedGoals.length ? (
                          <button
                            className="linkBtn"
                            onClick={() =>
                              setQueuedOpenByCatId((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                            }
                          >
                            {queuedOpen ? "Masquer" : "Afficher"}
                          </button>
                        ) : (
                          <Badge>0</Badge>
                        )}
                      </div>

                      {queuedGoals.length === 0 ? (
                        <div className="mt10 small2">Aucun objectif planifié.</div>
                      ) : queuedOpen ? (
                        <div className="mt10 col">
                          {queuedGoals.map((g) => (
                            <div key={g.id} className="listItem" style={{ background: "rgba(255,255,255,.06)" }}>
                              <div className="row" style={{ alignItems: "flex-start" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700 }}>{g.title || g.name || "Objectif"}</div>
                                  <div className="small2">
                                    {formatGoalMeta(g)}
                                  </div>
                                </div>
                                <Badge>PLANIFIÉ</Badge>
                              </div>
                              <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                                <Button variant="ghost" onClick={() => onActivateGoal(g.id)}>
                                  Mettre actif
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <div className="row">
                        <div className="titleSm">Gestion</div>
                        <button
                          className="linkBtn"
                          onClick={() =>
                            setManageOpenByCatId((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                          }
                        >
                          {manageOpen ? "Masquer" : "Afficher"}
                        </button>
                      </div>

                      {manageOpen ? (
                        <div className="mt10 col">
                          <Input
                            value={c.name || ""}
                            onChange={(e) => updateCategory(c.id, { name: e.target.value })}
                            placeholder="Nom de la catégorie"
                          />
                          <div className="grid2">
                            <Input
                              value={c.color || ""}
                              onChange={(e) => updateCategory(c.id, { color: e.target.value })}
                              placeholder="#FFFFFF"
                            />
                            <Input
                              value={c.wallpaper || ""}
                              onChange={(e) => updateCategory(c.id, { wallpaper: e.target.value })}
                              placeholder="Image (URL)"
                            />
                          </div>
                          <Button variant="danger" onClick={() => onDeleteCategory(c)}>
                            Supprimer la catégorie
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}

        <Card accentBorder style={{ marginTop: 14 }}>
          <div className="p18 row">
            <div>
              <div className="titleSm">Nouvelle catégorie</div>
              <div className="small2">Ajoute un pilier de discipline.</div>
            </div>
            <Button onClick={addCategory}>+ Ajouter</Button>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
