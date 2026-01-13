import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select } from "../components/UI";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";
import { resolveGoalType } from "../utils/goalType";

const MEASURE_OPTIONS = [
  { value: "money", label: "💰 Argent" },
  { value: "counter", label: "🔢 Compteur" },
  { value: "time", label: "⏱️ Temps" },
  { value: "energy", label: "⚡ Énergie" },
  { value: "distance", label: "📏 Distance" },
  { value: "weight", label: "⚖️ Poids" },
];

function getCategoryIdFromDraft(draft) {
  if (draft?.category?.mode === "existing") return draft.category.id || "";
  return "";
}

export default function CreateV2Outcome({ data, setData, onBack, onNext }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const hasCategory =
    draft?.category?.mode === "existing"
      ? Boolean(draft.category.id)
      : Boolean((draft?.category?.name || "").trim());
  const categoryId = getCategoryIdFromDraft(draft);
  const existingOutcomes = useMemo(() => {
    if (!categoryId) return [];
    return goals.filter((g) => g.categoryId === categoryId && resolveGoalType(g) === "OUTCOME");
  }, [goals, categoryId]);

  const initialMode = draft.outcome?.mode || (existingOutcomes.length ? "existing" : "new");
  const [mode, setMode] = useState(initialMode);
  const [selectedId, setSelectedId] = useState(draft.outcome?.id || existingOutcomes[0]?.id || "");
  const [title, setTitle] = useState(draft.outcome?.title || "");
  const [deadline, setDeadline] = useState(draft.outcome?.deadline || "");
  const [measureType, setMeasureType] = useState(draft.outcome?.measureType || "");
  const [targetValue, setTargetValue] = useState(draft.outcome?.targetValue || "");
  const [priority, setPriority] = useState(draft.outcome?.priority || "secondaire");

  const canSubmit = mode === "existing" ? Boolean(selectedId) : Boolean((title || "").trim());

  useEffect(() => {
    if (hasCategory) return;
    if (typeof onBack === "function") onBack();
  }, [hasCategory, onBack]);

  function updateDraft(nextOutcome) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            outcome: nextOutcome,
            step: STEP_HABITS,
          },
        },
      };
    });
  }

  function handleNext() {
    if (!canSubmit) return;
    if (mode === "existing") {
      updateDraft({ mode, id: selectedId });
    } else {
      updateDraft({
        mode,
        title: title.trim(),
        deadline: (deadline || "").trim(),
        measureType: measureType || "",
        targetValue: (targetValue || "").trim(),
        priority: priority || "secondaire",
      });
    }
    if (typeof onNext === "function") onNext();
  }

  const categoryLabel =
    (categoryId && categories.find((c) => c.id === categoryId)?.name) ||
    draft.category?.name ||
    "Catégorie";

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span style={{ opacity: 0.6 }}>2.</span> Objectif · {categoryLabel}
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 12 }}>
            {existingOutcomes.length ? (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button variant={mode === "existing" ? "primary" : "ghost"} onClick={() => setMode("existing")}
                >
                  Objectif existant
                </Button>
                <Button variant={mode === "new" ? "primary" : "ghost"} onClick={() => setMode("new")}
                >
                  Nouvel objectif
                </Button>
              </div>
            ) : null}

            {mode === "existing" && existingOutcomes.length ? (
              <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                <option value="" disabled>
                  Sélectionner un objectif
                </option>
                {existingOutcomes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title || "Objectif"}
                  </option>
                ))}
              </Select>
            ) : (
              <>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nom de l’objectif"
                />
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                <Select value={measureType} onChange={(e) => setMeasureType(e.target.value)}>
                  <option value="">Mesure (optionnel)</option>
                  {MEASURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                <Input
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="Valeur cible (optionnel)"
                />
                <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="secondaire">Secondaire</option>
                  <option value="prioritaire">Prioritaire</option>
                </Select>
              </>
            )}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button variant="ghost" onClick={onBack}>
                Annuler
              </Button>
              <Button onClick={handleNext} disabled={!canSubmit}>
                Continuer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
