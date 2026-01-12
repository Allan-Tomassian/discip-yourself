import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select, Textarea } from "../components/UI";
import { safeConfirm } from "../utils/dialogs";
import { todayKey } from "../utils/dates";
import { uid } from "../utils/helpers";
import { createDefaultGoalSchedule } from "../logic/state";
import { updateGoal } from "../logic/goals";
import { setPrimaryGoalForCategory } from "../logic/priority";
import { resolveGoalType } from "../utils/goalType";

const PRIORITY_OPTIONS = [
  { value: "prioritaire", label: "Prioritaire" },
  { value: "secondaire", label: "Secondaire" },
  { value: "bonus", label: "Bonus" },
];

const MEASURE_OPTIONS = [
  { value: "money", label: "💰 Argent" },
  { value: "counter", label: "🔢 Compteur" },
  { value: "time", label: "⏱️ Temps" },
  { value: "energy", label: "⚡ Énergie" },
  { value: "distance", label: "📏 Distance" },
  { value: "weight", label: "⚖️ Poids" },
];

const DAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

const CHANNEL_OPTIONS = [
  { value: "IN_APP", label: "Dans l’app" },
  { value: "NOTIFICATION", label: "Notification" },
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

function resolvePlanType(item) {
  const rawPlan = typeof item?.planType === "string" ? item.planType.toUpperCase() : "";
  if (rawPlan === "ACTION" || rawPlan === "ONE_OFF" || rawPlan === "STATE") return rawPlan;
  const rawType = typeof item?.type === "string" ? item.type.toUpperCase() : "";
  if (rawType === "ACTION" || rawType === "ONE_OFF" || rawType === "STATE") return rawType;
  if (item?.oneOffDate || item?.freqUnit === "ONCE") return "ONE_OFF";
  if (item?.freqUnit || item?.freqCount || item?.cadence) return "ACTION";
  return "STATE";
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

function buildStartAt(date, time) {
  const cleanDate = (date || "").trim();
  if (!cleanDate) return "";
  const cleanTime = (time || "09:00").trim() || "09:00";
  return `${cleanDate}T${cleanTime}`;
}

function resolveFrequency(item) {
  const rawCount =
    typeof item?.freqCount === "number"
      ? item.freqCount
      : typeof item?.target === "number"
        ? item.target
        : 1;
  const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 1;
  let unit = typeof item?.freqUnit === "string" ? item.freqUnit.toUpperCase() : "";
  if (!unit || unit === "ONCE") {
    const cadence = typeof item?.cadence === "string" ? item.cadence.toUpperCase() : "";
    unit = cadence === "DAILY" ? "DAY" : cadence === "YEARLY" ? "YEAR" : "WEEK";
  }
  return { count, unit };
}

function cadenceFromUnit(unit) {
  if (unit === "DAY") return "DAILY";
  if (unit === "YEAR") return "YEARLY";
  return "WEEKLY";
}

function normalizeDays(days) {
  if (!Array.isArray(days) || days.length === 0) return createDefaultGoalSchedule().daysOfWeek;
  const cleaned = days.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d >= 1 && d <= 7);
  return cleaned.length ? cleaned : createDefaultGoalSchedule().daysOfWeek;
}

function normalizeTimes(times) {
  if (!Array.isArray(times)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of times) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function resolvePriority(item) {
  const raw = typeof item?.priority === "string" ? item.priority.toLowerCase() : "";
  if (PRIORITY_OPTIONS.some((opt) => opt.value === raw)) return raw;

  // legacy mappings
  const level = typeof item?.priorityLevel === "string" ? item.priorityLevel.toLowerCase() : "";
  if (level === "primary") return "prioritaire";
  if (level === "secondary") return "secondaire";

  const tier = typeof item?.priorityTier === "string" ? item.priorityTier.toLowerCase() : "";
  if (tier === "essential") return "prioritaire";
  if (tier === "optional" || tier === "someday") return "bonus";

  return "secondaire";
}

function buildOccurrencesByGoal(list) {
  const entries = Array.isArray(list) ? list : [];
  const map = new Map();
  for (const occ of entries) {
    if (!occ || typeof occ.goalId !== "string") continue;
    const bucket = map.get(occ.goalId) || [];
    bucket.push(occ);
    map.set(occ.goalId, bucket);
  }
  return map;
}

function buildPlanSignature(goal, occurrencesByGoal) {
  if (!goal) return "";
  const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
  const scheduleSig = schedule
    ? JSON.stringify({
        daysOfWeek: Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [],
        timeSlots: Array.isArray(schedule.timeSlots) ? schedule.timeSlots : [],
        durationMinutes: Number.isFinite(schedule.durationMinutes) ? schedule.durationMinutes : null,
        windowStart: schedule.windowStart || "",
        windowEnd: schedule.windowEnd || "",
      })
    : "";
  const occurrences = occurrencesByGoal?.get(goal.id) || [];
  const occurrenceSig = occurrences
    .map((occ) => `${occ?.date || ""}|${occ?.start || ""}|${occ?.status || ""}`)
    .sort()
    .join(",");
  return `${goal.planType || ""}|${goal.startAt || ""}|${scheduleSig}|${occurrenceSig}`;
}

function updateRemindersForGoal(state, goalId, config, fallbackLabel, options = {}) {
  const base = Array.isArray(state?.reminders) ? state.reminders : [];
  const others = base.filter((r) => r.goalId !== goalId);
  const goal = Array.isArray(state?.goals) ? state.goals.find((g) => g?.id === goalId) : null;
  const goalType = resolveGoalType(goal);
  if (goalType !== "PROCESS") return others;

  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const goalOccurrences = occurrences.filter((occ) => occ?.goalId === goalId);
  const hasOccurrences = goalOccurrences.length > 0;
  const schedule = goal && typeof goal.schedule === "object" ? goal.schedule : null;
  const scheduleSlots = Array.isArray(schedule?.timeSlots) ? schedule.timeSlots : [];
  const scheduleDays =
    Array.isArray(schedule?.daysOfWeek) && schedule.daysOfWeek.length ? schedule.daysOfWeek : [1, 2, 3, 4, 5, 6, 7];
  const canUseReminders = hasOccurrences || scheduleSlots.length > 0;
  if (!config || !config.enabled || !canUseReminders) return others;

  const channel = config.channel === "NOTIFICATION" ? "NOTIFICATION" : "IN_APP";
  const label = config.label || fallbackLabel || "Rappel";
  const requestedTimes = Array.isArray(config.times) ? config.times : [];
  const occurrenceTimes = [
    ...new Set(goalOccurrences.map((occ) => (typeof occ?.start === "string" ? occ.start : "")).filter(Boolean)),
  ];
  const times = hasOccurrences
    ? occurrenceTimes.length
      ? occurrenceTimes
      : requestedTimes.length
        ? requestedTimes
        : ["09:00"]
    : scheduleSlots;
  const safeTimes = times.filter((t) => typeof t === "string" && t.trim().length);
  if (!safeTimes.length) return others;

  const existing = base.filter((r) => r.goalId === goalId);
  const forceNewIds = options?.forceNewIds === true;
  const nextForGoal = safeTimes.map((time, index) => {
    const prev = !forceNewIds ? existing[index] : null;
    return {
      id: prev?.id || uid(),
      goalId,
      time,
      enabled: true,
      channel,
      days: scheduleDays,
      label: prev?.label || label,
    };
  });

  return [...others, ...nextForGoal];
}

export default function EditItem({ data, setData, editItem, onBack }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const reminders = Array.isArray(safeData.reminders) ? safeData.reminders : [];
  const occurrences = Array.isArray(safeData.occurrences) ? safeData.occurrences : [];

  const rawItem = useMemo(() => {
    if (!editItem?.id) return null;
    return goals.find((g) => g?.id === editItem.id) || null;
  }, [editItem?.id, goals]);

  const item = useMemo(() => {
    if (!rawItem) return null;
    const itemReminders = Array.isArray(reminders) ? reminders.filter((r) => r?.goalId === rawItem.id) : [];
    const itemOccurrences = Array.isArray(occurrences) ? occurrences.filter((o) => o && o.goalId === rawItem.id) : [];
    return { ...rawItem, _reminders: itemReminders, _occurrences: itemOccurrences };
  }, [rawItem, reminders, occurrences]);

  const type = resolveGoalType(rawItem);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("secondaire");
  const [planType, setPlanType] = useState("ACTION");
  const [freqCount, setFreqCount] = useState("1");
  const [freqUnit, setFreqUnit] = useState("WEEK");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [oneOffDate, setOneOffDate] = useState("");
  const [oneOffTime, setOneOffTime] = useState("09:00");
  const [sessionMinutes, setSessionMinutes] = useState("30");
  const [daysOfWeek, setDaysOfWeek] = useState(createDefaultGoalSchedule().daysOfWeek);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState(["09:00"]);
  const [reminderChannel, setReminderChannel] = useState("IN_APP");
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [measureType, setMeasureType] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [error, setError] = useState("");
  const [planOpen, setPlanOpen] = useState(false);

  const isProcess = type === "PROCESS";
  const hasOccurrenceSource = Array.isArray(item?._occurrences) && item._occurrences.length > 0;
  const hasScheduleSource =
    isProcess && item?.schedule && Array.isArray(item.schedule.timeSlots) && item.schedule.timeSlots.length > 0;
  const canUseReminders = hasOccurrenceSource || hasScheduleSource;

  useEffect(() => {
    if (!item) return;
    const resolvedPlan = isProcess ? resolvePlanType(item) : "STATE";
    const freq = resolveFrequency(item);
    const parsed = parseStartAt(item.startAt || item.startDate || "");
    const scheduleBase = createDefaultGoalSchedule();
    const schedule =
      item.schedule && typeof item.schedule === "object"
        ? { ...scheduleBase, ...item.schedule }
        : { ...scheduleBase };
    const scheduleDays = normalizeDays(schedule.daysOfWeek);
    const timeSlots = Array.isArray(schedule.timeSlots) && schedule.timeSlots.length ? schedule.timeSlots : ["09:00"];
    const reminderItems = Array.isArray(item._reminders) ? item._reminders : [];
    const reminderTimesRaw = reminderItems.length ? reminderItems.map((r) => r.time) : [];
    const reminderTimesClean = normalizeTimes(reminderTimesRaw);
    const reminderEnabled =
      reminderItems.length > 0 ? reminderItems.some((r) => r.enabled !== false) : Boolean(schedule.remindersEnabled);
    const reminderChannelRaw = reminderItems.find((r) => r?.channel)?.channel || "IN_APP";
    const windowStartValue = schedule.windowStart || timeSlots[0] || "09:00";
    const windowEndValue = schedule.windowEnd || timeSlots[1] || "18:00";

    setTitle(item.title || "");
    setPriority(resolvePriority(item));
    setPlanType(resolvedPlan);
    setFreqCount(String(freq.count || 1));
    setFreqUnit(freq.unit || "WEEK");
    setStartDate(parsed.date || todayKey());
    setStartTime(parsed.time || "09:00");
    setOneOffDate(item.oneOffDate || "");
    setOneOffTime(parsed.time || "09:00");
    setSessionMinutes(
      Number.isFinite(item.sessionMinutes)
        ? String(item.sessionMinutes)
        : Number.isFinite(schedule.durationMinutes)
          ? String(schedule.durationMinutes)
          : "30"
    );
    setDaysOfWeek(scheduleDays);
    setWindowStart(windowStartValue);
    setWindowEnd(windowEndValue);
    setRemindersEnabled(reminderEnabled && canUseReminders);
    setReminderTimes(reminderTimesClean.length ? reminderTimesClean : ["09:00"]);
    setReminderChannel(reminderChannelRaw);
    setNotes(isProcess ? item.habitNotes || "" : item.notes || "");
    setDeadline(item.deadline || "");
    setMeasureType(item.measureType || "");
    setTargetValue(item.targetValue != null ? String(item.targetValue) : "");
    setError("");
    setPlanOpen(false);
  }, [item?.id]);

  const normalizedReminderTimes = useMemo(() => normalizeTimes(reminderTimes), [reminderTimes]);

  if (!item) {
    return (
      <ScreenShell
        headerTitle={<span className="textAccent">Modifier</span>}
        headerSubtitle={
          <div className="stack stackGap12">
            <div>Élément introuvable</div>
            <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
              ← Retour
            </Button>
          </div>
        }
        backgroundImage={backgroundImage}
      >
        <div className="stack stackGap12">
          <Card>
            <div className="p18">
              <div className="small2">Impossible de retrouver cet élément.</div>
            </div>
          </Card>
        </div>
      </ScreenShell>
    );
  }

  function toggleDay(day) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function updateReminderTime(index, value) {
    setReminderTimes((prev) => {
      const next = prev.slice();
      next[index] = value;
      return next;
    });
  }

  function removeReminderTime(index) {
    setReminderTimes((prev) => prev.filter((_, i) => i !== index));
  }

  function addReminderTime() {
    setReminderTimes((prev) => [...prev, "09:00"]);
  }

  function handleSave() {
    const cleanTitle = (title || "").trim();
    if (!cleanTitle) {
      setError("Titre requis.");
      return;
    }
    setError("");

    const updates = {
      title: cleanTitle,
      priority,
    };
    // legacy backfill (kept for compatibility)
    updates.priorityLevel = priority === "prioritaire" ? "primary" : priority === "secondaire" ? "secondary" : "bonus";

    if (isProcess) {
      const plan = planType === "ONE_OFF" ? "ONE_OFF" : "ACTION";
      const startAt =
        plan === "ONE_OFF"
          ? buildStartAt(oneOffDate || startDate, oneOffTime || startTime)
          : buildStartAt(startDate, startTime);
      const parsedCount = Number(freqCount);
      const safeCount = Number.isFinite(parsedCount) && parsedCount > 0 ? Math.floor(parsedCount) : 1;
      const minutesRaw = Number(sessionMinutes);
      const safeMinutes = Number.isFinite(minutesRaw) && minutesRaw > 0 ? Math.round(minutesRaw) : 30;
      const scheduleBase = createDefaultGoalSchedule();
      const days = normalizeDays(daysOfWeek);
      const timeSlots = normalizeTimes([windowStart || scheduleBase.timeSlots[0]]).length
        ? normalizeTimes([windowStart || scheduleBase.timeSlots[0]])
        : scheduleBase.timeSlots;
      const schedule =
        plan === "ACTION"
          ? {
              ...scheduleBase,
              ...item.schedule,
              daysOfWeek: days,
              timeSlots,
              durationMinutes: safeMinutes,
              remindersEnabled,
              windowStart: windowStart || scheduleBase.timeSlots[0],
              windowEnd: windowEnd || scheduleBase.timeSlots[0],
            }
          : undefined;

      updates.planType = plan;
      updates.startAt = startAt || null;
      updates.sessionMinutes = safeMinutes;
      updates.oneOffDate = plan === "ONE_OFF" ? (oneOffDate || "") : undefined;
      updates.freqCount = plan === "ACTION" ? safeCount : undefined;
      updates.freqUnit = plan === "ACTION" ? freqUnit || "WEEK" : undefined;
      updates.cadence = plan === "ACTION" ? cadenceFromUnit(freqUnit || "WEEK") : undefined;
      updates.target = plan === "ACTION" ? safeCount : undefined;
      updates.schedule = schedule;
      updates.habitNotes = (notes || "").trim();
    } else {
      const cleanMeasure = (measureType || "").trim();
      const rawTarget = (targetValue || "").trim();
      const parsedTarget = Number(rawTarget);
      const hasTarget = Boolean(cleanMeasure) && Number.isFinite(parsedTarget) && parsedTarget > 0;
      updates.deadline = (deadline || "").trim();
      updates.measureType = cleanMeasure || null;
      updates.targetValue = hasTarget ? parsedTarget : null;
      updates.currentValue = hasTarget
        ? Number.isFinite(item.currentValue)
          ? item.currentValue
          : 0
        : null;
      updates.notes = (notes || "").trim();
      updates.priority = priority;
    }

    const reminderConfig = isProcess
      ? {
          enabled: remindersEnabled && canUseReminders,
          times: normalizedReminderTimes,
          channel: reminderChannel,
          days: normalizeDays(daysOfWeek),
          label: cleanTitle,
        }
      : null;

    if (typeof setData === "function") {
      const goalId = item.id;
      const categoryId = item.categoryId;
      setData((prev) => {
        const prevOccurrencesByGoal = buildOccurrencesByGoal(prev?.occurrences);
        const prevGoal = Array.isArray(prev?.goals) ? prev.goals.find((g) => g?.id === goalId) : null;
        const prevPlanSig = buildPlanSignature(prevGoal, prevOccurrencesByGoal);

        let next = updateGoal(prev, goalId, updates);
        if (type === "OUTCOME" && updates.priority === "prioritaire" && categoryId) {
          next = setPrimaryGoalForCategory(next, categoryId, goalId);
        }

        const nextOccurrencesByGoal = buildOccurrencesByGoal(next?.occurrences);
        const nextGoal = Array.isArray(next?.goals) ? next.goals.find((g) => g?.id === goalId) : null;
        const nextPlanSig = buildPlanSignature(nextGoal, nextOccurrencesByGoal);
        const planChanged = prevPlanSig !== nextPlanSig;

        if (type === "OUTCOME") {
          if (Array.isArray(next.reminders)) {
            const filtered = next.reminders.filter((r) => r.goalId !== goalId);
            if (filtered.length !== next.reminders.length) {
              next = { ...next, reminders: filtered };
            }
          }
        } else if (reminderConfig) {
          const label = updates.title || item.title || "Rappel";
          const nextReminders = updateRemindersForGoal(next, goalId, reminderConfig, label, { forceNewIds: planChanged });
          next = { ...next, reminders: nextReminders };
        }
        return next;
      });
    }

    if (typeof onBack === "function") onBack();
  }

  function handleDelete() {
    if (!item?.id || typeof setData !== "function") return;
    const ok = safeConfirm("Supprimer cet élément ?");
    if (!ok) return;
    const goalId = item.id;
    setData((prev) => {
      const goal = (prev.goals || []).find((g) => g.id === goalId);
      const isOutcome = resolveGoalType(goal) === "OUTCOME";
      let nextGoals = (prev.goals || []).filter((g) => g.id !== goalId);
      if (isOutcome) nextGoals = nextGoals.filter((g) => g.parentId !== goalId);
      const nextCategories = (prev.categories || []).map((cat) =>
        cat.mainGoalId === goalId ? { ...cat, mainGoalId: null } : cat
      );
      const nextUi = { ...(prev.ui || {}) };
      if (nextUi.sessionDraft?.objectiveId === goalId) nextUi.sessionDraft = null;
      if (nextUi.activeSession?.habitIds) {
        const kept = nextUi.activeSession.habitIds.filter((id) => nextGoals.some((g) => g.id === id));
        nextUi.activeSession = kept.length ? { ...nextUi.activeSession, habitIds: kept } : null;
      }
      return {
        ...prev,
        goals: nextGoals,
        categories: nextCategories,
        ui: nextUi,
      };
    });
    if (typeof onBack === "function") onBack();
  }

  return (
    <ScreenShell
      headerTitle={<span className="textAccent">Modifier</span>}
      headerSubtitle={
        <div className="stack stackGap12">
          <div>{item.title || (isProcess ? "Action" : "Objectif")}</div>
          <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
            ← Retour
          </Button>
        </div>
      }
      headerRowAlign="start"
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Card>
          <div className="p18">
            <div className="editPanel">
          <div className="editPanelBody">
            <div className="editSection">
              <div className="editSectionTitle">Identité</div>
              <div className="editSectionBody">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
                <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="editSection">
              <button className="editSectionToggle" type="button" onClick={() => setPlanOpen((prev) => !prev)}>
                Plan
                <span>{planOpen ? "▾" : "▸"}</span>
              </button>
              {planOpen ? (
                <div className="editSectionBody">
                  {isProcess ? (
                    <>
                      <div>
                        <div className="small" style={{ marginBottom: 6 }}>
                          Type
                        </div>
                        <Select value={planType} onChange={(e) => setPlanType(e.target.value)}>
                          <option value="ONE_OFF">Ponctuel</option>
                          <option value="ACTION">Répétitif</option>
                        </Select>
                      </div>

                      {planType === "ONE_OFF" ? (
                        <>
                          <Input type="date" value={oneOffDate} onChange={(e) => setOneOffDate(e.target.value)} />
                          <Input type="time" value={oneOffTime} onChange={(e) => setOneOffTime(e.target.value)} />
                        </>
                      ) : (
                        <>
                          <div>
                            <div className="small" style={{ marginBottom: 6 }}>
                              Fréquence
                            </div>
                            <div className="row" style={{ gap: 10 }}>
                              <Input
                                type="number"
                                value={freqCount}
                                onChange={(e) => setFreqCount(e.target.value)}
                                style={{ maxWidth: 120 }}
                              />
                              <Select value={freqUnit} onChange={(e) => setFreqUnit(e.target.value)}>
                                <option value="DAY">Jour</option>
                                <option value="WEEK">Semaine</option>
                                <option value="YEAR">Mois</option>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <div className="small" style={{ marginBottom: 6 }}>
                              Jours
                            </div>
                            <div className="editDaysRow">
                              {DAY_OPTIONS.map((day) => (
                                <button
                                  key={day.value}
                                  type="button"
                                  className={`editDayOption${daysOfWeek.includes(day.value) ? " isActive" : ""}`}
                                  onClick={() => toggleDay(day.value)}
                                >
                                  {day.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="small" style={{ marginBottom: 6 }}>
                              Durée
                            </div>
                            <Input
                              type="number"
                              value={sessionMinutes}
                              onChange={(e) => setSessionMinutes(e.target.value)}
                            />
                          </div>
                          <div className="row" style={{ gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div className="small" style={{ marginBottom: 6 }}>
                                Fenêtre début
                              </div>
                              <Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="small" style={{ marginBottom: 6 }}>
                                Fenêtre fin
                              </div>
                              <Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
                            </div>
                          </div>
                          <div className="row" style={{ gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div className="small" style={{ marginBottom: 6 }}>
                                Date de départ
                              </div>
                              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="small" style={{ marginBottom: 6 }}>
                                Heure
                              </div>
                              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="small" style={{ marginBottom: 6 }}>
                          Mesure
                        </div>
                        <Select value={measureType} onChange={(e) => setMeasureType(e.target.value)}>
                          <option value="">Choisir</option>
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
                          onChange={(e) => setTargetValue(e.target.value)}
                          placeholder={getMeasurePlaceholder(measureType)}
                        />
                      ) : null}
                      <div>
                        <div className="small" style={{ marginBottom: 6 }}>
                          Date cible
                        </div>
                        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            {isProcess ? (
              <div className="editSection">
                <div className="editSectionTitle">Rappels</div>
                <div className="editSectionBody">
                  <label className="includeToggle">
                    <input
                      type="checkbox"
                      checked={remindersEnabled}
                      onChange={(e) => setRemindersEnabled(e.target.checked)}
                      disabled={!canUseReminders}
                    />
                    <span>Activer les rappels</span>
                  </label>
                  {remindersEnabled ? (
                    <>
                      <div className="editTimeList">
                        {reminderTimes.map((t, index) => (
                          <div key={`${t}-${index}`} className="editTimeRow">
                            <Input type="time" value={t} onChange={(e) => updateReminderTime(index, e.target.value)} />
                            {reminderTimes.length > 1 ? (
                              <Button variant="ghost" onClick={() => removeReminderTime(index)}>
                                Retirer
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      <Button variant="ghost" onClick={addReminderTime}>
                        + Ajouter une heure
                      </Button>
                      <Select value={reminderChannel} onChange={(e) => setReminderChannel(e.target.value)}>
                        {CHANNEL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="editSection">
              <div className="editSectionTitle">Notes</div>
              <div className="editSectionBody">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
              </div>
            </div>

            <div className="editSection">
              <div className="editSectionTitle">Zone sensible</div>
              <div className="editSectionBody">
                <Button variant="danger" onClick={handleDelete}>
                  Supprimer
                </Button>
              </div>
            </div>

            {error ? <div className="small2" style={{ color: "rgba(255,120,120,.95)" }}>{error}</div> : null}
          </div>

            <div className="editPanelFooter">
              <Button variant="ghost" onClick={onBack}>
                Annuler
              </Button>
              <Button onClick={handleSave}>Enregistrer</Button>
            </div>
          </div>
        </div>
      </Card>
      </div>
    </ScreenShell>
  );
}
