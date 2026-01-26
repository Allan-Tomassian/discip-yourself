import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select } from "../components/UI";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_PICK_CATEGORY } from "../creation/creationSchema";
import { createGoal, updateGoal } from "../logic/goals";
import { ensureSystemInboxCategory, SYSTEM_INBOX_ID } from "../logic/state";
import { resolveGoalType } from "../domain/goalType";
import { normalizeLocalDateKey, todayLocalKey, toLocalDateKey } from "../utils/dateKey";
import { uid } from "../utils/helpers";

function buildMinDeadline(startKey) {
  const date = new Date(`${startKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + 1);
  return toLocalDateKey(date);
}

export default function CreateV2LinkOutcome({
  data,
  setData,
  onNext,
  onCancel,
  onDone,
  canCreateOutcome = true,
  onOpenPaywall,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const createdActionIds = Array.isArray(draft.createdActionIds) ? draft.createdActionIds : [];
  const actions = useMemo(
    () => goals.filter((g) => g && createdActionIds.includes(g.id)),
    [goals, createdActionIds]
  );
  const alreadyLinked = actions.length > 0 && actions.every((a) => a && (a.outcomeId || a.parentId));

  const outcomes = useMemo(() => goals.filter((g) => g && resolveGoalType(g) === "OUTCOME"), [goals]);
  const [choice, setChoice] = useState("none");
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(() => outcomes[0]?.id || "");
  const [newTitle, setNewTitle] = useState(() => actions[0]?.title || "");
  const [startDate, setStartDate] = useState(() => todayLocalKey());
  const [deadline, setDeadline] = useState(() => buildMinDeadline(todayLocalKey()));
  const [error, setError] = useState("");

  const minDeadlineKey = useMemo(
    () => buildMinDeadline(normalizeLocalDateKey(startDate) || todayLocalKey()),
    [startDate]
  );

  useEffect(() => {
    if (alreadyLinked && typeof onNext === "function") onNext();
  }, [alreadyLinked, onNext]);

  function advanceDraft(nextOutcomeId) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      const nextDraft = {
        ...normalizeCreationDraft(prevUi.createDraft),
        step: STEP_PICK_CATEGORY,
        activeOutcomeId: nextOutcomeId || null,
      };
      return { ...prev, ui: { ...prevUi, createDraft: nextDraft } };
    });
  }

  function linkToOutcome(outcomeId) {
    if (!outcomeId || typeof setData !== "function") return;
    setData((prev) => {
      let next = prev;
      for (const id of createdActionIds) {
        next = updateGoal(next, id, { parentId: outcomeId, outcomeId });
      }
      const prevUi = prev.ui || {};
      const nextDraft = {
        ...normalizeCreationDraft(prevUi.createDraft),
        step: STEP_PICK_CATEGORY,
        activeOutcomeId: outcomeId,
      };
      return { ...next, ui: { ...prevUi, createDraft: nextDraft } };
    });
    if (typeof onNext === "function") onNext();
  }

  function createOutcomeAndLink() {
    const cleanTitle = String(newTitle || "").trim();
    if (!cleanTitle) {
      setError("Titre requis.");
      return;
    }
    if (!canCreateOutcome) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite d’objectifs atteinte.");
      return;
    }
    const startKey = normalizeLocalDateKey(startDate) || todayLocalKey();
    const deadlineKey = normalizeLocalDateKey(deadline);
    if (!deadlineKey || deadlineKey < minDeadlineKey) {
      setError(`Date de fin minimale : ${minDeadlineKey} (min 2 jours).`);
      return;
    }
    if (typeof setData !== "function") return;
    const outcomeId = uid();
    const targetCategoryId = actions[0]?.categoryId || SYSTEM_INBOX_ID;
    setData((prev) => {
      let next = prev;
      if (targetCategoryId === SYSTEM_INBOX_ID) {
        next = ensureSystemInboxCategory(next).state;
      }
      next = createGoal(next, {
        id: outcomeId,
        categoryId: targetCategoryId,
        title: cleanTitle,
        type: "OUTCOME",
        planType: "STATE",
        startDate: startKey,
        deadline: deadlineKey,
        priority: "secondaire",
      });
      for (const id of createdActionIds) {
        next = updateGoal(next, id, { parentId: outcomeId, outcomeId });
      }
      const prevUi = prev.ui || {};
      const nextDraft = {
        ...normalizeCreationDraft(prevUi.createDraft),
        step: STEP_PICK_CATEGORY,
        activeOutcomeId: outcomeId,
      };
      return { ...next, ui: { ...prevUi, createDraft: nextDraft } };
    });
    if (typeof onNext === "function") onNext();
  }

  function handleContinue() {
    setError("");
    if (!actions.length) {
      if (typeof onDone === "function") onDone();
      return;
    }
    if (choice === "none") {
      advanceDraft(null);
      if (typeof onNext === "function") onNext();
      return;
    }
    if (choice === "existing") {
      if (!selectedOutcomeId) {
        setError("Choisis un objectif.");
        return;
      }
      linkToOutcome(selectedOutcomeId);
      return;
    }
    if (choice === "new") {
      createOutcomeAndLink();
    }
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">2.</span> Objectif
        </>
      }
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="stack stackGap12">
        <Card accentBorder>
          <div className="p18 col gap12">
            <div className="small2">Quelle est l’objectif de cette action ?</div>
            {error ? <div className="small2 textAccent">{error}</div> : null}
            <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="none">Aucun</option>
              <option value="existing">Lier à un objectif existant</option>
              <option value="new">Créer un nouvel objectif</option>
            </Select>

            {choice === "existing" ? (
              <div className="stack stackGap8">
                <div className="small textMuted">Objectifs disponibles</div>
                <Select value={selectedOutcomeId} onChange={(e) => setSelectedOutcomeId(e.target.value)}>
                  <option value="">Choisir un objectif</option>
                  {outcomes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title || "Objectif"}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {choice === "new" ? (
              <div className="stack stackGap8">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Nom de l’objectif"
                />
                <div className="row" style={{ gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div className="small" style={{ marginBottom: 6 }}>
                      Début
                    </div>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="small" style={{ marginBottom: 6 }}>
                      Fin (min 2 jours)
                    </div>
                    <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  </div>
                </div>
                <div className="small2 textMuted2">Date de fin minimale : {minDeadlineKey}</div>
              </div>
            ) : null}

            <div className="row rowBetween">
              <Button
                variant="ghost"
                onClick={() => {
                  advanceDraft(null);
                  if (typeof onNext === "function") onNext();
                  else if (typeof onCancel === "function") onCancel();
                }}
              >
                Plus tard
              </Button>
              <Button onClick={handleContinue}>Continuer</Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
