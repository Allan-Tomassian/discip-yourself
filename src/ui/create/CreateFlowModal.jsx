import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getFirstVisibleCategoryId } from "../../domain/categoryVisibility";
import { normalizeCreationDraft } from "../../creation/creationDraft";
import { normalizeCreateFlowMode, resolveCreateFlowPresentation } from "../../creation/createFlowController";
import { LABELS, UI_COPY } from "../labels";
import { GateBadge, GateButton, GateFooter, GateHeader, GatePanel, GateRow } from "../../shared/ui/gate/Gate";
import { CreateChoiceCard } from "./CreateFormPrimitives";
import CreateV2Outcome from "../../pages/CreateV2Outcome";
import CreateV2OutcomeNextAction from "../../pages/CreateV2OutcomeNextAction";
import CreateV2HabitType from "../../pages/CreateV2HabitType";
import CreateV2HabitOneOff from "../../pages/CreateV2HabitOneOff";
import CreateV2HabitRecurring from "../../pages/CreateV2HabitRecurring";
import CreateV2HabitAnytime from "../../pages/CreateV2HabitAnytime";
import CreateV2LinkOutcome from "../../pages/CreateV2LinkOutcome";
import CreateV2PickCategory from "../../pages/CreateV2PickCategory";
import {
  STEP_HABITS,
  STEP_HABIT_TYPE,
  STEP_LINK_OUTCOME,
  STEP_OUTCOME,
  STEP_OUTCOME_NEXT_ACTION,
  STEP_PICK_CATEGORY,
} from "../../creation/creationSchema";
import "../../features/create-flow/createFlow.css";
import "../../shared/ui/overlays/overlays.css";

function resolveCategory(categories, categoryId) {
  const list = Array.isArray(categories) ? categories : [];
  if (categoryId) {
    const match = list.find((c) => c?.id === categoryId);
    if (match) return match;
  }
  return list[0] || { id: "", name: "Catégorie requise", color: "#F97316" };
}

function resolveFlowHeader({ step, choice }) {
  if (step === "choice") {
    return {
      progress: "Départ",
      eyebrow: "Flow de création",
      title: "Créer quelque chose d’utile",
      subtitle: "Commence par une action simple. Tu pourras structurer davantage seulement si ça t’aide.",
    };
  }

  if (step === "outcome") {
    return {
      progress: choice === "guided" ? "Étape 1" : "Étape 1",
      eyebrow: choice === "guided" ? "Mode guidé" : `${LABELS.goal} avancé`,
      title: choice === "guided" ? "Structurer avant l’action" : `Créer un ${LABELS.goalLower}`,
      subtitle:
        choice === "guided"
          ? `On pose d’abord un ${LABELS.goalLower} clair, puis on enchaîne sur l’action.`
          : `Optionnel. Utilise ce mode si tu veux poser une direction avant d’agir.`,
    };
  }

  if (step === "outcome-next-action") {
    return {
      progress: "Étape 2",
      eyebrow: "Enchaînement",
      title: "Ajouter une action maintenant ?",
      subtitle: "Décision rapide. Tu peux aussi garder cet objectif seul pour l’instant.",
    };
  }

  if (step === "habit-type") {
    return {
      progress: choice === "guided" ? "Étape 2" : "Étape 1",
      eyebrow: "Type d’action",
      title: "Choisis ton niveau de cadrage",
      subtitle: "Ponctuelle, planifiée ou flexible: garde le format le plus crédible pour toi.",
    };
  }

  if (step === "habit-oneoff") {
    return {
      progress: choice === "guided" ? "Étape 3" : "Étape 2",
      eyebrow: "Action ponctuelle",
      title: "Cadre un seul moment",
      subtitle: "Date, moment, durée: juste ce qu’il faut pour agir vite.",
    };
  }

  if (step === "habit-recurring") {
    return {
      progress: choice === "guided" ? "Étape 3" : "Étape 2",
      eyebrow: "Action planifiée",
      title: "Cadre une routine crédible",
      subtitle: "Jours, moment, rappel: tout doit rester lisible et tenable.",
    };
  }

  if (step === "habit-anytime") {
    return {
      progress: choice === "guided" ? "Étape 3" : "Étape 2",
      eyebrow: "Action flexible",
      title: "Garde une fréquence légère",
      subtitle: "Un cadre suffisant pour exister, sans te rigidifier.",
    };
  }

  if (step === "link-outcome") {
    return {
      progress: "Optionnel",
      eyebrow: `${LABELS.goal} avancé`,
      title: `Lier cette action à un ${LABELS.goalLower} ?`,
      subtitle: "Ajoute une couche de structure seulement si elle clarifie vraiment le sujet.",
    };
  }

  if (step === "pick-category") {
    return {
      progress: "Finalisation",
      eyebrow: "Dernier réglage",
      title: "Confirme la catégorie finale",
      subtitle: "Un dernier check rapide avant de fermer le flow.",
    };
  }

  return {
    progress: "Créer",
    eyebrow: "Flow de création",
    title: "Créer",
    subtitle: "Avance étape par étape.",
  };
}

export default function CreateFlowModal({
  open,
  onClose,
  onChangeCategory,
  data,
  setData,
  categories,
  selectedCategoryId,
  flowSource = "create-modal",
  flowMode = "action",
  requestedStep = STEP_HABIT_TYPE,
  requestedHabitType = null,
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
  const draft = useMemo(() => normalizeCreationDraft(data?.ui?.createDraft), [data?.ui?.createDraft]);

  const resolvedSelected = useMemo(
    () => resolveCategory(categories, selectedCategoryId),
    [categories, selectedCategoryId]
  );
  const category = useMemo(() => resolveCategory(categories, categoryId), [categories, categoryId]);
  const categoryName = category?.name || "Catégorie";
  const categoryColor = category?.color || "#F97316";
  const initialPresentation = useMemo(
    () =>
      resolveCreateFlowPresentation({
        draft: {
          ...draft,
          mode: normalizeCreateFlowMode(flowMode || draft?.mode),
          step: requestedStep || draft?.step,
          habitType: requestedHabitType || draft?.habitType,
        },
        requestedMode: flowMode || draft?.mode,
        requestedStep: requestedStep || draft?.step,
      }),
    [draft, flowMode, requestedHabitType, requestedStep]
  );

  useEffect(() => {
    if (!open) return;
    const nextCategoryId =
      (draft?.category?.mode === "existing" ? draft.category.id : null) ||
      selectedCategoryId ||
      resolvedSelected?.id ||
      getFirstVisibleCategoryId(categories) ||
      null;
    setCategoryId(nextCategoryId);
    setStep(initialPresentation.step);
    setChoice(initialPresentation.choice);
    setShowLegacyChoices(initialPresentation.choice !== "action" || initialPresentation.step === "choice");
  }, [
    categories,
    draft?.category?.id,
    draft?.category?.mode,
    initialPresentation.choice,
    initialPresentation.step,
    open,
    resolvedSelected?.id,
    selectedCategoryId,
  ]);

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
    const nextMode = normalizeCreateFlowMode(nextChoice);
    setChoice(nextChoice);
    if (nextChoice === "action") {
      if (typeof seedCreateDraft === "function") {
        seedCreateDraft({ source: flowSource, categoryId, step: STEP_HABIT_TYPE, mode: nextMode });
      }
      setStep("habit-type");
    } else if (nextChoice === "project" || nextChoice === "guided") {
      if (typeof seedCreateDraft === "function") {
        seedCreateDraft({ source: flowSource, categoryId, step: STEP_OUTCOME, mode: nextMode });
      }
      setStep("outcome");
    }
  };

  const handleOutcomeSaved = (outcomeId, nextCategoryId) => {
    if (choice === "project") {
      setStep("outcome-next-action");
      return;
    }
    if (choice === "guided") {
      const catId = nextCategoryId || categoryId || getFirstVisibleCategoryId(categories) || null;
      if (typeof seedCreateDraft === "function") {
        seedCreateDraft({
          source: flowSource,
          categoryId: catId,
          outcomeId,
          step: STEP_HABIT_TYPE,
          mode: "guided",
          preserveDraft: true,
        });
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

  const currentDraftStep = (() => {
    if (step === "outcome") return STEP_OUTCOME;
    if (step === "outcome-next-action") return STEP_OUTCOME_NEXT_ACTION;
    if (step === "habit-type") return STEP_HABIT_TYPE;
    if (step === "habit-oneoff" || step === "habit-recurring" || step === "habit-anytime") return STEP_HABITS;
    if (step === "link-outcome") return STEP_LINK_OUTCOME;
    if (step === "pick-category") return STEP_PICK_CATEGORY;
    return choice === "project" || choice === "guided" ? STEP_OUTCOME : STEP_HABIT_TYPE;
  })();
  const flowHeader = resolveFlowHeader({ step, choice });

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
        className="modalPanelOuter createFlowPanelOuter GateGlassOuter"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="modalPanelClip createFlowPanelClip GateGlassClip GateGlassBackdrop">
          <div
            ref={panelRef}
            className="modalPanel createFlowModal gateModal gateModal--flow GateGlassContent"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <GatePanel className="createFlowShell gateModal gateModal--flow createFlowScope GateMainSection GateSurfacePremium GateCardPremium" data-testid="create-flow-modal">
        <GateHeader
          className="createFlowHeader"
          title={
            <span className="createFlowHeaderTitleBlock">
              <span className="createFlowHeaderEyebrow">{flowHeader.eyebrow}</span>
              <span>{flowHeader.title}</span>
            </span>
          }
          subtitle={<span className="createFlowHeaderSubtitle">{flowHeader.subtitle}</span>}
          actions={<GateBadge className="createFlowProgressBadge">{flowHeader.progress}</GateBadge>}
        />

        <GateRow
          className="createFlowCategoryRow GateRowPremium"
          right={(
            <GateButton
              variant="ghost"
              className="GatePressable"
              withSound
              onClick={() =>
                onChangeCategory?.({
                  source: flowSource,
                  mode: choice,
                  step: currentDraftStep,
                  habitType: requestedHabitType || draft?.habitType || null,
                  outcomeId: draft?.activeOutcomeId || draft?.createdOutcomeId || null,
                })
              }
              data-testid="create-change-category"
            >
              Modifier
            </GateButton>
          )}
        >
          <span className="createFlowSwatch" style={{ background: categoryColor }} />
          <div className="createFlowCategoryName">{categoryName}</div>
        </GateRow>

        <div className="createFlowBody">
          {step === "choice" ? (
            <div className="createFlowChoiceGrid">
              <CreateChoiceCard
                className={`createFlowChoiceCard${!canProceed ? " isDisabled" : ""}`}
                data-testid="create-choice-action"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canProceed) startChoice("action");
                }}
                title={LABELS.action}
                description="Voie recommandée. Tu pourras structurer ensuite si le sujet le demande."
              />
              {showLegacyChoices ? (
                <>
                  <CreateChoiceCard
                    className={`createFlowChoiceCard${!canProceed ? " isDisabled" : ""}`}
                    data-testid="create-choice-guided"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (canProceed) startChoice("guided");
                    }}
                    title={`Structurer avec un ${LABELS.goalLower} avancé`}
                    description={`Mode guidé: tu poses d’abord un ${LABELS.goalLower}, puis tu enchaînes sur l’action liée.`}
                  />
                  <CreateChoiceCard
                    className={`createFlowChoiceCard${!canProceed ? " isDisabled" : ""}`}
                    data-testid="create-choice-project"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (canProceed) startChoice("project");
                    }}
                    title={`Créer un ${LABELS.goalLower} avancé`}
                    description={`Seulement l’objectif pour l’instant, sans action liée.`}
                  />
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

              {step === "outcome-next-action" ? (
                <CreateV2OutcomeNextAction
                  data={data}
                  setData={setData}
                  onCreateAction={(outcomeId, nextCategoryId) => {
                    if (typeof seedCreateDraft === "function") {
                      seedCreateDraft({
                        source: flowSource,
                        categoryId: nextCategoryId || categoryId,
                        outcomeId,
                        step: STEP_HABIT_TYPE,
                        mode: "action",
                        preserveDraft: true,
                      });
                    }
                    setChoice("action");
                    setStep("habit-type");
                  }}
                  onDone={handleHabitDone}
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
