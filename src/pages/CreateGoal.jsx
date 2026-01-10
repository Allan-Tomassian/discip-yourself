import React, { useEffect, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select } from "../components/UI";
import { uid } from "../utils/helpers";
import { createGoal } from "../logic/goals";
import { setPrimaryGoalForCategory } from "../logic/priority";

// TOUR MAP:
// - primary_action: create objective
// - key_elements: category select, title input, priority toggle, submit/cancel
// - optional_elements: deadline and measure inputs
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

export default function CreateGoal({ data, setData, onCancel, onDone, initialCategoryId }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const [categoryId, setCategoryId] = useState(() => initialCategoryId || categories[0]?.id || "");
  const [title, setTitle] = useState("");

  // Planning (objective rhythm)
  const [planType, setPlanType] = useState("weekly"); // weekly | daily | custom
  const [planStartDate, setPlanStartDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [planTime, setPlanTime] = useState("09:00");
  const [planDaysOfWeek, setPlanDaysOfWeek] = useState([1, 3, 5]); // 1=Mon..7=Sun

  // Optional deadline (kept for outcome tracking)
  const [deadline, setDeadline] = useState("");

  const [measureType, setMeasureType] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [isPriority, setIsPriority] = useState(false);

  useEffect(() => {
    if (!categories.length) return;
    if (initialCategoryId && categories.some((c) => c.id === initialCategoryId)) {
      if (categoryId !== initialCategoryId) setCategoryId(initialCategoryId);
      return;
    }
    if (!categoryId) setCategoryId(categories[0].id);
  }, [categories, categoryId, initialCategoryId]);

  const canSubmit = Boolean(categoryId && title.trim());

  function toggleDow(day) {
    setPlanDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function addDays(dateObj, days) {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + days);
    return d;
  }

  function formatDateKey(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function jsDowToAppDow(jsDow) {
    // JS: 0=Sun..6=Sat -> App: 1=Mon..7=Sun
    return jsDow === 0 ? 7 : jsDow;
  }

  function buildPlannedDates({ startDateKey, planType, daysOfWeek }) {
    // Generate a short horizon to feed the calendar immediately.
    // We keep it simple and safe: 30 days ahead.
    const start = new Date(`${startDateKey}T12:00:00`);
    if (Number.isNaN(start.getTime())) return [];

    const result = [];
    for (let i = 0; i < 30; i += 1) {
      const d = addDays(start, i);
      const key = formatDateKey(d);
      if (planType === "daily") {
        result.push(key);
        continue;
      }
      if (planType === "weekly") {
        const dow = jsDowToAppDow(d.getDay());
        if (Array.isArray(daysOfWeek) && daysOfWeek.length && daysOfWeek.includes(dow)) result.push(key);
        continue;
      }
      // custom: only the start date for now (keeps UX simple and avoids unexpected spam)
      if (planType === "custom") {
        result.push(startDateKey);
        break;
      }
    }
    return Array.from(new Set(result));
  }

  function handleCreate() {
    if (!canSubmit || typeof setData !== "function") return;
    const cleanTitle = title.trim();
    const cleanDeadline = (deadline || "").trim();
    const cleanMeasure = (measureType || "").trim();
    const targetRaw = (targetValue || "").trim();
    const parsedTarget = Number(targetRaw);
    const hasTarget = Number.isFinite(parsedTarget) && parsedTarget > 0;
    const id = uid();

    setData((prev) => {
      let next = createGoal(prev, {
        id,
        categoryId,
        title: cleanTitle,
        type: "OUTCOME",
        planType: "STATE",

        // Planning captured at creation time
        schedule: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
          daysOfWeek: planType === "weekly" ? planDaysOfWeek : [],
          timeSlots: planTime ? [planTime] : [],
          remindersEnabled: false,
        },
        startAt: planStartDate ? `${planStartDate}T${planTime || "09:00"}` : null,

        // Optional deadline for the outcome itself
        deadline: cleanDeadline,

        measureType: cleanMeasure || null,
        targetValue: hasTarget && cleanMeasure ? parsedTarget : null,
        currentValue: hasTarget && cleanMeasure ? 0 : null,
        priority: isPriority ? "prioritaire" : "secondaire",
      });

      // Generate occurrences so the calendar can show planned days immediately.
      const plannedDates = buildPlannedDates({
        startDateKey: planStartDate,
        planType,
        daysOfWeek: planDaysOfWeek,
      });
      if (plannedDates.length) {
        const prevOcc = Array.isArray(next.occurrences) ? next.occurrences : [];
        const existingKey = new Set(prevOcc.map((o) => `${o?.goalId || ""}|${o?.date || ""}|${o?.start || ""}`));
        const additions = [];
        for (const dateKey of plannedDates) {
          const k = `${id}|${dateKey}|${planTime || "09:00"}`;
          if (existingKey.has(k)) continue;
          additions.push({
            id: uid(),
            goalId: id,
            date: dateKey,
            start: planTime || "09:00",
            durationMinutes: null,
            status: "planned",
          });
        }
        if (additions.length) next = { ...next, occurrences: [...prevOcc, ...additions] };
      }

      if (isPriority) next = setPrimaryGoalForCategory(next, categoryId, id);
      return next;
    });

    if (typeof onDone === "function") onDone({ goalId: id, categoryId });
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle={<span data-tour-id="create-goal-title">Créer</span>}
      headerSubtitle={
        <>
          <span style={{ opacity: 0.6 }}>2.</span> Objectif
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button
          variant="ghost"
          className="btnBackCompact backBtn"
          onClick={() => (typeof onCancel === "function" ? onCancel() : null)}
          data-tour-id="create-goal-back"
        >
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 10 }}>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ fontSize: 16 }}
              data-tour-id="create-goal-category"
            >
              <option value="" disabled>
                Sélectionner une catégorie
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "Catégorie"}
                </option>
              ))}
            </Select>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom de l’objectif"
              data-tour-id="create-goal-title-input"
            />
            <div className="listItem" style={{ padding: 12 }}>
              <div className="titleSm" style={{ marginBottom: 6 }}>
                Rythme (planification)
              </div>

              <Select value={planType} onChange={(e) => setPlanType(e.target.value)} style={{ fontSize: 16 }}>
                <option value="weekly">Hebdomadaire</option>
                <option value="daily">Quotidien</option>
                <option value="custom">Date unique</option>
              </Select>

              <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px" }}>
                  <div className="small" style={{ marginBottom: 6 }}>
                    Début
                  </div>
                  <Input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} />
                </div>
                <div style={{ flex: "1 1 140px" }}>
                  <div className="small" style={{ marginBottom: 6 }}>
                    Heure
                  </div>
                  <Input type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)} />
                </div>
              </div>

              {planType === "weekly" ? (
                <div style={{ marginTop: 10 }}>
                  <div className="small" style={{ marginBottom: 8, opacity: 0.8 }}>
                    Jours
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const labels = { 1: "L", 2: "M", 3: "M", 4: "J", 5: "V", 6: "S", 7: "D" };
                      const active = planDaysOfWeek.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          className={active ? "pill active" : "pill"}
                          onClick={() => toggleDow(d)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,.16)",
                            background: active ? "rgba(124,58,237,.22)" : "transparent",
                            color: "inherit",
                          }}
                        >
                          {labels[d]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="small2" style={{ marginTop: 8, opacity: 0.7 }}>
                    L’objectif sera visible dans le calendrier sur ces jours.
                  </div>
                </div>
              ) : null}

              {planType === "custom" ? (
                <div className="small2" style={{ marginTop: 8, opacity: 0.7 }}>
                  Une seule occurrence sera ajoutée au calendrier (date de début).
                </div>
              ) : null}
            </div>

            <div className="listItem" style={{ padding: 12 }}>
              <div className="titleSm" style={{ marginBottom: 6 }}>
                Échéance (optionnel)
              </div>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                data-tour-id="create-goal-deadline"
              />
              <div className="small2" style={{ marginTop: 6, opacity: 0.7 }}>
                L’échéance mesure le résultat final. Le rythme sert à planifier l’exécution.
              </div>
            </div>
            <Select
              value={measureType}
              onChange={(e) => setMeasureType(e.target.value)}
              style={{ fontSize: 16 }}
              data-tour-id="create-goal-measure"
            >
              <option value="">Type de mesure</option>
              {MEASURE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            {measureType ? (
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={getMeasurePlaceholder(measureType)}
                data-tour-id="create-goal-target"
              />
            ) : null}
            <label className="includeToggle" data-tour-id="create-goal-priority">
              <input type="checkbox" checked={isPriority} onChange={(e) => setIsPriority(e.target.checked)} />
              <span>Prioritaire</span>
            </label>

          {!categories.length ? (
            <div className="small2">Aucune catégorie disponible.</div>
          ) : null}

            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="ghost"
                onClick={() => (typeof onCancel === "function" ? onCancel() : null)}
                data-tour-id="create-goal-cancel"
              >
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={!canSubmit} data-tour-id="create-goal-submit">
                Créer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
