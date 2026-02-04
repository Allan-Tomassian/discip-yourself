import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input } from "../components/UI";
import Select from "../ui/select/Select";
import DatePicker from "../ui/date/DatePicker";
import CreateSection from "../ui/create/CreateSection";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_OUTCOME_NEXT_ACTION } from "../creation/creationSchema";
import { resolveGoalType } from "../domain/goalType";
import { LABELS } from "../ui/labels";
import { uid } from "../utils/helpers";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { createGoal } from "../logic/goals";
import { ensureSystemInboxCategory, normalizeCategory, SYSTEM_INBOX_ID } from "../logic/state";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import { canCreateCategory } from "../logic/entitlements";

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
  onAfterSave,
  canCreateOutcome = true,
  onOpenPaywall,
  isPremiumPlan = false,
  planLimits = null,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const suggestedCategories = useMemo(() => {
    const existingNames = new Set(categories.map((c) => String(c?.name || "").trim().toLowerCase()).filter(Boolean));
    const existingIds = new Set(categories.map((c) => c?.id).filter(Boolean));
    return SUGGESTED_CATEGORIES.filter(
      (cat) =>
        cat &&
        !existingIds.has(cat.id) &&
        !existingNames.has(String(cat.name || "").trim().toLowerCase())
    );
  }, [categories]);
  const existingOutcomeCount = useMemo(
    () =>
      (Array.isArray(safeData.goals) ? safeData.goals : []).filter((g) => g && resolveGoalType(g) === "OUTCOME")
        .length,
    [safeData.goals]
  );

  const draftCategoryId = getCategoryIdFromDraft(draft);
  const sysCategoryId = categories.find((c) => c.id === SYSTEM_INBOX_ID)?.id || SYSTEM_INBOX_ID;
  const initialCategoryId =
    (draftCategoryId && categories.some((c) => c.id === draftCategoryId) && draftCategoryId) || sysCategoryId;
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [title, setTitle] = useState(draft.outcomes?.[0]?.title || "");
  const [startDate, setStartDate] = useState(() => normalizeLocalDateKey(draft.outcomes?.[0]?.startDate) || todayLocalKey());
  const [deadline, setDeadline] = useState(() => normalizeLocalDateKey(draft.outcomes?.[0]?.deadline) || "");
  const [priority, setPriority] = useState(draft.outcomes?.[0]?.priority || "secondaire");
  const [error, setError] = useState("");
  const [deadlineTouched, setDeadlineTouched] = useState(Boolean(draft.outcomes?.[0]?.deadline));

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
    base.setDate(base.getDate() + 1);
    return toLocalDateKey(base);
  }, [effectiveStartKey]);

  const deadlineError = validateDeadline(deadline);
  const canContinue = Boolean(title.trim() && deadline.trim() && !deadlineError);
  const startDateHelper = startDate ? "Démarre à la date choisie." : "Si vide : démarre aujourd’hui.";
  const categoryOptions = useMemo(() => {
    const sys = categories.find((c) => c.id === SYSTEM_INBOX_ID) || { id: SYSTEM_INBOX_ID, name: "Général" };
    const rest = categories.filter((c) => c.id !== SYSTEM_INBOX_ID);
    rest.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    const suggestions = suggestedCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      suggested: true,
    }));
    return [sys, ...rest, ...suggestions];
  }, [categories, suggestedCategories]);

  function validateDeadline(nextValue) {
    const normalized = normalizeLocalDateKey(nextValue);
    if (!normalized) return "Date de fin requise (min 2 jours).";
    if (normalized < minDeadlineKey) {
      return `Date de fin minimale : ${minDeadlineKey} (min 2 jours).`;
    }
    return "";
  }

  function handleNext() {
    if (!canContinue) return;
    if (deadlineError) {
      setError(deadlineError);
      return;
    }
    const selectedSuggestion = suggestedCategories.find((cat) => cat.id === categoryId) || null;
    if (selectedSuggestion && !canCreateCategory(safeData)) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite de catégories atteinte.");
      return;
    }
    const limit = Number(planLimits?.outcomes) || 0;
    if (!isPremiumPlan && limit > 0 && existingOutcomeCount >= limit) {
      if (typeof onOpenPaywall === "function") onOpenPaywall(`Limite de ${LABELS.goalsLower} atteinte.`);
      return;
    }
    if (!canCreateOutcome) {
      if (typeof onOpenPaywall === "function") onOpenPaywall(`Limite de ${LABELS.goalsLower} atteinte.`);
      return;
    }
    if (typeof setData !== "function") return;
    const outcomeId = outcomeIdRef.current;
    setData((prev) => {
      let next = prev;
      if (categoryId === SYSTEM_INBOX_ID) {
        next = ensureSystemInboxCategory(next).state;
      }
      if (selectedSuggestion) {
        const prevCategories = Array.isArray(next.categories) ? next.categories : [];
        if (!prevCategories.some((c) => c?.id === selectedSuggestion.id)) {
          const created = normalizeCategory(
            { id: selectedSuggestion.id, name: selectedSuggestion.name, color: selectedSuggestion.color },
            prevCategories.length
          );
          next = { ...next, categories: [...prevCategories, created] };
        }
      }
      next = createGoal(next, {
        id: outcomeId,
        categoryId: categoryId || sysCategoryId,
        title: title.trim(),
        type: "OUTCOME",
        planType: "STATE",
        startDate: startDate ? startDate.trim() : "",
        deadline: (deadline || "").trim(),
        priority: priority || "secondaire",
      });
      const prevUi = next.ui || {};
      const nextDraft = {
        ...createEmptyDraft(),
        step: STEP_OUTCOME_NEXT_ACTION,
        createdOutcomeId: outcomeId,
        activeOutcomeId: outcomeId,
        category: categoryId ? { mode: "existing", id: categoryId } : null,
      };
      return {
        ...next,
        ui: {
          ...prevUi,
          createDraft: nextDraft,
          createDraftWasCompleted: false,
          createDraftWasCanceled: false,
        },
      };
    });
    if (typeof onAfterSave === "function") onAfterSave(outcomeId, categoryId || sysCategoryId);
  }

  function activateSuggestedCategory(cat) {
    if (!cat || typeof setData !== "function") return;
    if (!canCreateCategory(safeData)) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite de catégories atteinte.");
      return;
    }
    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      if (prevCategories.some((c) => c?.id === cat.id)) return prev;
      if (prevCategories.some((c) => String(c?.name || "").trim().toLowerCase() === String(cat.name || "").trim().toLowerCase())) {
        return prev;
      }
      const created = normalizeCategory({ id: cat.id, name: cat.name, color: cat.color }, prevCategories.length);
      return { ...prev, categories: [...prevCategories, created] };
    });
  }

  const selectedSuggestion = suggestedCategories.find((cat) => cat.id === categoryId) || null;

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">1.</span> {LABELS.goal}
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
            <CreateSection title="Catégorie" collapsible={false}>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name || "Catégorie"}
                    {category.suggested ? " (suggestion)" : ""}
                  </option>
                ))}
              </Select>
              {selectedSuggestion ? (
                <div className="row rowBetween alignCenter">
                  <div className="small2 textMuted">Suggestion non activée.</div>
                  <Button variant="ghost" onClick={() => activateSuggestedCategory(selectedSuggestion)}>
                    Activer
                  </Button>
                </div>
              ) : null}
            </CreateSection>

            <CreateSection title={LABELS.goal} description="Nom + priorité" collapsible={false}>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError("");
                }}
                placeholder={`Nom du ${LABELS.goalLower}`}
              />
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="secondaire">Secondaire</option>
                <option value="prioritaire">Prioritaire</option>
                <option value="bonus">Bonus</option>
              </Select>
            </CreateSection>

            <CreateSection title="Dates" description="Début + fin" collapsible={false}>
              <div className="stack stackGap6">
                <div className="small2 textMuted">Date de début (optionnel)</div>
                <DatePicker
                  value={startDate}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setStartDate(nextValue);
                    if (!deadlineTouched) {
                      const base = fromLocalDateKey(normalizeLocalDateKey(nextValue) || todayLocalKey());
                      base.setDate(base.getDate() + 1);
                      setDeadline(toLocalDateKey(base));
                    }
                    if (error) setError("");
                  }}
                />
              </div>
              <div className="stack stackGap6">
                <div className="small2 textMuted">Date de fin (min 2 jours : {minDeadlineKey})</div>
                <DatePicker
                  value={deadline}
                  onChange={(e) => {
                    setDeadline(e.target.value);
                    if (!deadlineTouched) setDeadlineTouched(true);
                    if (error) setError("");
                  }}
                />
                {error ? (
                  <div className="stack stackGap6">
                    <div className="small2 textAccent">{error}</div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (typeof onNext === "function") onNext();
                      }}
                    >
                      Créer une action à la place
                    </Button>
                  </div>
                ) : null}
                <div className="small2 textMuted2">{startDateHelper}</div>
              </div>
            </CreateSection>
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
