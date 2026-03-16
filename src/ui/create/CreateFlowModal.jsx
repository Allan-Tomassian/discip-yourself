import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SYSTEM_INBOX_ID } from "../../logic/state";
import { LABELS, UI_COPY } from "../labels";
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
import "../../shared/ui/overlays/overlays.css";

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
  const [choice, setChoice] = useState("action");
  const [showLegacyChoices, setShowLegacyChoices] = useState(false);
  const [categoryId, setCategoryId] = useState(null);
  const panelRef = useRef(null);
  const previousBodyOverflowRef = useRef("");

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
    setChoice("action");
    setShowLegacyChoices(false);
    if (typeof seedCreateDraft === "function") {
      seedCreateDraft({ source: "create-modal", categoryId: nextCategoryId, step: STEP_HABIT_TYPE });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canProceed = Boolean(categoryId);

  const handleClose = useCallback((reason = "unknown") => {
    if (typeof resetCreateDraft === "function") resetCreateDraft();
    onClose?.();
  }, [onClose, resetCreateDraft]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleClose("escape");
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, handleClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const body = document.body;
    previousBodyOverflowRef.current = body.style.overflow || "";
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousBodyOverflowRef.current;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const timeoutId = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = root.querySelector(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      if (focusable && typeof focusable.focus === "function") focusable.focus();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  const startChoice = (nextChoice) => {
    if (!canProceed) return;
    setChoice(nextChoice);
    if (nextChoice === "action") {
      if (typeof seedCreateDraft === "function") {
        seedCreateDraft({ source: "create-modal", categoryId, step: STEP_HABIT_TYPE });
      }
      setStep("habit-type");
    } else if (nextChoice === "project" || nextChoice === "guided") {
      if (typeof seedCreateDraft === "function") {
        seedCreateDraft({ source: "create-modal", categoryId, step: STEP_OUTCOME });
      }
      setStep("outcome");
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

  if (!open) return null;

  const modalBody = (
    <div
      className="modalBackdrop createFlowBackdrop GateOverlayBackdrop"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        handleClose("backdrop");
      }}
      role="presentation"
    >
      <div
        className="modalPanelOuter GateGlassOuter"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="modalPanelClip GateGlassClip GateGlassBackdrop">
          <div
            ref={panelRef}
            className="modalPanel createFlowModal gateModal gateModal--flow GateGlassContent"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <GatePanel className="createFlowShell gateModal gateModal--flow createFlowScope GateSurfacePremium GateCardPremium" data-testid="create-flow-modal">
        <GateHeader title="Créer" subtitle="Commence par une action. Les objectifs restent avancés et optionnels." />

        <GateRow
          className="createFlowCategoryRow GateRowPremium"
          right={
            step === "choice" ? (
              <GateButton variant="ghost" className="GatePressable" withSound onClick={onChangeCategory} data-testid="create-change-category">
                Modifier
              </GateButton>
            ) : (
              <span className="small2 textMuted2">Verrouillée</span>
            )
          }
        >
          <span className="createFlowSwatch" style={{ background: categoryColor }} />
          <div className="createFlowCategoryName">{categoryName}</div>
        </GateRow>

        <div className="createFlowBody">
          {step === "choice" ? (
            <div className="createFlowChoiceGrid">
              <GateCard
                className={`createFlowChoiceCard GateRowPremium GatePressable${!canProceed ? " isDisabled" : ""}`}
                data-testid="create-choice-action"
                withSound
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canProceed) startChoice("action");
                }}
              >
                <div className="createFlowChoiceText">
                  <div className="titleSm">{LABELS.action}</div>
                  <div className="small2">Voie recommandée. Tu pourras ajouter un objectif avancé plus tard si utile.</div>
                </div>
              </GateCard>
              {showLegacyChoices ? (
                <>
                  <GateCard
                    className={`createFlowChoiceCard GateRowPremium GatePressable${!canProceed ? " isDisabled" : ""}`}
                    data-testid="create-choice-guided"
                    withSound
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (canProceed) startChoice("guided");
                    }}
                  >
                    <div className="createFlowChoiceText">
                      <div className="titleSm">Structurer avec un {LABELS.goalLower} avancé</div>
                      <div className="small2">Mode avancé pour créer un objectif puis enchaîner sur une action liée.</div>
                    </div>
                  </GateCard>
                  <GateCard
                    className={`createFlowChoiceCard GateRowPremium GatePressable${!canProceed ? " isDisabled" : ""}`}
                    data-testid="create-choice-project"
                    withSound
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (canProceed) startChoice("project");
                    }}
                  >
                    <div className="createFlowChoiceText">
                      <div className="titleSm">Créer un {LABELS.goalLower} avancé</div>
                      <div className="small2">Créer un {LABELS.goalLower} sans action pour l’instant.</div>
                    </div>
                  </GateCard>
                </>
              ) : null}
              <GateButton
                variant="ghost"
                className="GatePressable"
                withSound
                data-testid="create-show-legacy-options"
                onClick={() => setShowLegacyChoices((prev) => !prev)}
              >
                {showLegacyChoices ? "Masquer options avancées" : "Afficher options avancées"}
              </GateButton>
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
          <GateFooter className="GatePrimaryCtaRow">
            <GateButton variant="ghost" className="GatePressable" withSound onClick={() => handleClose("cancel")}>{UI_COPY.cancel}</GateButton>
          </GateFooter>
        ) : null}
            </GatePanel>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalBody, document.body) : modalBody;
}
