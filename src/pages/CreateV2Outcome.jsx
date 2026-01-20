import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select } from "../components/UI";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";
import { resolveGoalType } from "../domain/goalType";
import { uid } from "../utils/helpers";

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

export default function CreateV2Outcome({
  data,
  setData,
  onBack,
  onNext,
  onCancel,
  canCreateOutcome = true,
  onOpenPaywall,
  isPremiumPlan = false,
  planLimits = null,
}) {
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
  const existingOutcomeCount = useMemo(
    () => goals.filter((g) => resolveGoalType(g) === "OUTCOME").length,
    [goals]
  );

  const outcomes = Array.isArray(draft.outcomes) ? draft.outcomes : [];
  const activeOutcomeId = draft.activeOutcomeId || outcomes[0]?.id || "";
  const existingIds = new Set(outcomes.filter((o) => o.mode === "existing").map((o) => o.id));
  const availableExisting = existingOutcomes.filter((g) => !existingIds.has(g.id));

  const [selectedId, setSelectedId] = useState(availableExisting[0]?.id || "");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [measureType, setMeasureType] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [priority, setPriority] = useState("secondaire");

  const canAddExisting = Boolean(selectedId);
  const canAddNew = Boolean((title || "").trim());
  const canContinue = outcomes.length > 0;

  useEffect(() => {
    if (hasCategory) return;
    if (typeof onBack === "function") onBack();
  }, [hasCategory, onBack]);

  useEffect(() => {
    if (!availableExisting.length) return;
    if (availableExisting.some((g) => g.id === selectedId)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(availableExisting[0]?.id || "");
  }, [availableExisting, selectedId]);

  function updateDraft(nextOutcomes, nextActiveId, stepOverride) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            outcomes: nextOutcomes,
            activeOutcomeId: nextActiveId || activeOutcomeId || null,
            ...(stepOverride ? { step: stepOverride } : {}),
          },
        },
      };
    });
  }

  function handleAddExisting() {
    if (!canAddExisting) return;
    const next = [...outcomes, { mode: "existing", id: selectedId }];
    updateDraft(next, selectedId);
  }

  function handleAddNew() {
    if (!canAddNew) return;
    const limit = Number(planLimits?.outcomes) || 0;
    const draftNewCount = outcomes.filter((o) => o.mode === "new").length;
    if (!isPremiumPlan && limit > 0 && existingOutcomeCount + draftNewCount >= limit) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite d’objectifs atteinte.");
      return;
    }
    if (!canCreateOutcome) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite d’objectifs atteinte.");
      return;
    }
    const id = uid();
    const nextOutcome = {
      id,
      mode: "new",
      title: title.trim(),
      deadline: (deadline || "").trim(),
      measureType: measureType || "",
      targetValue: (targetValue || "").trim(),
      priority: priority || "secondaire",
    };
    updateDraft([...outcomes, nextOutcome], id);
    setTitle("");
    setDeadline("");
    setMeasureType("");
    setTargetValue("");
    setPriority("secondaire");
  }

  function handleRemove(outcomeId) {
    const nextOutcomes = outcomes.filter((o) => o.id !== outcomeId);
    const nextActiveId = nextOutcomes[0]?.id || "";
    const nextHabits = (draft.habits || []).filter((h) => h.outcomeId !== outcomeId);
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            outcomes: nextOutcomes,
            activeOutcomeId: nextActiveId || null,
            habits: nextHabits,
          },
        },
      };
    });
  }

  function handleNext() {
    if (!canContinue) return;
    updateDraft(outcomes, activeOutcomeId, STEP_HABITS);
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
          <span style={{ opacity: 0.6 }}>2.</span> Objectifs · {categoryLabel}
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
            {availableExisting.length ? (
              <div className="stack stackGap8">
                <div className="small" style={{ opacity: 0.7 }}>
                  Objectif existant (optionnel)
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                    <option value="" disabled>
                      Sélectionner un objectif
                    </option>
                    {availableExisting.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title || "Objectif"}
                      </option>
                    ))}
                  </Select>
                  <Button onClick={handleAddExisting} disabled={!canAddExisting}>
                    Ajouter
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="stack stackGap8">
              <div className="small" style={{ opacity: 0.7 }}>
                Nouvel objectif
              </div>
              <div className="stack stackGap8">
                <div className="small" style={{ opacity: 0.7 }}>
                  Objectif
                </div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nom de l’objectif"
                />
                <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="secondaire">Secondaire</option>
                  <option value="prioritaire">Prioritaire</option>
                  <option value="bonus">Bonus</option>
                </Select>
              </div>
              <div className="stack stackGap8">
                <div className="small" style={{ opacity: 0.7 }}>
                  Mesure
                </div>
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
                <div className="small2" style={{ opacity: 0.7 }}>
                  Date limite (optionnel)
                </div>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                <div className="small2" style={{ opacity: 0.6 }}>
                  Démarre aujourd’hui automatiquement.
                </div>
              </div>
              <Button onClick={handleAddNew} disabled={!canAddNew}>
                Ajouter
              </Button>
            </div>

            <div className="stack stackGap8">
              {outcomes.map((outcome) => {
                const label =
                  outcome.mode === "existing"
                    ? existingOutcomes.find((g) => g.id === outcome.id)?.title
                    : outcome.title;
                return (
                  <div key={outcome.id} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                    <div className="small2" style={{ flex: 1 }}>
                      {label || "Objectif"}
                    </div>
                    <Button variant="ghost" onClick={() => handleRemove(outcome.id)}>
                      Retirer
                    </Button>
                  </div>
                );
              })}
              {!outcomes.length ? <div className="small2">Ajoute au moins un objectif.</div> : null}
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="ghost"
                onClick={() => {
                  if (typeof onCancel === "function") {
                    onCancel();
                    return;
                  }
                  if (typeof onBack === "function") onBack();
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleNext} disabled={!canContinue}>
                Continuer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
