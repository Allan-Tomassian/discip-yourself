import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select } from "../components/UI";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_RHYTHM } from "../creation/creationSchema";
import { uid } from "../utils/helpers";

export default function CreateV2Habits({ data, setData, onBack, onNext, onCancel }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const [title, setTitle] = useState("");

  const habits = Array.isArray(draft.habits) ? draft.habits : [];
  const outcomes = Array.isArray(draft.outcomes) ? draft.outcomes : [];
  const activeOutcomeId = draft.activeOutcomeId || outcomes[0]?.id || "";
  const hasOutcome = outcomes.length > 0;

  useEffect(() => {
    if (hasOutcome) return;
    if (typeof onBack === "function") onBack();
  }, [hasOutcome, onBack]);

  useEffect(() => {
    if (!outcomes.length) return;
    if (outcomes.some((o) => o.id === activeOutcomeId)) return;
    updateDraft(habits, outcomes[0].id);
  }, [activeOutcomeId, habits, outcomes]);

  function updateDraft(nextHabits, nextActiveId) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            habits: nextHabits,
            activeOutcomeId: nextActiveId || activeOutcomeId || null,
            step: STEP_RHYTHM,
          },
        },
      };
    });
  }

  function addHabit() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    if (!activeOutcomeId) return;
    const nextHabits = [...habits, { id: uid(), title: "" + cleanTitle, outcomeId: activeOutcomeId }];
    updateDraft(nextHabits, activeOutcomeId);
    setTitle("");
  }

  function removeHabit(id) {
    const nextHabits = habits.filter((h) => h.id !== id);
    updateDraft(nextHabits, activeOutcomeId);
  }

  function handleNext() {
    if (!habits.length) return;
    if (typeof onNext === "function") onNext();
  }

  function getOutcomeLabel(id) {
    return (
      outcomes.find((o) => o.id === id)?.title ||
      goals.find((g) => g.id === id)?.title ||
      "Objectif"
    );
  }

  const outcomeLabel = getOutcomeLabel(activeOutcomeId);

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span style={{ opacity: 0.6 }}>3.</span> Habitudes · {outcomeLabel}
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
            <div className="stack stackGap6">
              <div className="small2" style={{ opacity: 0.7 }}>
                Ajouter des habitudes pour...
              </div>
              <Select
                value={activeOutcomeId}
                onChange={(e) => updateDraft(habits, e.target.value)}
                disabled={!outcomes.length}
              >
                {outcomes.map((outcome) => (
                  <option key={outcome.id} value={outcome.id}>
                    {getOutcomeLabel(outcome.id)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nouvelle habitude"
              />
              <Button onClick={addHabit} disabled={!title.trim()}>
                Ajouter
              </Button>
            </div>
            <div className="stack stackGap8">
              {habits.map((habit) => (
                <div key={habit.id} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                  <div className="small2" style={{ flex: 1 }}>
                    {habit.title}
                    <span style={{ opacity: 0.6 }}>
                      {" "}
                      · {getOutcomeLabel(habit.outcomeId || activeOutcomeId)}
                    </span>
                  </div>
                  <Button variant="ghost" onClick={() => removeHabit(habit.id)}>
                    Retirer
                  </Button>
                </div>
              ))}
              {!habits.length ? <div className="small2">Ajoute au moins une habitude.</div> : null}
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
              <Button onClick={handleNext} disabled={!habits.length}>
                Continuer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
