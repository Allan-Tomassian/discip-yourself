import React, { useMemo, useState } from "react";
import {
  AppCard,
  AppScreen,
  AppStickyFooter,
  ChoiceCard,
  FeedbackMessage,
  GhostButton,
  PrimaryButton,
  ScreenHeader,
  StatusBadge,
} from "../shared/ui/app";
import "../features/create-flow/createFlow.css";
import { buildInitialAiFoundationState } from "../logic/aiFoundation";
import { migrate } from "../logic/state";
import {
  USER_AI_CATEGORY_META,
  USER_AI_INTENSITIES,
  USER_AI_STRUCTURES,
  USER_AI_TIME_BUDGETS,
  USER_AI_TIME_BLOCK_WINDOWS,
  normalizeUserAiProfile,
} from "../domain/userAiProfile";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExistingPlanningData(state) {
  const categories = Array.isArray(state?.categories) ? state.categories : [];
  const goals = Array.isArray(state?.goals) ? state.goals : [];
  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const nonSystemCategories = categories.filter((category) => category?.id && category.id !== "sys_inbox");
  return nonSystemCategories.length > 0 || goals.length > 0 || occurrences.length > 0;
}

function OptionCard({ title, description, selected, disabled = false, onClick, badge = "" }) {
  return (
    <ChoiceCard
      title={title}
      description={description}
      selected={selected}
      disabled={disabled}
      badge={badge || null}
      className="onboardingOptionCard"
      onClick={onClick}
    />
  );
}

function toggleOrderedSelection(currentValues, nextValue, max = 3) {
  const safeValues = Array.isArray(currentValues) ? currentValues.filter(Boolean) : [];
  if (safeValues.includes(nextValue)) {
    return safeValues.filter((value) => value !== nextValue);
  }
  if (safeValues.length >= max) return safeValues;
  return [...safeValues, nextValue];
}

export default function Onboarding({ data, setData, onDone, planOnly = false }) {
  const safeData = isPlainObject(data) ? data : {};
  const normalizedAiProfile = normalizeUserAiProfile(safeData.user_ai_profile);

  const [step, setStep] = useState(0);
  const [planChoice, setPlanChoice] = useState(safeData?.profile?.plan === "premium" ? "premium" : "free");
  const [selectedGoals, setSelectedGoals] = useState(normalizedAiProfile.goals);
  const [budgetMinutes, setBudgetMinutes] = useState(normalizedAiProfile.time_budget_daily_min || 60);
  const [intensityPreference, setIntensityPreference] = useState(
    normalizedAiProfile.intensity_preference || USER_AI_INTENSITIES[1]
  );
  const [preferredTimeBlocks, setPreferredTimeBlocks] = useState(
    normalizedAiProfile.preferred_time_blocks.length ? normalizedAiProfile.preferred_time_blocks : ["morning"]
  );
  const [structurePreference, setStructurePreference] = useState(
    normalizedAiProfile.structure_preference || USER_AI_STRUCTURES[1]
  );

  const questionScreens = useMemo(
    () => [
      {
        key: "goals",
        title: "Choisis tes priorités",
        subtitle: "Maximum 3 domaines. Ils deviendront tes premières catégories stables.",
        valid: selectedGoals.length > 0,
        content: (
          <div className="onboardingOptionGrid">
            {Object.values(USER_AI_CATEGORY_META).map((goalMeta) => {
              const selected = selectedGoals.includes(goalMeta.id);
              const selectionIndex = selectedGoals.indexOf(goalMeta.id);
              return (
                <OptionCard
                  key={goalMeta.id}
                  title={goalMeta.label}
                  description="Servira de base pour un premier chantier clair, avec une direction et des actions."
                  selected={selected}
                  badge={selected ? `#${selectionIndex + 1}` : ""}
                  disabled={!selected && selectedGoals.length >= 3}
                  onClick={() => {
                    setSelectedGoals((previous) => toggleOrderedSelection(previous, goalMeta.id, 3));
                  }}
                />
              );
            })}
          </div>
        ),
      },
      {
        key: "budget",
        title: "Temps quotidien",
        subtitle: "Choisis une base crédible pour démarrer simplement.",
        valid: USER_AI_TIME_BUDGETS.includes(Number(budgetMinutes)),
        content: (
          <div className="onboardingOptionGrid">
            {USER_AI_TIME_BUDGETS.map((value) => (
              <OptionCard
                key={value}
                title={`${value} min / jour`}
                description={value <= 60 ? "Sobre et tenable." : "Plus ambitieux, mais encore lisible."}
                selected={budgetMinutes === value}
                onClick={() => setBudgetMinutes(value)}
              />
            ))}
          </div>
        ),
      },
      {
        key: "intensity",
        title: "Intensité souhaitée",
        subtitle: "On règle le rythme de départ, pas un engagement figé.",
        valid: USER_AI_INTENSITIES.includes(intensityPreference),
        content: (
          <div className="onboardingOptionGrid">
            <OptionCard
              title="Léger"
              description="Des actions plus courtes et un cadre plus souple."
              selected={intensityPreference === "light"}
              onClick={() => setIntensityPreference("light")}
            />
            <OptionCard
              title="Équilibré"
              description="Le mode par défaut: crédible, progressif, durable."
              selected={intensityPreference === "balanced"}
              onClick={() => setIntensityPreference("balanced")}
            />
            <OptionCard
              title="Soutenu"
              description="Plus de place aux blocs principaux quand c’est crédible."
              selected={intensityPreference === "intense"}
              onClick={() => setIntensityPreference("intense")}
            />
          </div>
        ),
      },
      {
        key: "time-blocks",
        title: "Moments préférés",
        subtitle: "Choisis un à trois moments. Ils aideront surtout à poser un rythme simple.",
        valid: preferredTimeBlocks.length > 0,
        content: (
          <div className="onboardingOptionGrid">
            {Object.values(USER_AI_TIME_BLOCK_WINDOWS).map((timeBlock) => {
              const selected = preferredTimeBlocks.includes(timeBlock.id);
              const selectionIndex = preferredTimeBlocks.indexOf(timeBlock.id);
              return (
                <OptionCard
                  key={timeBlock.id}
                  title={timeBlock.label}
                  description={`${timeBlock.windowStart} - ${timeBlock.windowEnd}`}
                  selected={selected}
                  badge={selected ? `#${selectionIndex + 1}` : ""}
                  onClick={() => {
                    setPreferredTimeBlocks((previous) => toggleOrderedSelection(previous, timeBlock.id, 3));
                  }}
                />
              );
            })}
          </div>
        ),
      },
      {
        key: "structure",
        title: "Niveau de structure",
        subtitle: "On prépare Aujourd'hui, pas une configuration complète du système.",
        valid: USER_AI_STRUCTURES.includes(structurePreference),
        content: (
          <div className="onboardingOptionGrid">
            <OptionCard
              title="Simple"
              description="Des blocs souples, sans rigidité horaire."
              selected={structurePreference === "simple"}
              onClick={() => setStructurePreference("simple")}
            />
            <OptionCard
              title="Structuré"
              description="Un premier bloc fixe, puis de la souplesse autour."
              selected={structurePreference === "structured"}
              onClick={() => setStructurePreference("structured")}
            />
            <OptionCard
              title="Optimisé"
              description="Des créneaux plus précis, sans basculer dans l’usine à gaz."
              selected={structurePreference === "optimized"}
              onClick={() => setStructurePreference("optimized")}
            />
          </div>
        ),
      },
    ],
    [budgetMinutes, intensityPreference, preferredTimeBlocks, selectedGoals, structurePreference]
  );

  const currentScreen = questionScreens[step];
  const canContinue = Boolean(currentScreen?.valid);
  const finishOnboarding = () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nextProfile = {
      goals: selectedGoals,
      time_budget_daily_min: budgetMinutes,
      intensity_preference: intensityPreference,
      preferred_time_blocks: preferredTimeBlocks,
      structure_preference: structurePreference,
      created_at: normalizedAiProfile.created_at || nowIso,
      updated_at: nowIso,
      adaptation: {
        ...(normalizedAiProfile.adaptation || {}),
        implicit_intensity: intensityPreference,
        suggestion_stability: normalizedAiProfile.adaptation?.suggestion_stability || "medium",
        behavior_window_days: 7,
        last_behavior_update_at: normalizedAiProfile.adaptation?.last_behavior_update_at || "",
      },
    };

    setData((previous) => {
      const safePrevious = isPlainObject(previous) ? previous : {};
      if (hasExistingPlanningData(safePrevious)) {
        return migrate({
          ...safePrevious,
          user_ai_profile: nextProfile,
          ui: {
            ...(safePrevious.ui || {}),
            onboardingCompleted: true,
            onboardingSeenVersion: 3,
            onboardingStep: 5,
            showPlanStep: false,
          },
        });
      }

      return buildInitialAiFoundationState(safePrevious, nextProfile, now);
    });
    if (typeof onDone === "function") onDone();
  };

  if (planOnly) {
    return (
      <AppScreen data={safeData} pageId="onboarding">
        <AppCard variant="elevated" className="onboardingShell createFlowScope">
          <ScreenHeader
            className="createFlowHeader"
            title={
              <span className="createFlowHeaderTitleBlock">
                <span className="createFlowHeaderEyebrow">Abonnement</span>
                <span>Choisis ton plan</span>
              </span>
            }
            subtitle="Aucune facturation ici. Tu pourras ajuster ce choix plus tard."
            actions={<StatusBadge>Plan</StatusBadge>}
          />

          <div className="onboardingBody">
            <FeedbackMessage tone="info" className="onboardingHint">
              L’accès IA Premium reste vérifié côté serveur au moment de l’utilisation.
            </FeedbackMessage>

            <div className="onboardingPlanGrid">
              <ChoiceCard
                className="onboardingPlanCard"
                title="Gratuit"
                description="L’essentiel pour démarrer avec un cadre simple."
                selected={planChoice === "free"}
                badge={planChoice === "free" ? "Actuel" : null}
                onClick={() => setPlanChoice("free")}
              />
              <ChoiceCard
                className="onboardingPlanCard"
                title="Premium"
                description="Plus de liberté, plus de profondeur, plus d’IA quand tu en as besoin."
                selected={planChoice === "premium"}
                badge={planChoice === "premium" ? "Actuel" : null}
                onClick={() => setPlanChoice("premium")}
              />
            </div>
          </div>

          <AppStickyFooter
            className="onboardingFooter"
            surfaceClassName="onboardingFooterSurface"
            actionsClassName="onboardingFooterActions"
          >
            <PrimaryButton
              onClick={() => {
                setData((previous) =>
                  migrate({
                    ...previous,
                    profile: {
                      ...(previous?.profile || {}),
                      plan: planChoice,
                    },
                    ui: {
                      ...(previous?.ui || {}),
                      onboardingCompleted: true,
                      onboardingStep: 5,
                      showPlanStep: false,
                    },
                  })
                );
                if (typeof onDone === "function") onDone();
              }}
            >
              Accéder à l’app
            </PrimaryButton>
          </AppStickyFooter>
        </AppCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen data={safeData} pageId="onboarding">
      <AppCard variant="elevated" className="onboardingShell createFlowScope">
        <ScreenHeader
          className="createFlowHeader"
          title={
            <span className="createFlowHeaderTitleBlock">
              <span className="createFlowHeaderEyebrow">Setup initial</span>
              <span>{currentScreen?.title || "Onboarding"}</span>
            </span>
          }
          subtitle={currentScreen?.subtitle || ""}
          actions={<StatusBadge>{step + 1}/{questionScreens.length}</StatusBadge>}
        />

        <div className="onboardingBody">{currentScreen?.content}</div>

          <AppStickyFooter
            className="onboardingFooter"
            surfaceClassName="onboardingFooterSurface"
            actionsClassName="onboardingFooterActions"
          >
          <GhostButton
            disabled={step === 0}
            onClick={() => {
              if (step === 0) return;
              setStep((previous) => Math.max(0, previous - 1));
            }}
          >
            Retour
          </GhostButton>
          <PrimaryButton
            disabled={!canContinue}
            onClick={() => {
              if (!canContinue) return;
              if (step < questionScreens.length - 1) {
                setStep((previous) => previous + 1);
                return;
              }
              finishOnboarding();
            }}
          >
            {step === questionScreens.length - 1 ? "Créer mon plan" : "Continuer"}
          </PrimaryButton>
        </AppStickyFooter>
      </AppCard>
    </AppScreen>
  );
}
