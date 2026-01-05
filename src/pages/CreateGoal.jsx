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
        deadline: cleanDeadline,
        measureType: cleanMeasure || null,
        targetValue: hasTarget && cleanMeasure ? parsedTarget : null,
        currentValue: hasTarget && cleanMeasure ? 0 : null,
        priority: isPriority ? "prioritaire" : "secondaire",
      });

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
      <div className="col">
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
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              data-tour-id="create-goal-deadline"
            />
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
