import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Badge, Button, Card, Input, Select, Textarea } from "../components/UI";
import { uid } from "../utils/helpers";
import { todayKey } from "../utils/dates";
import {
  abandonGoal,
  activateGoal,
  computeAggregateProgress,
  createGoal,
  deleteGoal,
  finishGoal,
  linkChild,
  preventOverlap,
  scheduleStart,
  setMainGoal,
  updateGoal,
} from "../logic/goals";
import { safePrompt } from "../utils/dialogs";

const UNIT_LABELS = {
  DAY: ["jour", "jours"],
  WEEK: ["semaine", "semaines"],
  MONTH: ["mois", "mois"],
  QUARTER: ["trimestre", "trimestres"],
  YEAR: ["an", "ans"],
};

const PLAN_TYPES = [
  { value: "ACTION", label: "Action" },
  { value: "ONE_OFF", label: "Ponctuel" },
  { value: "STATE", label: "État" },
];

const GOAL_TYPES = [
  { value: "PROCESS", label: "Processus" },
  { value: "OUTCOME", label: "Résultat" },
];

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

function resolvePlanType(goal) {
  const rawPlan = typeof goal?.planType === "string" ? goal.planType.toUpperCase() : "";
  if (rawPlan === "ACTION" || rawPlan === "ONE_OFF" || rawPlan === "STATE") return rawPlan;
  const rawType = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (rawType === "ACTION" || rawType === "ONE_OFF" || rawType === "STATE") return rawType;
  if (goal?.oneOffDate || goal?.freqUnit === "ONCE") return "ONE_OFF";
  if (goal?.freqUnit || goal?.freqCount || goal?.cadence) return "ACTION";
  return "STATE";
}

function resolveGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
  if (legacy === "OUTCOME") return "OUTCOME";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  const planType = resolvePlanType(goal);
  return planType === "STATE" ? "OUTCOME" : "PROCESS";
}

function unitFromCadence(cadence) {
  if (cadence === "DAILY") return "DAY";
  if (cadence === "WEEKLY") return "WEEK";
  if (cadence === "YEARLY") return "YEAR";
  return "WEEK";
}

function formatMetric(metric) {
  if (!metric || typeof metric !== "object") return "";
  const target =
    typeof metric.targetValue === "string" ? Number(metric.targetValue) : metric.targetValue;
  const current =
    typeof metric.currentValue === "string" ? Number(metric.currentValue) : metric.currentValue;
  if (!Number.isFinite(target) || target <= 0) return "";
  const unit = metric.unit ? ` ${metric.unit}` : "";
  const curVal = Number.isFinite(current) ? current : 0;
  return `${curVal}/${target}${unit}`;
}

function formatGoalMeta(goal) {
  const planType = resolvePlanType(goal);
  const goalType = resolveGoalType(goal);
  const rawCount = typeof goal?.freqCount === "number" ? goal.freqCount : goal?.target;
  const count = Number.isFinite(rawCount) ? Math.max(1, Math.floor(rawCount)) : 1;
  const minutes = Number.isFinite(goal?.sessionMinutes) ? Math.max(5, Math.floor(goal.sessionMinutes)) : null;
  const metricLabel = goalType === "OUTCOME" ? formatMetric(goal.metric) : "";

  if (planType === "ONE_OFF") {
    const date = formatDateFr(goal?.oneOffDate || goal?.deadline) || "—";
    const parts = [`1 fois — le ${date}`];
    if (minutes) parts.push(`${minutes} min`);
    if (metricLabel) parts.push(metricLabel);
    return parts.join(" · ");
  }

  if (planType === "STATE") {
    const parts = ["Suivi via tracker/habitude liée"];
    if (goal?.deadline) parts.push(`deadline ${formatDateFr(goal.deadline)}`);
    if (metricLabel) parts.push(metricLabel);
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
  if (metricLabel) parts.push(metricLabel);
  return parts.join(" · ");
}

function cadenceFromUnit(unit) {
  if (unit === "DAY") return "DAILY";
  if (unit === "WEEK") return "WEEKLY";
  return "YEARLY";
}

export default function CategoryDetail({ data, setData, categoryId, onBack, onSelectCategory, initialEditGoalId }) {
  const [editGoalId, setEditGoalId] = useState(null);
  const editFormRef = useRef(null);
  const lastScrollRef = useRef(null);
  const handledEditRef = useRef(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draftPlanType, setDraftPlanType] = useState("ACTION");
  const [draftGoalType, setDraftGoalType] = useState("PROCESS");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftFreqCount, setDraftFreqCount] = useState("3");
  const [draftFreqUnit, setDraftFreqUnit] = useState("WEEK");
  const [draftStartDate, setDraftStartDate] = useState(() => todayKey());
  const [draftStartTime, setDraftStartTime] = useState("09:00");
  const [draftDeadline, setDraftDeadline] = useState("");
  const [draftOneOffDate, setDraftOneOffDate] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftSessionMinutes, setDraftSessionMinutes] = useState("30");
  const [draftMetricUnit, setDraftMetricUnit] = useState("");
  const [draftMetricTarget, setDraftMetricTarget] = useState("");
  const [draftMetricCurrent, setDraftMetricCurrent] = useState("");
  const [draftResetPolicy, setDraftResetPolicy] = useState("invalidate");
  const [err, setErr] = useState("");
  const [activationError, setActivationError] = useState(null);
  const [overlapError, setOverlapError] = useState(null);
  const [linkWeightsById, setLinkWeightsById] = useState({});

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

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const allGoals = Array.isArray(data.goals) ? data.goals : [];
  const activeCategoryId = categoryId || data.ui?.selectedCategoryId || categories[0]?.id;
  const c = categories.find((x) => x.id === activeCategoryId) || categories[0];
  const mainGoalId = data.ui?.mainGoalId || null;
  const goals = c ? allGoals.filter((g) => g.categoryId === c.id) : [];
  const mainGoal = allGoals.find((g) => g.id === mainGoalId) || null;
  const primaryAggregate = useMemo(
    () => computeAggregateProgress({ goals: allGoals }, mainGoalId),
    [allGoals, mainGoalId]
  );
  const primaryAggregatePct = Math.round(primaryAggregate.progress * 100);
  const primaryChildrenPct = Math.round(primaryAggregate.aggregate * 100);
  const primaryMetricPct =
    primaryAggregate.metric == null ? null : Math.round(primaryAggregate.metric * 100);

  function updateLinkWeight(goalId, value) {
    setLinkWeightsById((prev) => ({ ...prev, [goalId]: value }));
  }

  function getLinkWeightValue(goal) {
    const raw = linkWeightsById[goal.id];
    if (!goal?.parentId) return 100;
    const fromGoal = Number.isFinite(goal?.weight) ? goal.weight : 100;
    const n = raw === "" || raw == null ? fromGoal : Number(raw);
    if (!Number.isFinite(n)) return 100;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function openAdd() {
    setErr("");
    setActivationError(null);
    setOverlapError(null);
    setEditGoalId(null);
    setDraftPlanType("ACTION");
    setDraftGoalType("PROCESS");
    setDraftTitle("");
    setDraftFreqCount("3");
    setDraftFreqUnit("WEEK");
    setDraftStartDate(todayKey());
    setDraftStartTime("09:00");
    setDraftDeadline("");
    setDraftOneOffDate("");
    setDraftNotes("");
    setDraftSessionMinutes("30");
    setDraftMetricUnit("");
    setDraftMetricTarget("");
    setDraftMetricCurrent("");
    setDraftResetPolicy("invalidate");
    setIsAdding(true);
  }

  function openEdit(goal) {
    if (!goal?.id) return;
    setErr("");
    setActivationError(null);
    setOverlapError(null);
    setEditGoalId(goal.id);
    const nextPlanType = resolvePlanType(goal);
    const nextGoalType = resolveGoalType(goal);
    setDraftPlanType(nextPlanType);
    setDraftGoalType(nextGoalType);
    setDraftTitle(goal.title || "");
    setDraftFreqCount(String(typeof goal.freqCount === "number" ? goal.freqCount : goal.target || 1));
    const unit =
      typeof goal.freqUnit === "string" ? goal.freqUnit.toUpperCase() : "";
    setDraftFreqUnit(unit && unit !== "ONCE" ? unit : unitFromCadence(goal.cadence));
    const parsed = parseStartAt(goal.startAt || goal.startDate || "");
    setDraftStartDate(parsed.date || todayKey());
    setDraftStartTime(parsed.time || "09:00");
    setDraftDeadline(goal.deadline || "");
    setDraftOneOffDate(goal.oneOffDate || (goal.freqUnit === "ONCE" ? goal.deadline : "") || "");
    setDraftNotes(goal.notes || "");
    setDraftSessionMinutes(
      nextGoalType === "OUTCOME"
        ? ""
        : typeof goal.sessionMinutes === "number"
          ? String(goal.sessionMinutes)
          : ""
    );
    setDraftMetricUnit(goal?.metric?.unit || "");
    setDraftMetricTarget(
      goal?.metric?.targetValue != null ? String(goal.metric.targetValue) : ""
    );
    setDraftMetricCurrent(
      goal?.metric?.currentValue != null ? String(goal.metric.currentValue) : ""
    );
    setDraftResetPolicy(goal.resetPolicy || "invalidate");
    setIsAdding(true);
  }

  useEffect(() => {
    if (!initialEditGoalId) return;
    if (handledEditRef.current === initialEditGoalId) return;
    const goal = goals.find((g) => g.id === initialEditGoalId);
    if (goal) {
      openEdit(goal);
      handledEditRef.current = initialEditGoalId;
    }
  }, [initialEditGoalId, goals]);

  useEffect(() => {
    if (!isAdding || !editFormRef.current) return;
    const key = `${c?.id || "cat"}:${editGoalId || "new"}`;
    if (lastScrollRef.current === key) return;
    lastScrollRef.current = key;
    const el = editFormRef.current;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, [isAdding, editGoalId, c?.id]);

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

  function closeForm() {
    setIsAdding(false);
    setEditGoalId(null);
    setErr("");
    setOverlapError(null);
    lastScrollRef.current = null;
  }

  function saveGoal() {
    const title = (draftTitle || "").trim();
    if (!title) return setErr("Titre requis.");
    const startDate = (draftStartDate || todayKey()).trim();
    const startTime = (draftStartTime || "09:00").trim() || "09:00";
    if (!startDate) return setErr("Date de début requise.");
    const startAt = `${startDate}T${startTime}`;
    const goalType = draftGoalType === "OUTCOME" ? "OUTCOME" : "PROCESS";
    const planType = draftPlanType || "ACTION";

    let deadline = (draftDeadline || "").trim();
    const oneOffDate = (draftOneOffDate || "").trim();

    if (planType === "ONE_OFF") {
      if (!oneOffDate) return setErr("Date de réalisation requise.");
      deadline = oneOffDate;
    }
    if (deadline && startDate > deadline) {
      return setErr("La date de début doit être avant la deadline.");
    }

    let metric = null;
    if (goalType === "OUTCOME") {
      const unit = (draftMetricUnit || "").trim();
      const targetRaw = (draftMetricTarget || "").trim();
      const currentRaw = (draftMetricCurrent || "").trim();
      if (unit || targetRaw || currentRaw) {
        const targetValue = Number(targetRaw);
        if (!Number.isFinite(targetValue) || targetValue <= 0) {
          return setErr("Valeur cible invalide.");
        }
        const currentValue = currentRaw ? Number(currentRaw) : 0;
        if (!Number.isFinite(currentValue)) {
          return setErr("Valeur actuelle invalide.");
        }
        metric = { unit, targetValue, currentValue };
      }
    }

    const payload = {
      categoryId: c.id,
      title,
      type: goalType,
      planType,
      startAt,
      deadline,
      resetPolicy: draftResetPolicy || "invalidate",
      metric,
    };

    let sessionMinutes = null;
    if (planType === "ACTION") {
      const rawCount = Number(draftFreqCount);
      const freqCount = Number.isFinite(rawCount) ? Math.max(1, Math.floor(rawCount)) : 0;
      if (!freqCount) return setErr("Fréquence requise.");
      const freqUnit = draftFreqUnit || "WEEK";
      const cadence = cadenceFromUnit(freqUnit);
      payload.freqCount = freqCount;
      payload.freqUnit = freqUnit;
      payload.cadence = cadence;
      payload.target = freqCount;
      payload.oneOffDate = undefined;
      payload.notes = undefined;

      const rawMinutes = (draftSessionMinutes || "").trim();
      if (rawMinutes && goalType === "PROCESS") {
        const minutes = Number(rawMinutes);
        if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) {
          return setErr("Durée invalide (5 à 600 min).");
        }
        sessionMinutes = Math.floor(minutes);
        payload.sessionMinutes = sessionMinutes;
      } else {
        payload.sessionMinutes = null;
      }
    } else if (planType === "ONE_OFF") {
      payload.oneOffDate = oneOffDate;
      payload.freqCount = undefined;
      payload.freqUnit = undefined;
      payload.sessionMinutes = null;
      payload.notes = undefined;
    } else if (planType === "STATE") {
      payload.notes = (draftNotes || "").trim();
      payload.freqCount = undefined;
      payload.freqUnit = undefined;
      payload.sessionMinutes = null;
      payload.oneOffDate = undefined;
    }

    const overlap = preventOverlap(data, editGoalId || null, startAt, sessionMinutes);
    if (!overlap.ok) {
      setOverlapError(overlap.conflicts);
      return;
    }
    setOverlapError(null);

    setData((prev) =>
      editGoalId ? updateGoal(prev, editGoalId, payload) : createGoal(prev, payload)
    );
    closeForm();
  }

  function onFinishGoal(goal) {
    if (!goal?.id) return;
    setData((prev) => finishGoal(prev, goal.id));
    setActivationError(null);
  }

  function onAbandonGoal(goal) {
    if (!goal?.id) return;
    setData((prev) => abandonGoal(prev, goal.id));
    setActivationError(null);
  }

  function onMakeActive(goal) {
    if (!goal?.id) return;
    let res;
    setData((prev) => {
      res = activateGoal(prev, goal.id, { navigate: true, now: new Date() });
      return res.state;
    });
    if (res && !res.ok) {
      setActivationError({ ...res, goalId: goal.id });
      return;
    }
    setActivationError(null);
  }

  function startNow(goalId) {
    let res;
    const now = new Date();
    setData((prev) => {
      const startAt = formatStartAtForUpdate(now);
      const scheduled = scheduleStart(prev, goalId, startAt);
      if (!scheduled.ok) {
        res = { ok: false, reason: "OVERLAP", conflicts: scheduled.conflicts, state: prev };
        return prev;
      }
      res = activateGoal(scheduled.state, goalId, { navigate: true, now });
      return res.state;
    });
    if (res && !res.ok) {
      setActivationError({ ...res, goalId });
      return;
    }
    setActivationError(null);
  }

  return (
    <ScreenShell
      data={data}
      pageId="categories"
      headerTitle={c.name}
      headerSubtitle="Objectifs de la catégorie"
      backgroundImage={c.wallpaper || data.profile.whyImage || ""}
    >
      <div style={{ "--catColor": c.color || "#7C3AED" }}>
        <div className="row">
          <Button variant="ghost" onClick={onBack}>
            ← Retour
          </Button>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Select
              value={c.id}
              onChange={(e) => {
                const nextId = e.target.value;
                if (!nextId || nextId === c.id) return;
                setData((prev) => ({ ...prev, ui: { ...(prev.ui || {}), selectedCategoryId: nextId } }));
                if (typeof onSelectCategory === "function") onSelectCategory(nextId);
              }}
            >
              {data.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
            <Badge>{goals.length} objectifs</Badge>
          </div>
        </div>

        <div className="mt16">
          <Card accentBorder>
            <div className="p18">
              <div className="row">
                <div>
                  <div className="titleSm">{c.name}</div>
                  <div className="small">Objectifs associés.</div>
                </div>
                <span className="dot" style={{ background: c.color }} />
              </div>

              <div className="mt12 col">
                {activationError && activationError.goalId ? (
                  (() => {
                    const errGoal = goals.find((g) => g.id === activationError.goalId);
                    if (!errGoal) return null;
                    return (
                      <div className="listItem">
                      <div style={{ fontWeight: 800 }}>Activation bloquée</div>
                      <div className="small2" style={{ marginTop: 6 }}>
                        {activationError.reason === "START_IN_FUTURE"
                          ? "La date de début est dans le futur."
                          : activationError.reason === "OVERLAP"
                            ? "Chevauchement détecté."
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
                      {activationError.conflicts && activationError.conflicts.length ? (
                        <div className="mt10 col">
                          {activationError.conflicts.map((c) => (
                            <div key={c.goalId} className="small2">
                              • {c.title || "Objectif"} — {formatStartAtFr(c.startAt)} → {formatStartAtFr(c.endAt)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                        <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                          <Button variant="ghost" onClick={() => openEdit(errGoal)}>
                            Modifier la date
                          </Button>
                          <Button onClick={() => startNow(errGoal.id)}>Démarrer maintenant</Button>
                        </div>
                      </div>
                    );
                  })()
                ) : null}
                {goals.length === 0 ? (
                  <div className="listItem">Aucun objectif.</div>
                ) : (
                  goals.map((g) => {
                  const isMainGoal = mainGoalId && g.id === mainGoalId;
                  const isLinked = Boolean(mainGoalId && g.parentId === mainGoalId);
                  const linkWeight = getLinkWeightValue(g);
                    return (
                      <div key={g.id} className="listItem">
                        <div className="row" style={{ alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="row" style={{ gap: 10 }}>
                              <div style={{ fontWeight: 800 }}>{g.title}</div>
                              <Badge>{g.status || "queued"}</Badge>
                              {isMainGoal ? <Badge>PRINCIPAL</Badge> : null}
                            </div>
                            <div className="small2">
                              {formatGoalMeta(g)}
                            </div>
                            <div className="small2" style={{ opacity: 0.9 }}>
                              resetPolicy : <b>{g.resetPolicy || "invalidate"}</b>
                            </div>
                            {isMainGoal ? (
                              <>
                                <div className="small2" style={{ marginTop: 6 }}>
                                  Progression principale : <b>{primaryAggregatePct}%</b>
                                </div>
                                {primaryMetricPct != null ? (
                                  <div className="small2" style={{ marginTop: 4 }}>
                                    Agrégat enfants : <b>{primaryChildrenPct}%</b> · Mesure :{" "}
                                    <b>{primaryMetricPct}%</b>
                                  </div>
                                ) : null}
                                {primaryAggregate.linked.length ? (
                                  <div className="mt6 col">
                                    {primaryAggregate.linked.map((item) => (
                                      <div key={item.goal.id} className="small2">
                                        • {item.goal.title || "Objectif"} · poids {item.weight}% ·{" "}
                                        {Math.round(item.progress * 100)}%
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="small2" style={{ opacity: 0.7 }}>
                                    Aucun secondaire lié.
                                  </div>
                                )}
                              </>
                            ) : null}
                          </div>

                          <div className="col" style={{ gap: 8, alignItems: "flex-end" }}>
                            {g.status === "active" ? (
                              <>
                                <Button onClick={() => onFinishGoal(g)}>Terminer</Button>
                                <Button variant="danger" onClick={() => onAbandonGoal(g)}>
                                  Abandonner
                                </Button>
                                <Button variant="ghost" onClick={() => openEdit(g)}>
                                  Modifier
                                </Button>
                                {isMainGoal ? (
                                  <div className="small2" style={{ opacity: 0.75 }}>
                                    Objectif principal
                                  </div>
                                ) : (
                                  <>
                                    <Button variant="ghost" onClick={() => setData((prev) => setMainGoal(prev, g.id))}>
                                      Définir comme objectif principal
                                    </Button>
                                    {mainGoalId ? (
                                      <div className="col" style={{ gap: 6, alignItems: "flex-end" }}>
                                        <div className="small2" style={{ opacity: 0.75 }}>
                                          {isLinked
                                            ? `Lié à ${mainGoal?.title || "principal"}`
                                            : "Lier au principal"}
                                        </div>
                                        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                                          <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={linkWeight}
                                            onChange={(e) => updateLinkWeight(g.id, e.target.value)}
                                            style={{ width: 86 }}
                                          />
                                          <Button
                                            variant="ghost"
                                            onClick={() =>
                                              setData((prev) => linkChild(prev, g.id, mainGoalId, linkWeight))
                                            }
                                          >
                                            {isLinked ? "Mettre à jour" : "Lier"}
                                          </Button>
                                          {isLinked ? (
                                            <Button
                                              variant="ghost"
                                              onClick={() =>
                                                setData((prev) => linkChild(prev, g.id, null))
                                              }
                                            >
                                              Retirer
                                            </Button>
                                          ) : null}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="small2" style={{ opacity: 0.7 }}>
                                        Définis un objectif principal pour lier.
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" onClick={() => onMakeActive(g)}>
                                  Mettre actif
                                </Button>
                                <Button variant="ghost" onClick={() => openEdit(g)}>
                                  Modifier
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    setData((prev) => deleteGoal(prev, g.id))
                                  }
                                >
                                  Supprimer
                                </Button>
                                {!isMainGoal ? (
                                  <div className="small2" style={{ opacity: 0.7 }}>
                                    Il doit être actif pour devenir principal.
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            <div className="mt12">
              <Button onClick={openAdd}>+ Ajouter un objectif</Button>
            </div>

            {isAdding ? (
              <div ref={editFormRef} className="mt12 listItem focusHalo scrollTarget">
                <div style={{ fontWeight: 800 }}>{editGoalId ? "Modifier l’objectif" : "Nouvel objectif"}</div>
                <div className="mt12 col">
                  <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Titre" />
                  <Select
                    value={draftPlanType}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDraftPlanType(next);
                      if (next === "STATE") {
                        setDraftGoalType("OUTCOME");
                        setDraftSessionMinutes("");
                      }
                    }}
                  >
                    {PLAN_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>

                  {draftPlanType === "STATE" ? (
                    <div className="small2">Type : Résultat</div>
                  ) : (
                    <Select value={draftGoalType} onChange={(e) => setDraftGoalType(e.target.value)}>
                      {GOAL_TYPES.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </Select>
                  )}

                  {draftPlanType === "STATE" ? (
                    <div className="small2">
                      Cet objectif se suit via un tracker/habitude liée.
                    </div>
                  ) : null}

                  {draftPlanType === "ACTION" ? (
                    <div>
                      <div className="small" style={{ marginBottom: 6 }}>
                        Je m’engage à le faire
                      </div>
                      <div className="row" style={{ gap: 10 }}>
                        <Input
                          type="number"
                          min="1"
                          value={draftFreqCount}
                          onChange={(e) => setDraftFreqCount(e.target.value)}
                          placeholder="Fréquence"
                        />
                        <Select value={draftFreqUnit} onChange={(e) => setDraftFreqUnit(e.target.value)}>
                          <option value="DAY">par jour</option>
                          <option value="WEEK">par semaine</option>
                          <option value="MONTH">par mois</option>
                          <option value="QUARTER">par trimestre</option>
                          <option value="YEAR">par an</option>
                        </Select>
                      </div>
                      <div className="small2" style={{ marginTop: 6 }}>
                        Exemple: {Math.max(1, Number(draftFreqCount) || 1)} fois par{" "}
                        {getUnitLabel(draftFreqUnit, Math.max(1, Number(draftFreqCount) || 1))}
                      </div>
                    </div>
                  ) : null}

                  {draftPlanType === "ACTION" && draftGoalType === "PROCESS" ? (
                    <Input
                      type="number"
                      min="5"
                      max="600"
                      value={draftSessionMinutes}
                      onChange={(e) => setDraftSessionMinutes(e.target.value)}
                      placeholder="Durée par session (min) — optionnel"
                    />
                  ) : null}

                  {draftGoalType === "OUTCOME" ? (
                    <div>
                      <div className="small" style={{ marginBottom: 6 }}>
                        Mesure (optionnelle)
                      </div>
                      <div className="grid3">
                        <Input
                          value={draftMetricUnit}
                          onChange={(e) => setDraftMetricUnit(e.target.value)}
                          placeholder="Unité (kg, €)"
                        />
                        <Input
                          type="number"
                          min="1"
                          value={draftMetricTarget}
                          onChange={(e) => setDraftMetricTarget(e.target.value)}
                          placeholder="Cible"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={draftMetricCurrent}
                          onChange={(e) => setDraftMetricCurrent(e.target.value)}
                          placeholder="Actuel"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <div className="small" style={{ marginBottom: 6 }}>
                      Date de début
                    </div>
                    <div className="grid2">
                      <Input
                        type="date"
                        value={draftStartDate}
                        onChange={(e) => setDraftStartDate(e.target.value)}
                      />
                      <Input
                        type="time"
                        value={draftStartTime}
                        onChange={(e) => setDraftStartTime(e.target.value)}
                      />
                    </div>
                  </div>

                  {draftPlanType === "ONE_OFF" ? (
                    <div>
                      <div className="small" style={{ marginBottom: 6 }}>
                        Date de réalisation (obligatoire)
                      </div>
                      <Input type="date" value={draftOneOffDate} onChange={(e) => setDraftOneOffDate(e.target.value)} />
                    </div>
                  ) : (
                    <div>
                      <div className="small" style={{ marginBottom: 6 }}>
                        Deadline (optionnelle)
                      </div>
                      <Input type="date" value={draftDeadline} onChange={(e) => setDraftDeadline(e.target.value)} />
                    </div>
                  )}

                  {draftPlanType === "STATE" ? (
                    <Textarea
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      placeholder="Notes (optionnel)"
                    />
                  ) : null}

                  <Select value={draftResetPolicy} onChange={(e) => setDraftResetPolicy(e.target.value)}>
                    <option value="invalidate">Abandon = invalider</option>
                    <option value="reset">Abandon = reset</option>
                  </Select>
                  {err ? <div style={{ color: "rgba(255,120,120,.95)", fontSize: 13 }}>{err}</div> : null}
                  {overlapError && overlapError.length ? (
                    <div className="small2" style={{ color: "rgba(255,140,140,.95)" }}>
                      Chevauchement détecté :
                      <div className="mt6 col">
                        {overlapError.map((c) => (
                          <div key={c.goalId}>
                            • {c.title || "Objectif"} — {formatStartAtFr(c.startAt)} → {formatStartAtFr(c.endAt)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="row">
                    <Button variant="ghost" onClick={closeForm}>
                      Annuler
                    </Button>
                    <Button onClick={saveGoal}>{editGoalId ? "Enregistrer" : "Ajouter"}</Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
      </div>
    </ScreenShell>
  );
}
