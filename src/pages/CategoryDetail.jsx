// src/pages/CategoryDetail.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Badge, Button, Card, Input, Select, Textarea } from "../components/UI";
import FocusCategoryPicker from "../components/FocusCategoryPicker";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { uid } from "../utils/helpers";
import { todayKey } from "../utils/dates";
import { CATEGORY_TEMPLATES, GOAL_TEMPLATES, HABIT_TEMPLATES } from "../logic/templates";
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
  updateGoal,
} from "../logic/goals";

const UNIT_LABELS = {
  DAY: ["jour", "jours"],
  WEEK: ["semaine", "semaines"],
  MONTH: ["mois", "mois"],
  QUARTER: ["trimestre", "trimestres"],
  YEAR: ["an", "ans"],
};

const MEASURE_OPTIONS = [
  { value: "money", label: "💰 Argent" },
  { value: "counter", label: "🔢 Compteur" },
  { value: "time", label: "⏱️ Temps" },
  { value: "energy", label: "⚡ Énergie" },
  { value: "distance", label: "📏 Distance" },
  { value: "weight", label: "⚖️ Poids" },
];

function getMeasurePlaceholder(type) {
  if (type === "money") return "€";
  if (type === "time") return "minutes";
  if (type === "energy") return "0 – 100";
  if (type === "distance") return "km";
  if (type === "weight") return "kg";
  if (type === "counter") return "nombre";
  return "Valeur";
}

function getCategoryTemplateKey(category) {
  const rawId = typeof category?.templateId === "string" ? category.templateId.trim() : "";
  if (rawId && CATEGORY_TEMPLATES.some((t) => t.id === rawId)) return rawId;
  const label = (category?.name || "").trim().toLowerCase();
  if (!label) return null;
  const match = CATEGORY_TEMPLATES.find((t) => t.label.toLowerCase() === label);
  return match ? match.id : null;
}

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

function formatGoalMeta(goal) {
  const goalType = resolveGoalType(goal);
  const planType = resolvePlanType(goal);
  const rawCount = typeof goal?.freqCount === "number" ? goal.freqCount : goal?.target;
  const count = Number.isFinite(rawCount) ? Math.max(1, Math.floor(rawCount)) : 1;
  const minutes = Number.isFinite(goal?.sessionMinutes) ? Math.max(5, Math.floor(goal.sessionMinutes)) : null;

  if (goalType === "OUTCOME") {
    const parts = ["Objectif"];
    if (goal?.deadline) parts.push(`date cible ${formatDateFr(goal.deadline)}`);
    if (goal?.metric?.unit && Number.isFinite(goal?.metric?.targetValue)) {
      parts.push(`${goal.metric.targetValue} ${goal.metric.unit}`);
    }
    return parts.join(" · ");
  }

  if (planType === "ONE_OFF") {
    const date = formatDateFr(goal?.oneOffDate || goal?.deadline) || "—";
    return `1 fois — le ${date}`;
  }

  if (planType === "STATE") {
    const parts = ["Suivi via une habitude liée"];
    if (goal?.deadline) parts.push(`date limite ${formatDateFr(goal.deadline)}`);
    return parts.join(" · ");
  }

  const parts = [];
  if (goal?.freqUnit) {
    parts.push(`${count} fois par ${getUnitLabel(goal.freqUnit, count)}`);
  } else {
    parts.push(formatCadence(goal?.cadence));
  }
  if (minutes) parts.push(`${minutes} min`);
  return parts.join(" · ");
}

function formatStatusLabel(status) {
  const raw = (status || "").toString().toLowerCase();
  if (raw === "active") return "En cours";
  if (raw === "done") return "Terminé";
  if (raw === "invalid") return "Abandonné";
  return "En attente";
}

function formatResetPolicy(value) {
  return value === "reset" ? "réinitialiser" : "invalider";
}

function cadenceFromUnit(unit) {
  if (unit === "DAY") return "DAILY";
  if (unit === "WEEK") return "WEEKLY";
  return "YEARLY";
}

function ObjectiveForm({
  title,
  onTitleChange,
  deadline,
  onDeadlineChange,
  notes,
  onNotesChange,
  measureType,
  onMeasureTypeChange,
  targetValue,
  onTargetValueChange,
}) {
  return (
    <>
      <Input value={title} onChange={onTitleChange} placeholder="Nom de l’objectif" />
      <div>
        <div className="small" style={{ marginBottom: 6 }}>
          Type de mesure
        </div>
        <Select value={measureType} onChange={onMeasureTypeChange} style={{ fontSize: 16 }}>
          <option value="">Sélectionner un type</option>
          {MEASURE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
      {measureType ? (
        <Input
          type="number"
          value={targetValue}
          onChange={onTargetValueChange}
          placeholder={getMeasurePlaceholder(measureType)}
        />
      ) : null}
      <div>
        <div className="small" style={{ marginBottom: 6 }}>
          Date cible (optionnelle)
        </div>
        <Input type="date" value={deadline} onChange={onDeadlineChange} />
      </div>
      <Textarea value={notes} onChange={onNotesChange} placeholder="Notes (optionnel)" />
    </>
  );
}

function HabitForm({
  title,
  onTitleChange,
  planType,
  freqCount,
  onFreqCountChange,
  freqUnit,
  onFreqUnitChange,
  sessionMinutes,
  onSessionMinutesChange,
  startDate,
  onStartDateChange,
  startTime,
  onStartTimeChange,
}) {
  return (
    <>
      <Input value={title} onChange={onTitleChange} placeholder="Nom de l’habitude" />
      {planType === "ACTION" ? (
        <div>
          <div className="small" style={{ marginBottom: 6 }}>
            Fréquence
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Input type="number" min="1" value={freqCount} onChange={onFreqCountChange} placeholder="Nombre" />
            <Select value={freqUnit} onChange={onFreqUnitChange}>
              <option value="DAY">par jour</option>
              <option value="WEEK">par semaine</option>
              <option value="MONTH">par mois</option>
              <option value="QUARTER">par trimestre</option>
              <option value="YEAR">par an</option>
            </Select>
          </div>
        </div>
      ) : null}

      {planType === "ACTION" ? (
        <Input
          type="number"
          min="5"
          max="600"
          value={sessionMinutes}
          onChange={onSessionMinutesChange}
          placeholder="Durée par session (min)"
        />
      ) : null}

      <div>
        <div className="small" style={{ marginBottom: 6 }}>
          Début
        </div>
        <div className="grid2">
          <Input type="date" value={startDate} onChange={onStartDateChange} />
          <Input type="time" value={startTime} onChange={onStartTimeChange} />
        </div>
      </div>
    </>
  );
}

export default function CategoryDetail({ data, setData, categoryId, onBack, onSelectCategory, initialEditGoalId }) {
  const [editGoalId, setEditGoalId] = useState(null);
  const editFormRef = useRef(null);
  const lastScrollRef = useRef(null);
  const handledEditRef = useRef(null);
  const [isAdding, setIsAdding] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [showAllHabits, setShowAllHabits] = useState(false);
  const [formKind, setFormKind] = useState(null);
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
  const [draftMeasureType, setDraftMeasureType] = useState("");
  const [draftTargetValue, setDraftTargetValue] = useState("");
  const [draftResetPolicy, setDraftResetPolicy] = useState("invalidate");
  const [draftTemplateId, setDraftTemplateId] = useState(null);
  const [goalSuggestionsOpen, setGoalSuggestionsOpen] = useState(false);
  const [habitSuggestionsOpen, setHabitSuggestionsOpen] = useState(false);
  const [goalSuggestionQuery, setGoalSuggestionQuery] = useState("");
  const [habitSuggestionQuery, setHabitSuggestionQuery] = useState("");
  const [err, setErr] = useState("");
  const [activationError, setActivationError] = useState(null);
  const [overlapError, setOverlapError] = useState(null);
  const [linkWeightsById, setLinkWeightsById] = useState({});
  const [linkPanelGoalId, setLinkPanelGoalId] = useState(null);
  const [addCatName, setAddCatName] = useState("Nouvelle");
  const [addCatColor, setAddCatColor] = useState("#FFFFFF");
  const [addCatErr, setAddCatErr] = useState("");
  const safeData = data && typeof data === "object" ? data : {};

  useEffect(() => {
    setGoalPickerOpen(false);
    setShowAllHabits(false);
  }, [categoryId, safeData.ui?.selectedCategoryByView?.plan]);

  function isValidHexColor(v) {
    if (typeof v !== "string") return false;
    const s = v.trim();
    return /^#[0-9A-Fa-f]{6}$/.test(s);
  }

  function addCategory() {
    const cleanName = (addCatName || "").trim();
    if (!cleanName) {
      setAddCatErr("Nom requis.");
      return;
    }
    const cleanColor = (addCatColor || "").trim() || "#FFFFFF";
    if (!isValidHexColor(cleanColor)) {
      setAddCatErr("Couleur invalide. Format attendu : #RRGGBB");
      return;
    }
    setAddCatErr("");
    const id = uid();

    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const nextCategories = [
        ...prevCategories,
        { id, name: cleanName, color: cleanColor.toUpperCase(), wallpaper: "", mainGoalId: null },
      ];
      const prevUi = prev.ui || {};
      const prevSel =
        prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
          ? prevUi.selectedCategoryByView
          : {};
      const nextSelected = id;
      return {
        ...prev,
        categories: nextCategories,
        ui: {
          ...prevUi,
          // Plan context
          selectedCategoryByView: { ...prevSel, plan: nextSelected },
        },
      };
    });
  }

  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const allGoals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const requestedCategoryId =
    categoryId || safeData.ui?.selectedCategoryByView?.plan || safeData.ui?.selectedCategoryId || null;
  const c = categories.find((x) => x.id === requestedCategoryId) || null;
  const goals = c ? allGoals.filter((g) => g.categoryId === c.id) : [];
  const outcomeGoals = goals.filter((g) => resolveGoalType(g) === "OUTCOME");
  const processGoals = goals.filter((g) => resolveGoalType(g) === "PROCESS");

  // Source of truth: only the category can define its main goal.
  // Never fallback to a global ui.mainGoalId, to avoid cross-category parentId corruption.
  const mainGoalId = c?.mainGoalId || null;
  const mainGoal = mainGoalId ? goals.find((g) => g.id === mainGoalId) : null;
  const linkedHabits = mainGoalId ? processGoals.filter((g) => g.parentId === mainGoalId) : [];
  const visibleHabits = showAllHabits ? linkedHabits : linkedHabits.slice(0, 3);
  const isObjectiveForm = formKind === "objective";
  const formTitle = isObjectiveForm
    ? editGoalId
      ? "Modifier l’objectif"
      : "Nouvel objectif"
    : editGoalId
    ? "Modifier l’habitude"
    : "Nouvelle habitude";
  const formSaveLabel = isObjectiveForm
    ? editGoalId
      ? "Enregistrer l’objectif"
      : "Ajouter l’objectif"
    : editGoalId
    ? "Enregistrer l’habitude"
    : "Ajouter l’habitude";
  const outcomeAggregate = useMemo(
    () => computeAggregateProgress({ goals: allGoals }, mainGoal?.id),
    [allGoals, mainGoal?.id]
  );
  const outcomePct = Math.round(outcomeAggregate.progress * 100);
  const categoryTemplateKey = getCategoryTemplateKey(c);
  const goalTemplatesForCategory = GOAL_TEMPLATES.filter((t) => t.categoryKey === categoryTemplateKey);
  const goalTemplatesSource = goalTemplatesForCategory.length ? goalTemplatesForCategory : GOAL_TEMPLATES;
  const goalTemplatesFiltered = goalTemplatesSource.filter((t) => {
    const query = (goalSuggestionQuery || "").trim().toLowerCase();
    if (!query) return true;
    return t.label.toLowerCase().includes(query);
  });

  const habitTemplatesByGoal = mainGoal?.templateId
    ? HABIT_TEMPLATES.filter((t) => t.goalTemplateId === mainGoal.templateId)
    : HABIT_TEMPLATES.filter((t) => !t.goalTemplateId);
  const habitTemplatesFallback = HABIT_TEMPLATES.filter((t) => !t.goalTemplateId);
  const habitTemplatesSource = habitTemplatesByGoal.length ? habitTemplatesByGoal : habitTemplatesFallback;
  const habitTemplatesFiltered = habitTemplatesSource.filter((t) => {
    const query = (habitSuggestionQuery || "").trim().toLowerCase();
    if (!query) return true;
    return t.label.toLowerCase().includes(query);
  });

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

  function setCategoryMainGoal(goalId) {
    if (!c?.id) return;
    setData((prev) => {
      const nextCategories = (prev.categories || []).map((cat) => (cat.id === c.id ? { ...cat, mainGoalId: goalId || null } : cat));
      const prevUi = prev.ui || {};
      const prevSel =
        prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
          ? prevUi.selectedCategoryByView
          : {};
      return {
        ...prev,
        categories: nextCategories,
        ui: {
          ...prevUi,
          // keep Plan context on this category
          selectedCategoryByView: { ...prevSel, plan: c.id },
        },
      };
    });
  }

  function resetDraft() {
    setErr("");
    setActivationError(null);
    setOverlapError(null);
    // Keep Advanced open when editing, but we also expose creation buttons outside Advanced.
    setAdvancedOpen(true);
    setEditGoalId(null);
    setDraftTemplateId(null);
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
    setDraftMeasureType("");
    setDraftTargetValue("");
    setDraftResetPolicy("invalidate");
    setGoalSuggestionsOpen(false);
    setHabitSuggestionsOpen(false);
    setGoalSuggestionQuery("");
    setHabitSuggestionQuery("");
    setIsAdding(true);
  }

  function openAddObjective() {
    resetDraft();
    setFormKind("objective");
    setDraftPlanType("STATE");
    setDraftGoalType("OUTCOME");
  }

  function openAddHabit() {
    resetDraft();
    setFormKind("habit");
    setDraftPlanType("ACTION");
    setDraftGoalType("PROCESS");
  }

  function openEdit(goal) {
    if (!goal?.id) return;
    setErr("");
    setActivationError(null);
    setOverlapError(null);
    setAdvancedOpen(true);
    setEditGoalId(goal.id);

    const nextGoalType = resolveGoalType(goal);
    const nextFormKind = nextGoalType === "OUTCOME" ? "objective" : "habit";
    const nextPlanType = nextGoalType === "OUTCOME" ? "STATE" : resolvePlanType(goal);

    setDraftPlanType(nextPlanType);
    setDraftGoalType(nextGoalType);
    setFormKind(nextFormKind);

    setDraftTitle(goal.title || "");

    // PROCESS-only fields
    if (nextGoalType === "PROCESS") {
      setDraftFreqCount(String(typeof goal.freqCount === "number" ? goal.freqCount : goal.target || 1));
      const unit = typeof goal.freqUnit === "string" ? goal.freqUnit.toUpperCase() : "";
      setDraftFreqUnit(unit && unit !== "ONCE" ? unit : "WEEK");
      const parsed = parseStartAt(goal.startAt || goal.startDate || "");
      setDraftStartDate(parsed.date || todayKey());
      setDraftStartTime(parsed.time || "09:00");
      setDraftSessionMinutes(typeof goal.sessionMinutes === "number" ? String(goal.sessionMinutes) : "30");

      setDraftOneOffDate(goal.oneOffDate || (goal.freqUnit === "ONCE" ? goal.deadline : "") || "");
      setDraftDeadline(""); // ignored for habits
      setDraftNotes(""); // not used for habits in this UI
      setDraftMetricUnit("");
      setDraftMetricTarget("");
      setDraftMetricCurrent("");
      setDraftMeasureType("");
      setDraftTargetValue("");
    } else {
      // OUTCOME-only fields
      setDraftFreqCount("3");
      setDraftFreqUnit("WEEK");
      setDraftSessionMinutes("30");
      const parsed = parseStartAt(goal.startAt || goal.startDate || "");
      setDraftStartDate(parsed.date || todayKey());
      setDraftStartTime(parsed.time || "09:00");

      setDraftDeadline(goal.deadline || "");
      setDraftOneOffDate("");
      setDraftNotes(goal.notes || "");
      setDraftMetricUnit(goal?.metric?.unit || "");
      setDraftMetricTarget(goal?.metric?.targetValue != null ? String(goal.metric.targetValue) : "");
      setDraftMetricCurrent(goal?.metric?.currentValue != null ? String(goal.metric.currentValue) : "");
      setDraftMeasureType(goal?.measureType || "");
      setDraftTargetValue(goal?.targetValue != null ? String(goal.targetValue) : "");
    }

    setDraftResetPolicy(goal.resetPolicy || "invalidate");
    setDraftTemplateId(typeof goal.templateId === "string" ? goal.templateId : null);
    setIsAdding(true);
  }

  useEffect(() => {
    if (!initialEditGoalId) return;
    if (handledEditRef.current === initialEditGoalId) return;
    if (initialEditGoalId === "__new_process__") {
      openAddHabit();
      handledEditRef.current = initialEditGoalId;
      setData((prev) => ({ ...prev, ui: { ...(prev.ui || {}), openGoalEditId: null } }));
      return;
    }
    if (initialEditGoalId === "__new_outcome__") {
      openAddObjective();
      handledEditRef.current = initialEditGoalId;
      setData((prev) => ({ ...prev, ui: { ...(prev.ui || {}), openGoalEditId: null } }));
      return;
    }
    const goal = goals.find((g) => g.id === initialEditGoalId);
    if (goal) {
      openEdit(goal);
      handledEditRef.current = initialEditGoalId;
      setData((prev) => ({ ...prev, ui: { ...(prev.ui || {}), openGoalEditId: null } }));
    }
  }, [initialEditGoalId, goals, setData]);

  useEffect(() => {
    if (!editGoalId) return;
    if (goals.some((g) => g.id === editGoalId)) return;
    closeForm();
  }, [editGoalId, goals]);

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
        data={safeData}
        pageId="categories"
        headerTitle={<span className="textAccent">Outils</span>}
        headerSubtitle="Aucune catégorie"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12 col" style={{ gap: 10 }}>
              <Input value={addCatName} onChange={(e) => setAddCatName(e.target.value)} placeholder="Nom de catégorie" />
              <Input value={addCatColor} onChange={(e) => setAddCatColor(e.target.value)} placeholder="#RRGGBB" />
              {addCatErr ? <div style={{ color: "rgba(255,120,120,.95)", fontSize: 13 }}>{addCatErr}</div> : null}
              <Button onClick={addCategory}>+ Ajouter une catégorie</Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  if (!c) {
    return (
      <ScreenShell
        data={safeData}
        pageId="categories"
        headerTitle={<span className="textAccent">Outils</span>}
        headerSubtitle="État invalide"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">État invalide</div>
            <div className="small" style={{ marginTop: 6 }}>
              La catégorie demandée est introuvable.
            </div>
            <div className="mt12">
              <Button
                variant="ghost"
                className="btnBackCompact backBtn"
                onClick={() => {
                  setData((prev) => {
                    const prevUi = prev.ui || {};
                    const prevSel =
                      prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
                        ? prevUi.selectedCategoryByView
                        : {};
                    return {
                      ...prev,
                      ui: {
                        ...prevUi,
                        selectedCategoryByView: { ...prevSel, plan: null },
                      },
                    };
                  });
                  if (typeof onBack === "function") onBack();
                }}
              >
                ← Retour
              </Button>
            </div>
            <div className="mt12">
              <div className="small" style={{ marginBottom: 8 }}>
                Ou crée une nouvelle catégorie :
              </div>
              <div className="col" style={{ gap: 10 }}>
                <Input value={addCatName} onChange={(e) => setAddCatName(e.target.value)} placeholder="Nom de catégorie" />
                <Input value={addCatColor} onChange={(e) => setAddCatColor(e.target.value)} placeholder="#RRGGBB" />
                {addCatErr ? <div style={{ color: "rgba(255,120,120,.95)", fontSize: 13 }}>{addCatErr}</div> : null}
                <Button onClick={addCategory}>+ Ajouter une catégorie</Button>
              </div>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  function closeForm() {
    setIsAdding(false);
    setEditGoalId(null);
    setFormKind(null);
    setErr("");
    setOverlapError(null);
    lastScrollRef.current = null;
  }

  function saveGoal() {
    const title = (draftTitle || "").trim();
    if (!title) return setErr("Titre requis.");

    const goalType = draftGoalType === "OUTCOME" ? "OUTCOME" : "PROCESS";
    const planType = goalType === "OUTCOME" ? "STATE" : draftPlanType || "ACTION";
    const existingGoal = editGoalId ? goals.find((g) => g.id === editGoalId) || null : null;

    // startAt only matters for PROCESS in overlap engine and activation scheduling
    const startDate = (draftStartDate || todayKey()).trim();
    const startTime = (draftStartTime || "09:00").trim() || "09:00";
    const startAt = `${startDate}T${startTime}`;

    let payload = {
      categoryId: c.id,
      title,
      type: goalType,
      planType,
      resetPolicy: draftResetPolicy || "invalidate",
      templateId: draftTemplateId || null,
      templateType: goalType === "OUTCOME" ? "GOAL" : "HABIT",
    };

    const createId = editGoalId ? null : uid();
    if (createId) payload.id = createId;

    // OUTCOME: allow deadline + metric. No habit fields, no parent links.
    if (goalType === "OUTCOME") {
      let deadline = (draftDeadline || "").trim();
      if (deadline && startDate && startDate > deadline) {
        return setErr("La date de début doit être avant la date limite.");
      }

      let metric = null;
      const unit = (draftMetricUnit || "").trim();
      const targetRaw = (draftMetricTarget || "").trim();
      const currentRaw = (draftMetricCurrent || "").trim();
      if (unit || targetRaw || currentRaw) {
        const targetValue = Number(targetRaw);
        if (!Number.isFinite(targetValue) || targetValue <= 0) return setErr("Valeur cible invalide.");
        const currentValue = currentRaw ? Number(currentRaw) : 0;
        if (!Number.isFinite(currentValue)) return setErr("Valeur actuelle invalide.");
        metric = { unit, targetValue, currentValue };
      }

      const measureType = (draftMeasureType || "").trim();
      const measureTargetRaw = (draftTargetValue || "").trim();
      const measureTarget = Number(measureTargetRaw);
      const hasMeasure = Boolean(measureType);
      if (hasMeasure && (!Number.isFinite(measureTarget) || measureTarget <= 0)) {
        return setErr("Valeur cible invalide.");
      }
      const existingCurrent =
        existingGoal && Number.isFinite(existingGoal.currentValue) ? existingGoal.currentValue : 0;

      payload = {
        ...payload,
        deadline,
        metric,
        measureType: hasMeasure ? measureType : null,
        targetValue: hasMeasure ? measureTarget : null,
        currentValue: hasMeasure ? existingCurrent : null,
        notes: (draftNotes || "").trim(),
        // keep clean
        parentId: null,
        primaryGoalId: null,
        weight: 0,
        cadence: undefined,
        target: undefined,
        freqCount: undefined,
        freqUnit: undefined,
        sessionMinutes: null,
        oneOffDate: undefined,
        startAt: undefined,
      };
    } else {
      // PROCESS: frequency/session/startAt. No metric/deadline/notes.
      if (!startDate) return setErr("Date de début requise.");

      let sessionMinutes = null;

      if (planType === "ACTION") {
        const rawCount = Number(draftFreqCount);
        const freqCount = Number.isFinite(rawCount) ? Math.max(1, Math.floor(rawCount)) : 0;
        if (!freqCount) return setErr("Fréquence requise.");
        const freqUnit = draftFreqUnit || "WEEK";
        const cadence = cadenceFromUnit(freqUnit);

        const rawMinutes = (draftSessionMinutes || "").trim();
        if (rawMinutes) {
          const minutes = Number(rawMinutes);
          if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) return setErr("Durée invalide (5 à 600 min).");
          sessionMinutes = Math.floor(minutes);
        } else {
          sessionMinutes = null;
        }

        payload = {
          ...payload,
          startAt,
          freqCount,
          freqUnit,
          cadence,
          target: freqCount,
          sessionMinutes,
          deadline: "",
          metric: null,
          notes: undefined,
          oneOffDate: undefined,
        };
      } else if (planType === "ONE_OFF") {
        const oneOffDate = (draftOneOffDate || "").trim();
        if (!oneOffDate) return setErr("Date de réalisation requise.");
        payload = {
          ...payload,
          startAt,
          oneOffDate,
          freqCount: undefined,
          freqUnit: undefined,
          cadence: undefined,
          target: undefined,
          sessionMinutes: null,
          deadline: "",
          metric: null,
          notes: undefined,
        };
      } else {
        // PROCESS never uses STATE in our separation model; convert to ACTION baseline
        const rawCount = Number(draftFreqCount);
        const freqCount = Number.isFinite(rawCount) ? Math.max(1, Math.floor(rawCount)) : 3;
        const freqUnit = draftFreqUnit || "WEEK";
        const cadence = cadenceFromUnit(freqUnit);
        payload = {
          ...payload,
          planType: "ACTION",
          startAt,
          freqCount,
          freqUnit,
          cadence,
          target: freqCount,
          sessionMinutes: null,
          deadline: "",
          metric: null,
          notes: undefined,
          oneOffDate: undefined,
        };
      }

      // Auto-link new habits to main goal
      if (!editGoalId && mainGoalId) {
        payload.parentId = mainGoalId;
        payload.primaryGoalId = mainGoalId;
        payload.weight = 100;
      }

      const overlap = preventOverlap(safeData, editGoalId || null, startAt, sessionMinutes);
      if (!overlap.ok) {
        setOverlapError(overlap.conflicts);
        return;
      }
      setOverlapError(null);
    }

    setData((prev) => {
      let next = editGoalId ? updateGoal(prev, editGoalId, payload) : createGoal(prev, payload);
      if (!editGoalId && goalType === "OUTCOME" && !mainGoalId && c?.id && createId) {
        const nextCategories = (next.categories || []).map((cat) => (cat.id === c.id ? { ...cat, mainGoalId: createId } : cat));
        next = {
          ...next,
          categories: nextCategories,
          ui: { ...(next.ui || {}), mainGoalId: createId },
        };
      }
      return next;
    });

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

  function deactivate(goal) {
  if (!goal?.id) return;
  setData((prev) => updateGoal(prev, goal.id, { status: "queued", activeSince: null }));
  setActivationError(null);
}

function onToggleActive(goal) {
  if (!goal?.id) return;

  const statusRaw = (goal.status || "").toString().toLowerCase();
  if (statusRaw === "active") {
    deactivate(goal);
    return;
  }

  let res;
  setData((prev) => {
    const r = activateGoal(prev, goal.id, { navigate: true, now: new Date() });
    res = r;
    const next = r && typeof r === "object" && "state" in r ? r.state : r;
    return next && typeof next === "object" ? next : prev;
  });

  if (res && typeof res === "object" && res.ok === false) {
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
      const r = activateGoal(scheduled.state, goalId, { navigate: true, now });
      res = r;
      const next = r && typeof r === "object" && "state" in r ? r.state : r;
      return next && typeof next === "object" ? next : scheduled.state;
    });
    if (res && typeof res === "object" && res.ok === false) {
      setActivationError({ ...res, goalId });
      return;
    }
    setActivationError(null);
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle={<span className="textAccent">Outils</span>}
      headerSubtitle={c?.name || "Catégorie"}
      backgroundImage={c?.wallpaper || safeData.profile?.whyImage || ""}
    >
      <div style={getCategoryAccentVars(c?.color)}>
        <div className="mt12">
          <FocusCategoryPicker
            categories={categories}
            value={c?.id || ""}
            onChange={(nextId) => {
              if (!nextId || nextId === c?.id) return;
              setData((prev) => {
                const prevUi = prev.ui || {};
                const prevSel =
                  prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
                    ? prevUi.selectedCategoryByView
                    : {};
                return {
                  ...prev,
                  ui: {
                    ...prevUi,
                    selectedCategoryByView: { ...prevSel, plan: nextId },
                  },
                };
              });
              if (typeof onSelectCategory === "function") onSelectCategory(nextId);
            }}
            label="Catégorie"
            emptyLabel="À configurer"
            selectWrapperClassName="catAccentField"
            containerClassName="catAccentRow"
          />
        </div>

        <Card className="catAccentRow" style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="sectionTitle">Timer</div>
            <div className="sectionSub">Bientôt disponible.</div>
          </div>
        </Card>

        <Card className="catAccentRow" style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="sectionTitle">Notifications</div>
            <div className="sectionSub">Bientôt disponible.</div>
          </div>
        </Card>

        <Card className="catAccentRow" style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="sectionTitle">Calendrier</div>
            <div className="sectionSub">Bientôt disponible.</div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
