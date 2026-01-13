import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input } from "../components/UI";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_RHYTHM } from "../creation/creationSchema";
import { uid } from "../utils/helpers";

export default function CreateV2Habits({ data, setData, onBack, onNext }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const [title, setTitle] = useState("");

  const habits = Array.isArray(draft.habits) ? draft.habits : [];
  const hasOutcome =
    draft?.outcome?.mode === "existing"
      ? Boolean(draft.outcome.id)
      : Boolean((draft?.outcome?.title || "").trim());

  useEffect(() => {
    if (hasOutcome) return;
    if (typeof onBack === "function") onBack();
  }, [hasOutcome, onBack]);

  function updateDraft(nextHabits) {
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
            step: STEP_RHYTHM,
          },
        },
      };
    });
  }

  function addHabit() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const nextHabits = [...habits, { id: uid(), title: "" + cleanTitle }];
    updateDraft(nextHabits);
    setTitle("");
  }

  function removeHabit(id) {
    const nextHabits = habits.filter((h) => h.id !== id);
    updateDraft(nextHabits);
  }

  function handleNext() {
    if (!habits.length) return;
    if (typeof onNext === "function") onNext();
  }

  const outcomeLabel = draft.outcome?.title || "Objectif";

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
                  </div>
                  <Button variant="ghost" onClick={() => removeHabit(habit.id)}>
                    Retirer
                  </Button>
                </div>
              ))}
              {!habits.length ? <div className="small2">Ajoute au moins une habitude.</div> : null}
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button variant="ghost" onClick={onBack}>
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
