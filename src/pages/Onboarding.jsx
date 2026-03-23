import React, { useMemo, useState } from "react";
import { Badge, Button, Card } from "../components/UI";
import ScreenShell from "./_ScreenShell";
import { BRAND_ACCENT } from "../theme/themeTokens";
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

const ACCENT = `var(--accent, ${BRAND_ACCENT})`;
const BORDER_DEFAULT = "var(--border)";
const SURFACE_SOFT = "var(--surface)";

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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        borderRadius: 16,
        border: `1px solid ${selected ? ACCENT : BORDER_DEFAULT}`,
        background: selected ? "rgba(255,255,255,0.08)" : SURFACE_SOFT,
        padding: 14,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div className="titleSm">{title}</div>
        {badge ? <Badge>{badge}</Badge> : null}
      </div>
      {description ? (
        <div className="small" style={{ marginTop: 6 }}>
          {description}
        </div>
      ) : null}
    </button>
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
        title: "Choisis tes priorites",
        subtitle: "Maximum 3 domaines. L'ordre de selection devient ton ordre de priorite.",
        valid: selectedGoals.length > 0,
        content: (
          <div className="col" style={{ gap: 10 }}>
            {Object.values(USER_AI_CATEGORY_META).map((goalMeta) => {
              const selected = selectedGoals.includes(goalMeta.id);
              const selectionIndex = selectedGoals.indexOf(goalMeta.id);
              return (
                <OptionCard
                  key={goalMeta.id}
                  title={goalMeta.label}
                  description="Sera utilise pour creer tes premieres categories et actions."
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
        subtitle: "Choisis un budget credible pour aujourd'hui.",
        valid: USER_AI_TIME_BUDGETS.includes(Number(budgetMinutes)),
        content: (
          <div className="col" style={{ gap: 10 }}>
            {USER_AI_TIME_BUDGETS.map((value) => (
              <OptionCard
                key={value}
                title={`${value} min / jour`}
                description={value <= 60 ? "Lean et tenable." : "Plus ambitieux, mais encore lisible."}
                selected={budgetMinutes === value}
                onClick={() => setBudgetMinutes(value)}
              />
            ))}
          </div>
        ),
      },
      {
        key: "intensity",
        title: "Intensite souhaitee",
        subtitle: "On regle la charge initiale, pas un engagement definitif.",
        valid: USER_AI_INTENSITIES.includes(intensityPreference),
        content: (
          <div className="col" style={{ gap: 10 }}>
            <OptionCard
              title="Light"
              description="Actions plus courtes, slots plus souples."
              selected={intensityPreference === "light"}
              onClick={() => setIntensityPreference("light")}
            />
            <OptionCard
              title="Balanced"
              description="Le mode par defaut: credible et progressif."
              selected={intensityPreference === "balanced"}
              onClick={() => setIntensityPreference("balanced")}
            />
            <OptionCard
              title="Intense"
              description="Priorite aux blocs principaux quand c'est credible."
              selected={intensityPreference === "intense"}
              onClick={() => setIntensityPreference("intense")}
            />
          </div>
        ),
      },
      {
        key: "time-blocks",
        title: "Moments preferes",
        subtitle: "Choisis un ou plusieurs moments. L'ordre sert de priorite de placement.",
        valid: preferredTimeBlocks.length > 0,
        content: (
          <div className="col" style={{ gap: 10 }}>
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
        subtitle: "Plus tu structures, plus Today sera precise des l'ouverture.",
        valid: USER_AI_STRUCTURES.includes(structurePreference),
        content: (
          <div className="col" style={{ gap: 10 }}>
            <OptionCard
              title="Simple"
              description="Blocs souples, sans rigidite horaire."
              selected={structurePreference === "simple"}
              onClick={() => setStructurePreference("simple")}
            />
            <OptionCard
              title="Structured"
              description="Un premier bloc fixe, le reste reste flexible."
              selected={structurePreference === "structured"}
              onClick={() => setStructurePreference("structured")}
            />
            <OptionCard
              title="Optimized"
              description="Des slots les plus precis possibles, sans refonte lourde."
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
      <ScreenShell data={safeData} pageId="onboarding" headerTitle="Abonnement" headerSubtitle="Choisis ton plan">
        <Card accentBorder>
          <div className="p18">
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="titleSm">Choisis ton plan</div>
                <div className="small">Aucune facturation ici. Tu pourras changer plus tard.</div>
                <div className="small2" style={{ marginTop: 6, opacity: 0.9 }}>
                  L’acces IA Premium sera toujours verifie cote serveur au moment de l’utilisation.
                </div>
              </div>
              <Badge>Plan</Badge>
            </div>

            <div className="mt14 grid2">
              <Card accentBorder style={{ borderColor: planChoice === "free" ? ACCENT : BORDER_DEFAULT }}>
                <div className="p18 col">
                  <div className="titleSm">Gratuit</div>
                  <div className="small2">L’essentiel pour demarrer.</div>
                  <Button
                    variant={planChoice === "free" ? "primary" : "ghost"}
                    onClick={() => setPlanChoice("free")}
                  >
                    {planChoice === "free" ? "Selectionne" : "Choisir Gratuit"}
                  </Button>
                </div>
              </Card>

              <Card accentBorder style={{ borderColor: planChoice === "premium" ? ACCENT : BORDER_DEFAULT }}>
                <div className="p18 col">
                  <div className="titleSm">Premium</div>
                  <div className="small2">Liberte totale et reglages avances.</div>
                  <Button
                    variant={planChoice === "premium" ? "primary" : "ghost"}
                    onClick={() => setPlanChoice("premium")}
                  >
                    {planChoice === "premium" ? "Selectionne" : "Choisir Premium"}
                  </Button>
                </div>
              </Card>
            </div>

            <div className="mt12">
              <Button
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
                Acceder a l’app
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="onboarding"
      headerTitle={currentScreen?.title || "Onboarding"}
      headerSubtitle={`${currentScreen?.subtitle || ""} · ${step + 1}/${questionScreens.length}`}
    >
      <Card accentBorder>
        <div className="p18 col" style={{ gap: 14 }}>
          {currentScreen?.content}
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Button
              variant="ghost"
              onClick={() => {
                if (step === 0) return;
                setStep((previous) => Math.max(0, previous - 1));
              }}
            >
              Retour
            </Button>
            <Button
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
              {step === questionScreens.length - 1 ? "Creer mon plan" : "Continuer"}
            </Button>
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
}
