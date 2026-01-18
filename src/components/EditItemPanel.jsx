import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input, Select, Textarea } from "./UI";
import { todayKey } from "../utils/dates";
import { toLocalDateKey } from "../utils/dateKey";
import { createDefaultGoalSchedule } from "../logic/state";

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
      date: toLocalDateKey(dt),
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
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function resolvePriority(item) {
  const raw = typeof item?.priority === "string" ? item.priority : "";
  if (PRIORITY_OPTIONS.some((opt) => opt.value === raw)) return raw;
  const level = typeof item?.priorityLevel === "string" ? item.priorityLevel.toLowerCase() : "";
  if (level === "primary") return "prioritaire";
  if (level === "secondary") return "secondaire";
  const tier = typeof item?.priorityTier === "string" ? item.priorityTier.toLowerCase() : "";
  if (tier === "essential") return "prioritaire";
  if (tier === "optional" || tier === "someday") return "bonus";
  return "secondaire";
}

export default function EditItemPanel({ item, type, onSave, onDelete, onClose }) {
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
    if (!item) return undefined;
    if (typeof document === "undefined") return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [item]);

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
  }, [item, isProcess, canUseReminders]);

  const normalizedReminderTimes = useMemo(() => normalizeTimes(reminderTimes), [reminderTimes]);

  if (!item || typeof document === "undefined") return null;

  function toggleDay(day) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function updateReminderTime(index, value) {
    setReminderTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function addReminderTime() {
    setReminderTimes((prev) => [...prev, "09:00"]);
  }

  function removeReminderTime(index) {
    setReminderTimes((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    const cleanTitle = (title || "").trim();
    if (!cleanTitle) {
      setError("Titre requis.");
      return;
    }

    const updates = {
      title: cleanTitle,
      priority,
    };

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

    if (typeof onSave === "function") {
      const payload = { updates };
      if (isProcess) {
        const enabled = remindersEnabled && canUseReminders;
        payload.reminderConfig = {
          enabled,
          times: normalizedReminderTimes,
          channel: reminderChannel,
          days: normalizeDays(daysOfWeek),
          label: cleanTitle,
        };
      }
      onSave(payload);
    }
  }

  const overlay = (
    <div
      className="modalBackdrop drawerBackdrop"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        className="drawerPanel editPanel"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          height: "100dvh",
          minHeight: "100vh",
          maxWidth: 420,
          width: "min(92vw, 420px)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="drawerHeader">
          <div style={{ fontWeight: 800 }}>{isProcess ? "Modifier l’action" : "Modifier l’objectif"}</div>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>

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
                      <div>
                        <div className="small" style={{ marginBottom: 6 }}>
                          Date / heure
                        </div>
                        <div className="grid2">
                          <Input type="date" value={oneOffDate} onChange={(e) => setOneOffDate(e.target.value)} />
                          <Input type="time" value={oneOffTime} onChange={(e) => setOneOffTime(e.target.value)} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="small" style={{ marginBottom: 6 }}>
                            Date / heure de départ
                          </div>
                          <div className="grid2">
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                          </div>
                        </div>

                        <div>
                          <div className="small" style={{ marginBottom: 6 }}>
                            Fréquence
                          </div>
                          <div className="row" style={{ gap: 10 }}>
                            <Input
                              type="number"
                              min="1"
                              value={freqCount}
                              onChange={(e) => setFreqCount(e.target.value)}
                              placeholder="Nombre"
                            />
                            <Select value={freqUnit} onChange={(e) => setFreqUnit(e.target.value)}>
                              <option value="DAY">par jour</option>
                              <option value="WEEK">par semaine</option>
                              <option value="MONTH">par mois</option>
                              <option value="QUARTER">par trimestre</option>
                              <option value="YEAR">par an</option>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <div className="small" style={{ marginBottom: 6 }}>
                            Jours
                          </div>
                          <div className="editDaysRow">
                            {DAY_OPTIONS.map((day) => (
                              <label key={day.value} className="editDayOption">
                                <input
                                  type="checkbox"
                                  checked={daysOfWeek.includes(day.value)}
                                  onChange={() => toggleDay(day.value)}
                                />
                                <span>{day.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="small" style={{ marginBottom: 6 }}>
                            Durée
                          </div>
                          <Input
                            type="number"
                            min="5"
                            max="600"
                            value={sessionMinutes}
                            onChange={(e) => setSessionMinutes(e.target.value)}
                            placeholder="Minutes"
                          />
                        </div>

                        <div>
                          <div className="small" style={{ marginBottom: 6 }}>
                            Fenêtre temporelle
                          </div>
                          <div className="grid2">
                            <Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
                            <Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <div className="small" style={{ marginBottom: 6 }}>
                        Type de mesure
                      </div>
                      <Select value={measureType} onChange={(e) => setMeasureType(e.target.value)} style={{ fontSize: 16 }}>
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
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isProcess ? "Notes (optionnel)" : "Notes (optionnel)"}
              />
            </div>
          </div>

          <div className="editSection">
            <div className="editSectionTitle">Zone sensible</div>
            <div className="editSectionBody">
              <Button variant="danger" onClick={onDelete}>
                Supprimer
              </Button>
            </div>
          </div>

          {error ? <div className="small2" style={{ color: "rgba(255,120,120,.95)" }}>{error}</div> : null}
        </div>

        <div className="editPanelFooter">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </div>
      </div>
    </div>
  );
  return createPortal(overlay, document.body);
}
