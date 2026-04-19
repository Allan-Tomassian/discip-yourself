import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppCard,
  AppScreen,
  AppStickyFooter,
  ChoiceCard,
  FeedbackMessage,
  PrimaryButton,
  ScreenHeader,
  StatusBadge,
} from "../../shared/ui/app";
import { saveState } from "../../utils/storage";
import { todayLocalKey } from "../../utils/datetime";
import { useAuth } from "../../auth/useAuth";
import { buildAiFirstRunPlanRequest, requestAiFirstRunPlan } from "../../infra/aiFirstRunClient";
import {
  createEmptyFirstRunWindow,
  createInitialFirstRunState,
  getNextFirstRunStatus,
  getPreviousFirstRunStatus,
  normalizeFirstRunV1,
} from "./firstRunModel";
import {
  applyFirstRunGenerationFailure,
  applyFirstRunGenerationSuccess,
  buildFirstRunGenerationError,
  markFirstRunGenerationPending,
  retryFirstRunGenerationState,
  reuseFirstRunGeneratedPlans,
  shouldReuseFirstRunGeneratedPlans,
  shouldStartFirstRunGeneration,
} from "./firstRunGenerationState";
import FirstRunCommitScreen from "./FirstRunCommitScreen";
import FirstRunCompareScreen from "./FirstRunCompareScreen";
import FirstRunDiscoveryScreen from "./FirstRunDiscoveryScreen";
import FirstRunGenerateScreen from "./FirstRunGenerateScreen";
import FirstRunIntroScreen from "./FirstRunIntroScreen";
import FirstRunSignalsScreen from "./FirstRunSignalsScreen";
import FirstRunWhyScreen from "./FirstRunWhyScreen";
import "../create-flow/createFlow.css";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRuntimeLocale() {
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
    return typeof locale === "string" && locale.trim() ? locale : "fr-FR";
  } catch {
    return "fr-FR";
  }
}

function readRuntimeTimezone() {
  try {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timeZone === "string" && timeZone.trim() ? timeZone : "Europe/Paris";
  } catch {
    return "Europe/Paris";
  }
}

function toggleOrderedSelection(currentValues, nextValue, max = 3) {
  const safeValues = Array.isArray(currentValues) ? currentValues.filter(Boolean) : [];
  if (safeValues.includes(nextValue)) {
    return safeValues.filter((value) => value !== nextValue);
  }
  if (safeValues.length >= max) return safeValues;
  return [...safeValues, nextValue];
}

function replaceWindowInList(windows, windowId, patch) {
  return (Array.isArray(windows) ? windows : []).map((windowValue) =>
    windowValue?.id === windowId ? { ...windowValue, ...(patch && typeof patch === "object" ? patch : {}) } : windowValue
  );
}

function removeWindowFromList(windows, windowId) {
  return (Array.isArray(windows) ? windows : []).filter((windowValue) => windowValue?.id !== windowId);
}

function buildNextUi(baseUi, nextFirstRun) {
  const completed = nextFirstRun.status === "done";
  return {
    ...baseUi,
    firstRunV1: nextFirstRun,
    onboardingCompleted: completed,
    onboardingSeenVersion: completed ? Math.max(Number(baseUi?.onboardingSeenVersion) || 0, 3) : Number(baseUi?.onboardingSeenVersion) || 0,
    onboardingStep: completed ? 5 : 1,
    showPlanStep: false,
  };
}

function PlanOnlyScreen({ data, selectedPlan, onSelectPlan, onContinue }) {
  return (
    <AppScreen data={data} pageId="onboarding">
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
            L'accès IA Premium reste vérifié côté serveur au moment de l'utilisation.
          </FeedbackMessage>

          <div className="onboardingPlanGrid">
            <ChoiceCard
              className="onboardingPlanCard"
              title="Gratuit"
              description="L'essentiel pour démarrer avec un cadre simple."
              selected={selectedPlan === "free"}
              badge={selectedPlan === "free" ? "Actuel" : null}
              onClick={() => onSelectPlan("free")}
            />
            <ChoiceCard
              className="onboardingPlanCard"
              title="Premium"
              description="Plus de liberté, plus de profondeur, plus d'IA quand tu en as besoin."
              selected={selectedPlan === "premium"}
              badge={selectedPlan === "premium" ? "Actuel" : null}
              onClick={() => onSelectPlan("premium")}
            />
          </div>
        </div>

        <AppStickyFooter
          className="onboardingFooter"
          surfaceClassName="onboardingFooterSurface"
          actionsClassName="onboardingFooterActions"
        >
          <PrimaryButton onClick={onContinue}>Accéder à l'app</PrimaryButton>
        </AppStickyFooter>
      </AppCard>
    </AppScreen>
  );
}

export default function FirstRunFlow({ data, setData, onDone, planOnly = false }) {
  const { session } = useAuth();
  const safeData = isPlainObject(data) ? data : {};
  const safeUi = isPlainObject(safeData.ui) ? safeData.ui : {};
  const generationRequestRef = useRef({ token: 0, inputHash: null });
  const isUnmountedRef = useRef(false);
  const firstRun = useMemo(
    () =>
      normalizeFirstRunV1(safeUi.firstRunV1, {
        legacyOnboardingCompleted: safeUi.onboardingCompleted === true,
      }),
    [safeUi.firstRunV1, safeUi.onboardingCompleted]
  );
  const [planChoice, setPlanChoice] = useState(safeData?.profile?.plan === "premium" ? "premium" : "free");

  const updateFirstRun = useCallback(
    (updater) => {
      const optimisticCandidate = typeof updater === "function" ? updater(firstRun, safeData) : updater;
      const optimisticNextFirstRun = normalizeFirstRunV1(optimisticCandidate, {
        legacyOnboardingCompleted: safeUi.onboardingCompleted === true,
      });
      const optimisticNextState = {
        ...safeData,
        ui: buildNextUi(safeUi, optimisticNextFirstRun),
      };
      saveState(optimisticNextState);

      setData((previous) => {
        const safePrevious = isPlainObject(previous) ? previous : {};
        const baseUi = isPlainObject(safePrevious.ui) ? safePrevious.ui : {};
        const current = normalizeFirstRunV1(baseUi.firstRunV1, {
          legacyOnboardingCompleted: baseUi.onboardingCompleted === true,
        });
        const candidate = typeof updater === "function" ? updater(current, safePrevious) : updater;
        const nextFirstRun = normalizeFirstRunV1(candidate, {
          legacyOnboardingCompleted: baseUi.onboardingCompleted === true,
        });

        return {
          ...safePrevious,
          ui: buildNextUi(baseUi, nextFirstRun),
        };
      });
    },
    [firstRun, safeData, safeUi, setData]
  );

  const commitFirstRunFromLatest = useCallback(
    (updater) => {
      setData((previous) => {
        const safePrevious = isPlainObject(previous) ? previous : {};
        const baseUi = isPlainObject(safePrevious.ui) ? safePrevious.ui : {};
        const current = normalizeFirstRunV1(baseUi.firstRunV1, {
          legacyOnboardingCompleted: baseUi.onboardingCompleted === true,
        });
        const candidate = typeof updater === "function" ? updater(current, safePrevious) : updater;
        const nextFirstRun = normalizeFirstRunV1(candidate, {
          legacyOnboardingCompleted: baseUi.onboardingCompleted === true,
        });
        const nextState = {
          ...safePrevious,
          ui: buildNextUi(baseUi, nextFirstRun),
        };
        saveState(nextState);
        return nextState;
      });
    },
    [setData]
  );

  const patchDraftAnswers = useCallback(
    (patch) => {
      updateFirstRun((current) => ({
        ...current,
        draftAnswers: {
          ...current.draftAnswers,
          ...(patch && typeof patch === "object" ? patch : {}),
        },
        generatedPlans: null,
        inputHash: null,
        generationError: null,
        selectedPlanId: null,
        discoveryDone: false,
        lastUpdatedAt: new Date().toISOString(),
      }));
    },
    [updateFirstRun]
  );

  const patchWindowList = useCallback(
    (key, windowId, patch) => {
      patchDraftAnswers({
        [key]: replaceWindowInList(firstRun.draftAnswers?.[key], windowId, patch),
      });
    },
    [firstRun.draftAnswers, patchDraftAnswers]
  );

  const addWindowToList = useCallback(
    (key) => {
      patchDraftAnswers({
        [key]: [...(Array.isArray(firstRun.draftAnswers?.[key]) ? firstRun.draftAnswers[key] : []), createEmptyFirstRunWindow()],
      });
    },
    [firstRun.draftAnswers, patchDraftAnswers]
  );

  const removeWindowFromDraft = useCallback(
    (key, windowId) => {
      patchDraftAnswers({
        [key]: removeWindowFromList(firstRun.draftAnswers?.[key], windowId),
      });
    },
    [firstRun.draftAnswers, patchDraftAnswers]
  );

  const goToStatus = useCallback(
    (status) => {
      updateFirstRun((current) => ({
        ...current,
        status,
        lastUpdatedAt: new Date().toISOString(),
      }));
    },
    [updateFirstRun]
  );

  const goToSignalsFromGenerate = useCallback(() => {
    updateFirstRun((current) => {
      if (current.status === "generate") {
        generationRequestRef.current = { token: generationRequestRef.current.token + 1, inputHash: null };
      }
      if (current.status !== "generate") {
        return {
          ...current,
          status: "signals",
          lastUpdatedAt: new Date().toISOString(),
        };
      }
      return {
        ...current,
        status: "signals",
        inputHash: current.generatedPlans ? current.inputHash : null,
        generationError: current.generatedPlans ? current.generationError : null,
        lastUpdatedAt: new Date().toISOString(),
      };
    });
  }, [updateFirstRun]);

  const goNext = useCallback(() => {
    updateFirstRun((current) => ({
      ...current,
      status: getNextFirstRunStatus(current.status, current),
      lastUpdatedAt: new Date().toISOString(),
    }));
  }, [updateFirstRun]);

  const goBack = useCallback(() => {
    updateFirstRun((current) => ({
      ...current,
      status: getPreviousFirstRunStatus(current.status),
      lastUpdatedAt: new Date().toISOString(),
    }));
  }, [updateFirstRun]);

  const retryGeneration = useCallback(() => {
    updateFirstRun((current) => {
      if (current.status !== "generate") return current;
      generationRequestRef.current = { token: generationRequestRef.current.token + 1, inputHash: null };
      return retryFirstRunGenerationState(current);
    });
  }, [updateFirstRun]);

  useEffect(
    () => () => {
      isUnmountedRef.current = true;
      generationRequestRef.current = { token: generationRequestRef.current.token + 1, inputHash: null };
    },
    []
  );

  useEffect(() => {
    if (planOnly || firstRun.status !== "generate") return;

    async function runGeneration() {
      const { payload, inputHash } = await buildAiFirstRunPlanRequest({
        ...firstRun.draftAnswers,
        locale: readRuntimeLocale(),
        timezone: readRuntimeTimezone(),
        referenceDateKey: todayLocalKey(),
      });
      if (isUnmountedRef.current || firstRun.status !== "generate") return;

      const persistedPlans = firstRun.generatedPlans;
      if (shouldReuseFirstRunGeneratedPlans({ generatedPlans: persistedPlans, inputHash })) {
        commitFirstRunFromLatest((current) => {
          return reuseFirstRunGeneratedPlans(current, inputHash);
        });
        return;
      }

      if (
        !shouldStartFirstRunGeneration({
          firstRun: {
            status: firstRun.status,
            generationError: firstRun.generationError,
            inputHash: firstRun.inputHash,
          },
          inputHash,
          inFlightInputHash: generationRequestRef.current.inputHash,
        })
      ) {
        return;
      }

      const requestToken = generationRequestRef.current.token + 1;
      generationRequestRef.current = { token: requestToken, inputHash };

      commitFirstRunFromLatest((current) => {
        return markFirstRunGenerationPending(current, inputHash);
      });

      const result = await requestAiFirstRunPlan({
        accessToken: session?.access_token || "",
        payload,
      });
      if (isUnmountedRef.current) return;
      if (generationRequestRef.current.token !== requestToken || generationRequestRef.current.inputHash !== inputHash) return;

      generationRequestRef.current = { token: requestToken, inputHash: null };

      if (!result.ok) {
        commitFirstRunFromLatest((current) => {
          return applyFirstRunGenerationFailure(current, {
            inputHash,
            error: buildFirstRunGenerationError(result),
          });
        });
        return;
      }

      commitFirstRunFromLatest((current) => {
        return applyFirstRunGenerationSuccess(current, {
          inputHash,
          payload: result.payload,
        });
      });
    }

    void runGeneration();
  }, [
    firstRun.draftAnswers,
    firstRun.generatedPlans,
    firstRun.generationError,
    firstRun.inputHash,
    firstRun.status,
    planOnly,
    commitFirstRunFromLatest,
    session?.access_token,
  ]);

  const selectedPlan = useMemo(() => {
    const safePlans = Array.isArray(firstRun.generatedPlans?.plans) ? firstRun.generatedPlans.plans : [];
    return safePlans.find((plan) => plan.id === firstRun.selectedPlanId) || null;
  }, [firstRun.generatedPlans, firstRun.selectedPlanId]);

  const canContinueSignals = Boolean(
    (firstRun.draftAnswers?.primaryGoal || "").trim() &&
      firstRun.draftAnswers?.currentCapacity &&
      Array.isArray(firstRun.draftAnswers?.priorityCategoryIds) &&
      firstRun.draftAnswers.priorityCategoryIds.length > 0
  );

  if (planOnly) {
    return (
      <PlanOnlyScreen
        data={safeData}
        selectedPlan={planChoice}
        onSelectPlan={setPlanChoice}
        onContinue={() => {
          setData((previous) => {
            const safePrevious = isPlainObject(previous) ? previous : {};
            const baseUi = isPlainObject(safePrevious.ui) ? safePrevious.ui : {};
            const nextFirstRun = createInitialFirstRunState(
              { status: "done", discoveryDone: true },
              { legacyOnboardingCompleted: true }
            );

            return {
              ...safePrevious,
              profile: {
                ...(safePrevious.profile || {}),
                plan: planChoice,
              },
              ui: buildNextUi(baseUi, nextFirstRun),
            };
          });
          if (typeof onDone === "function") onDone();
        }}
      />
    );
  }

  if (firstRun.status === "intro") {
    return <FirstRunIntroScreen data={safeData} onStart={() => goToStatus("why")} />;
  }

  if (firstRun.status === "why") {
    return (
      <FirstRunWhyScreen
        data={safeData}
        value={firstRun.draftAnswers?.whyText || ""}
        onChange={(value) => patchDraftAnswers({ whyText: value })}
        onBack={goBack}
        onContinue={goNext}
      />
    );
  }

  if (firstRun.status === "signals") {
    return (
      <FirstRunSignalsScreen
        data={safeData}
        draftAnswers={firstRun.draftAnswers}
        canContinue={canContinueSignals}
        onBack={goBack}
        onContinue={goNext}
        onPrimaryGoalChange={(value) => patchDraftAnswers({ primaryGoal: value })}
        onCapacityChange={(value) => patchDraftAnswers({ currentCapacity: value })}
        onTogglePriorityCategory={(categoryId) =>
          patchDraftAnswers({
            priorityCategoryIds: toggleOrderedSelection(firstRun.draftAnswers?.priorityCategoryIds, categoryId, 3),
          })
        }
        onAddUnavailableWindow={() => addWindowToList("unavailableWindows")}
        onPatchUnavailableWindow={(windowId, patch) => patchWindowList("unavailableWindows", windowId, patch)}
        onRemoveUnavailableWindow={(windowId) => removeWindowFromDraft("unavailableWindows", windowId)}
        onAddPreferredWindow={() => addWindowToList("preferredWindows")}
        onPatchPreferredWindow={(windowId, patch) => patchWindowList("preferredWindows", windowId, patch)}
        onRemovePreferredWindow={(windowId) => removeWindowFromDraft("preferredWindows", windowId)}
      />
    );
  }

  if (firstRun.status === "generate") {
    return (
      <FirstRunGenerateScreen
        data={safeData}
        isLoading={!firstRun.generatedPlans && !firstRun.generationError}
        error={firstRun.generationError}
        goalLabel={firstRun.draftAnswers?.primaryGoal || ""}
        onBack={goToSignalsFromGenerate}
        onRetry={retryGeneration}
      />
    );
  }

  if (firstRun.status === "compare") {
    return (
      <FirstRunCompareScreen
        data={safeData}
        generatedPlans={firstRun.generatedPlans}
        selectedPlanId={firstRun.selectedPlanId}
        onBack={() => goToStatus("signals")}
        onSelectPlan={(planId) =>
          updateFirstRun((current) => ({
            ...current,
            selectedPlanId: planId,
            lastUpdatedAt: new Date().toISOString(),
          }))
        }
        onContinue={goNext}
      />
    );
  }

  if (firstRun.status === "commit") {
    return <FirstRunCommitScreen data={safeData} selectedPlan={selectedPlan} onBack={goBack} onContinue={goNext} />;
  }

  return (
    <FirstRunDiscoveryScreen
      data={safeData}
      onComplete={() => {
        updateFirstRun((current) => ({
          ...current,
          status: "done",
          discoveryDone: true,
          lastUpdatedAt: new Date().toISOString(),
        }));
        if (typeof onDone === "function") onDone();
      }}
    />
  );
}
