import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/UI";
import { SYSTEM_INBOX_ID } from "../../logic/state";
import { LABELS } from "../labels";
import { GateButton, GateCard, GateFooter, GateHeader, GatePanel, GateRow } from "../../shared/ui/gate/Gate";
import CreateV2Outcome from "../../pages/CreateV2Outcome";
import CreateV2HabitType from "../../pages/CreateV2HabitType";
import CreateV2HabitOneOff from "../../pages/CreateV2HabitOneOff";
import CreateV2HabitRecurring from "../../pages/CreateV2HabitRecurring";
import CreateV2HabitAnytime from "../../pages/CreateV2HabitAnytime";
import CreateV2LinkOutcome from "../../pages/CreateV2LinkOutcome";
import CreateV2PickCategory from "../../pages/CreateV2PickCategory";
import { STEP_HABIT_TYPE, STEP_LINK_OUTCOME, STEP_PICK_CATEGORY, STEP_OUTCOME } from "../../creation/creationSchema";
import "../../features/create-flow/createFlow.css";

function resolveCategory(categories, categoryId) {
  const list = Array.isArray(categories) ? categories : [];
  if (categoryId) {
    const match = list.find((c) => c?.id === categoryId);
    if (match) return match;
  }
  return list[0] || { id: SYSTEM_INBOX_ID, name: "Général", color: "#F97316" };
}

export default function CreateFlowModal({
  open,
  onClose,
  onChangeCategory,
  data,
  setData,
  categories,
  selectedCategoryId,
  seedCreateDraft,
  resetCreateDraft,
  canCreateOutcome,
  canCreateAction,
  onOpenPaywall,
  isPremiumPlan,
  planLimits,
  generationWindowDays,
}) {
  const [step, setStep] = useState("choice");
  const [choice, setChoice] = useState(null);
  const [categoryId, setCategoryId] = useState(null);

  const resolvedSelected = useMemo(
    () => resolveCategory(categories, selectedCategoryId),
    [categories, selectedCategoryId]
  );
  const category = useMemo(() => resolveCategory(categories, categoryId), [categories, categoryId]);
  const categoryName = category?.name || "Catégorie";
  const categoryColor = category?.color || "#F97316";

  useEffect(() => {
    if (!open) return;
    const nextCategoryId = selectedCategoryId || resolvedSelected?.id || SYSTEM_INBOX_ID;
    setCategoryId(nextCategoryId);
    setStep("choice");
    setChoice(null);
    if (typeof seedCreateDraft === "function") {
      seedCreateDraft({ source: "create-modal", categoryId: nextCategoryId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canProceed = Boolean(categoryId);

  const handleClose = (reason = "unknown") => {
    if (typeof resetCreateDraft === "function") resetCreateDraft();
    onClose?.();
  };

  const startChoice = (nextChoice) => {
    if (!canProceed) return;
    setChoice(nextChoice);
    if (nextChoice === "project" || nextChoice === "guided") {
      if (typeof seedCreateDraft === "function") {
        seedCreateDraft({ source: "create-modal", categoryId, step: STEP_OUTCOME });
      }
      setStep("outcome");
    } else if (nextChoice === "action") {
      if (typeof seedCreateDraft === "function") {
        seedCreateDraft({ source: "create-modal", categoryId, step: STEP_HABIT_TYPE });
      }
      setStep("habit-type");
    }
  };

  const handleOutcomeSaved = (outcomeId, nextCategoryId) => {
    if (choice === "project") {
      if (typeof resetCreateDraft === "function") resetCreateDraft();
      onClose?.();
      return;
    }
    if (choice === "guided") {
      const catId = nextCategoryId || categoryId || SYSTEM_INBOX_ID;
      if (typeof seedCreateDraft === "function") {
        seedCreateDraft({ source: "create-guided", categoryId: catId, outcomeId, step: STEP_HABIT_TYPE });
      }
      setStep("habit-type");
    }
  };

  const handleHabitTypeNext = (type) => {
    if (type === "ONE_OFF") setStep("habit-oneoff");
    else if (type === "ANYTIME") setStep("habit-anytime");
    else setStep("habit-recurring");
  };

  const handleHabitDone = () => {
    if (typeof resetCreateDraft === "function") resetCreateDraft();
    onClose?.();
  };

  const handleHabitNext = (nextStep) => {
    if (nextStep === STEP_LINK_OUTCOME) {
      setStep("link-outcome");
      return;
    }
    if (nextStep === STEP_PICK_CATEGORY) {
      setStep("pick-category");
      return;
    }
    handleHabitDone();
  };

  return (
    <Modal
      open={open}
      onClose={(info) => handleClose(info?.reason)}
      className="createFlowModal card gateModal gateModal--flow"
      backdropClassName="createFlowBackdrop"
    >
      <GatePanel className="createFlowShell gateModal gateModal--flow createFlowScope" data-testid="create-flow-modal">
        <GateHeader title="Créer" subtitle="Choisis ce que tu veux créer" />

        <GateRow
          className="createFlowCategoryRow"
          right={
            <GateButton variant="ghost" onClick={onChangeCategory} data-testid="create-change-category">
              Modifier
            </GateButton>
          }
        >
          <span className="createFlowSwatch" style={{ background: categoryColor }} />
          <div className="createFlowCategoryName">{categoryName}</div>
        </GateRow>

        <div className="createFlowBody">
          {step === "choice" ? (
            <div className="createFlowChoiceGrid">
              <GateCard
                className={`createFlowChoiceCard${!canProceed ? " isDisabled" : ""}`}
                data-testid="create-choice-guided"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canProceed) startChoice("guided");
                }}
              >
                <div className="createFlowChoiceText">
                  <div className="titleSm">{LABELS.goal} + {LABELS.action}</div>
                  <div className="small2">Guidé, pour structurer ton plan.</div>
                </div>
              </GateCard>
              <GateCard
                className={`createFlowChoiceCard${!canProceed ? " isDisabled" : ""}`}
                data-testid="create-choice-project"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canProceed) startChoice("project");
                }}
              >
                <div className="createFlowChoiceText">
                  <div className="titleSm">{LABELS.goal}</div>
                  <div className="small2">Définis un {LABELS.goalLower} clair.</div>
                </div>
              </GateCard>
              <GateCard
                className={`createFlowChoiceCard${!canProceed ? " isDisabled" : ""}`}
                data-testid="create-choice-action"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canProceed) startChoice("action");
                }}
              >
                <div className="createFlowChoiceText">
                  <div className="titleSm">{LABELS.action}</div>
                  <div className="small2">Planifie une action concrète.</div>
                </div>
              </GateCard>
            </div>
          ) : (
            <div className="createFlowStep">
              {step === "outcome" ? (
                <CreateV2Outcome
                  data={data}
                  setData={setData}
                  onBack={() => setStep("choice")}
                  onNext={() => {
                    setChoice("action");
                    if (typeof seedCreateDraft === "function") {
                      seedCreateDraft({ source: "create-modal", categoryId, step: STEP_HABIT_TYPE });
                    }
                    setStep("habit-type");
                  }}
                  onCancel={() => setStep("choice")}
                  onAfterSave={handleOutcomeSaved}
                  canCreateOutcome={canCreateOutcome}
                  onOpenPaywall={onOpenPaywall}
                  isPremiumPlan={isPremiumPlan}
                  planLimits={planLimits}
                  skin="gate"
                />
              ) : null}

              {step === "habit-type" ? (
                <CreateV2HabitType
                  data={data}
                  setData={setData}
                  onBack={() => setStep("choice")}
                  onNext={handleHabitTypeNext}
                  skin="gate"
                />
              ) : null}

              {step === "habit-oneoff" ? (
                <CreateV2HabitOneOff
                  data={data}
                  setData={setData}
                  onBack={() => setStep("habit-type")}
                  onNext={handleHabitNext}
                  onOpenCategories={() => onChangeCategory?.()}
                  onCancel={handleClose}
                  onDone={handleHabitDone}
                  canCreateAction={canCreateAction}
                  onOpenPaywall={onOpenPaywall}
                  isPremiumPlan={isPremiumPlan}
                  planLimits={planLimits}
                  generationWindowDays={generationWindowDays}
                  skin="gate"
                />
              ) : null}

              {step === "habit-recurring" ? (
                <CreateV2HabitRecurring
                  data={data}
                  setData={setData}
                  onBack={() => setStep("habit-type")}
                  onNext={handleHabitNext}
                  onOpenCategories={() => onChangeCategory?.()}
                  onCancel={handleClose}
                  onDone={handleHabitDone}
                  canCreateAction={canCreateAction}
                  onOpenPaywall={onOpenPaywall}
                  isPremiumPlan={isPremiumPlan}
                  planLimits={planLimits}
                  generationWindowDays={generationWindowDays}
                  skin="gate"
                />
              ) : null}

              {step === "habit-anytime" ? (
                <CreateV2HabitAnytime
                  data={data}
                  setData={setData}
                  onBack={() => setStep("habit-type")}
                  onNext={handleHabitNext}
                  onOpenCategories={() => onChangeCategory?.()}
                  onCancel={handleClose}
                  onDone={handleHabitDone}
                  canCreateAction={canCreateAction}
                  onOpenPaywall={onOpenPaywall}
                  isPremiumPlan={isPremiumPlan}
                  planLimits={planLimits}
                  generationWindowDays={generationWindowDays}
                  skin="gate"
                />
              ) : null}

              {step === "link-outcome" ? (
                <CreateV2LinkOutcome
                  data={data}
                  setData={setData}
                  onNext={() => setStep("pick-category")}
                  onCancel={() => setStep("habit-type")}
                  onDone={handleHabitDone}
                  canCreateOutcome={canCreateOutcome}
                  onOpenPaywall={onOpenPaywall}
                  skin="gate"
                />
              ) : null}

              {step === "pick-category" ? (
                <CreateV2PickCategory
                  data={data}
                  setData={setData}
                  onDone={handleHabitDone}
                  onOpenPaywall={onOpenPaywall}
                  skin="gate"
                />
              ) : null}
            </div>
          )}
        </div>

        {step === "choice" ? (
          <GateFooter>
            <GateButton variant="ghost" onClick={() => handleClose("cancel")}>Annuler</GateButton>
          </GateFooter>
        ) : null}
      </GatePanel>
    </Modal>
  );
}
