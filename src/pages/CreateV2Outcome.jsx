import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select } from "../components/UI";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { resolveGoalType } from "../domain/goalType";
import { uid } from "../utils/helpers";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { createGoal } from "../logic/goals";

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
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const existingOutcomeCount = useMemo(
    () =>
      (Array.isArray(safeData.goals) ? safeData.goals : []).filter((g) => g && resolveGoalType(g) === "OUTCOME")
        .length,
    [safeData.goals]
  );

  const draftCategoryId = getCategoryIdFromDraft(draft);
  const initialCategoryId =
    (draftCategoryId && categories.some((c) => c.id === draftCategoryId) && draftCategoryId) || "";
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [title, setTitle] = useState(draft.outcomes?.[0]?.title || "");
  const [startDate, setStartDate] = useState(draft.outcomes?.[0]?.startDate || "");
  const [deadline, setDeadline] = useState(draft.outcomes?.[0]?.deadline || "");
  const [priority, setPriority] = useState(draft.outcomes?.[0]?.priority || "secondaire");
  const [error, setError] = useState("");
  const [savedOutcomeId, setSavedOutcomeId] = useState(null);
  const [showSavedBanner, setShowSavedBanner] = useState(false);

  const outcomeIdRef = useRef(draft.outcomes?.[0]?.id || uid());
  useEffect(() => {
    if (draft.outcomes?.[0]?.id) outcomeIdRef.current = draft.outcomes[0].id;
  }, [draft.outcomes]);
  const effectiveStartKey = useMemo(
    () => normalizeLocalDateKey(startDate) || todayLocalKey(),
    [startDate]
  );
  const minDeadlineKey = useMemo(() => {
    const base = fromLocalDateKey(effectiveStartKey);
    base.setDate(base.getDate() + 7);
    return toLocalDateKey(base);
  }, [effectiveStartKey]);

  const canContinue = Boolean(title.trim() && deadline.trim() && !showSavedBanner);
  const startDateHelper = startDate ? "Démarre à la date choisie." : "Si vide : démarre aujourd’hui.";

  function validateDeadline(nextValue) {
    const normalized = normalizeLocalDateKey(nextValue);
    if (!normalized) return "Date de fin requise (min J+7).";
    if (normalized < minDeadlineKey) {
      return `Date de fin minimale : ${minDeadlineKey} (J+7).`;
    }
    return "";
  }

  function handleNext() {
    if (!canContinue || showSavedBanner) return;
    const deadlineError = validateDeadline(deadline);
    if (deadlineError) {
      setError(deadlineError);
      return;
    }
    const limit = Number(planLimits?.outcomes) || 0;
    if (!isPremiumPlan && limit > 0 && existingOutcomeCount >= limit) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite d’objectifs atteinte.");
      return;
    }
    if (!canCreateOutcome) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite d’objectifs atteinte.");
      return;
    }
    if (typeof setData !== "function") return;
    const outcomeId = outcomeIdRef.current;
    setData((prev) => {
      let next = prev;
      next = createGoal(next, {
        id: outcomeId,
        categoryId: categoryId ? categoryId : null,
        title: title.trim(),
        type: "OUTCOME",
        planType: "STATE",
        startDate: startDate ? startDate.trim() : "",
        deadline: (deadline || "").trim(),
        priority: priority || "secondaire",
      });
      const prevUi = next.ui || {};
      return {
        ...next,
        ui: {
          ...prevUi,
          createDraft: createEmptyDraft(),
          createDraftWasCompleted: true,
          createDraftWasCanceled: false,
        },
      };
    });
    setSavedOutcomeId(outcomeId);
    setShowSavedBanner(true);
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">1.</span> Objectif
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col gap12">
            {categories.length ? (
              <div className="stack stackGap8">
                <div className="small textMuted">Catégorie (optionnel)</div>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sans catégorie</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name || "Catégorie"}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="stack stackGap8">
              <div className="small textMuted">Objectif</div>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Nom de l’objectif"
              />
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="secondaire">Secondaire</option>
                <option value="prioritaire">Prioritaire</option>
                <option value="bonus">Bonus</option>
              </Select>
            </div>

            <div className="stack stackGap6">
              <div className="small2 textMuted">Date de début (optionnel)</div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (error) setError("");
                }}
              />
            </div>
            <div className="stack stackGap6">
              <div className="small2 textMuted">Date de fin (obligatoire, min J+7 : {minDeadlineKey})</div>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  if (error) setError("");
                }}
              />
              {error ? <div className="small2 textAccent">{error}</div> : null}
              <div className="small2 textMuted2">{startDateHelper}</div>
            </div>
            <div className="row rowEnd gap10">
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
              <Button onClick={handleNext} disabled={showSavedBanner || !canContinue}>
                Continuer
              </Button>
            </div>
          </div>
        </Card>
        {showSavedBanner ? (
          <Card>
            <div className="p18">
              <div className="small2">
                Objectif créé. Utilise le + pour ajouter une action.
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </ScreenShell>
  );
}
