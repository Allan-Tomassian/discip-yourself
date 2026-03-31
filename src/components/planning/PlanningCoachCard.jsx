import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { getCategoryProfileSummary } from "../../domain/categoryProfile";
import { requestAiLocalAnalysis } from "../../infra/aiLocalAnalysisClient";
import { buildPlanningCoachFallback } from "../../features/planning/planningCoachModel";
import {
  buildPlanningManualAiContextKey,
  createPersistedLocalAnalysisEntry,
} from "../../features/manualAi/manualAiAnalysis";
import { resolveManualAiDisplayState } from "../../features/manualAi/displayState";
import { useManualAiAnalysis } from "../../hooks/useManualAiAnalysis";
import ManualAiStatus from "../ai/ManualAiStatus";
import { GateButton as Button, GateSection } from "../../shared/ui/gate/Gate";
import { getCategoryUiVars } from "../../utils/categoryAccent";
import { ANALYSIS_COPY, UI_COPY } from "../../ui/labels";
import { useBehaviorFeedback } from "../../feedback/BehaviorFeedbackContext";
import { deriveBehaviorFeedbackSignal } from "../../feedback/feedbackDerivers";
import "../categorySurface.css";

function renderSuggestion(reply) {
  const label = reply?.primaryAction?.label || "Ajuster le rythme";
  const duration = Number.isFinite(reply?.suggestedDurationMin) ? `${reply.suggestedDurationMin} min` : "";
  return [label, duration].filter(Boolean).join(" • ");
}

function resolveLocalAnalysisActionLabel(reply) {
  const intent = reply?.primaryAction?.intent || "";
  if (intent === "open_library") return "Ouvrir la bibliothèque";
  if (intent === "open_pilotage") return "Ouvrir Pilotage";
  return "Voir Today";
}

export default function PlanningCoachCard({
  data,
  setData,
  setTab,
  persistenceScope = "local_fallback",
  selectedDateKey,
  activeCategoryId = null,
  planningView = "day",
  occurrences = [],
  goalsById,
  categoriesById,
  activeCategory = null,
  onOpenCoach,
  onOpenPilotage,
}) {
  const { emitBehaviorFeedback } = useBehaviorFeedback();
  const { session } = useAuth();
  const accessToken = session?.access_token || "";
  const userId = session?.user?.id || "";
  const activeCategoryProfileSummary = useMemo(
    () => getCategoryProfileSummary(data, activeCategoryId),
    [activeCategoryId, data]
  );
  const fallbackReply = useMemo(
    () =>
      buildPlanningCoachFallback({
        selectedDateKey,
        activeCategoryId,
        activeCategoryProfileSummary,
        occurrences,
        goalsById,
        categoriesById,
      }),
    [activeCategoryId, activeCategoryProfileSummary, categoriesById, goalsById, occurrences, selectedDateKey]
  );
  const planningAnalysisContextKey = useMemo(
    () =>
      buildPlanningManualAiContextKey({
        userId,
        planningView,
        selectedDateKey,
        activeCategoryId,
      }),
    [activeCategoryId, planningView, selectedDateKey, userId]
  );
  const manualPlanningAnalysis = useManualAiAnalysis({
    data,
    setData,
    contextKey: planningAnalysisContextKey,
    surface: "planning",
  });
  const planningAnalysisState = useMemo(
    () =>
      resolveManualAiDisplayState({
        loading: manualPlanningAnalysis.loading,
        visibleAnalysis: manualPlanningAnalysis.visibleAnalysis,
        wasRefreshed: manualPlanningAnalysis.wasRefreshed,
      }),
    [manualPlanningAnalysis.loading, manualPlanningAnalysis.visibleAnalysis, manualPlanningAnalysis.wasRefreshed]
  );
  const [reply, setReply] = useState(null);
  useEffect(() => {
    setReply(null);
  }, [planningAnalysisContextKey]);

  const persistedReply = manualPlanningAnalysis.visibleAnalysis
    ? {
        kind: "chat",
        decisionSource: manualPlanningAnalysis.visibleAnalysis.decisionSource || "ai",
        headline: manualPlanningAnalysis.visibleAnalysis.headline,
        reason: manualPlanningAnalysis.visibleAnalysis.reason,
        primaryAction: manualPlanningAnalysis.visibleAnalysis.primaryAction,
        secondaryAction: manualPlanningAnalysis.visibleAnalysis.secondaryAction,
        suggestedDurationMin: manualPlanningAnalysis.visibleAnalysis.suggestedDurationMin,
      }
    : null;
  const visibleReply = reply || persistedReply || fallbackReply;

  async function handleAnalyzePlanning() {
    const result = await manualPlanningAnalysis.runAnalysis({
      execute: () =>
        requestAiLocalAnalysis({
          accessToken,
          payload: {
            selectedDateKey,
            activeCategoryId,
            surface: "planning",
            message:
              planningView === "week"
                ? "Analyse ce planning hebdomadaire et propose un ajustement prioritaire concret."
                : "Analyse ce planning du jour et propose un ajustement prioritaire concret.",
          },
        }),
      serializeSuccess: (success) =>
        createPersistedLocalAnalysisEntry({
          contextKey: planningAnalysisContextKey,
          surface: "planning",
          storageScope: persistenceScope,
          reply: success?.reply,
        }),
    });
    if (result?.ok && result.reply) {
      setReply(result.reply);
    }
  }

  function handleDismissPlanningAnalysis() {
    setReply(null);
    manualPlanningAnalysis.dismissAnalysis();
  }

  function handleOpenSuggestedSurface() {
    const action = visibleReply?.primaryAction || null;
    if (!action) return;
    if (action.intent === "open_pilotage") {
      onOpenPilotage?.();
      return;
    }
    if (action.intent === "open_library") {
      setTab?.("library");
      return;
    }
    setTab?.("today");
  }

  function handleOpenCoach(mode = "free") {
    onOpenCoach?.({ mode });
    emitBehaviorFeedback(
      deriveBehaviorFeedbackSignal({
        intent: mode === "plan" ? "open_structuring_coach" : "open_coach",
        payload: {
          surface: "planning",
          categoryId: activeCategoryId || null,
        },
      })
    );
  }

  return (
    <GateSection
      className={[
        "GateMainSection",
        "GateSecondarySectionCard",
        "planningSectionCard",
        "planningCoachSection",
        "GateSurfacePremium",
        "GateCardPremium",
      ]
        .filter(Boolean)
        .join(" ")}
      collapsible={false}
      style={activeCategory ? getCategoryUiVars(activeCategory, { level: "surface" }) : undefined}
    >
      <div className="planningSectionBody">
        <div className="planningSectionHeader planningSectionHeader--split">
          <div className="planningSectionHeaderText">
            <ManualAiStatus
              statusKind={planningAnalysisState.kind}
              statusLabel={planningAnalysisState.label}
              detailLabel={
                manualPlanningAnalysis.visibleAnalysis
                  ? persistenceScope === "cloud"
                    ? "Synchronisée sur tes appareils."
                    : ANALYSIS_COPY.savedOnDevice
                  : ""
              }
              stageLabel={manualPlanningAnalysis.loadingStageLabel}
            />
          </div>
          <div className="planningSectionActions">
            <Button size="sm" onClick={handleAnalyzePlanning} disabled={manualPlanningAnalysis.loading}>
              {manualPlanningAnalysis.loading
                ? manualPlanningAnalysis.loadingStageLabel || "Analyse..."
                : planningView === "week"
                  ? "Observer ma semaine"
                  : "Observer ma journée"}
            </Button>
            {manualPlanningAnalysis.isPersistedForContext ? (
              <Button size="sm" variant="ghost" onClick={handleDismissPlanningAnalysis}>
                {UI_COPY.backToLocalDiagnostic}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="planningCoachSummary">
          <div className="planningCoachBlock GateAnalyticsCard">
            <div className="small2 GateRoleCardMeta planningCoachLabel">Repère principal</div>
            <div className="small GateRoleHelperText">{visibleReply?.headline || "Ajustement du rythme"}</div>
          </div>
          <div className="planningCoachBlock GateAnalyticsCard">
            <div className="small2 GateRoleCardMeta planningCoachLabel">Ce que cela signale</div>
            <div className="small GateRoleHelperText">
              {visibleReply?.reason || "Le rythme a besoin d’un ajustement simple et crédible."}
            </div>
          </div>
          <div className="planningCoachBlock GateAnalyticsCard">
            <div className="small2 GateRoleCardMeta planningCoachLabel">Ajustement simple</div>
            <div className="small GateRoleHelperText">{renderSuggestion(visibleReply)}</div>
          </div>
        </div>

        {manualPlanningAnalysis.error ? (
          <div className="small2 planningSectionMeta">
            {manualPlanningAnalysis.error}
          </div>
        ) : null}

        <div className="planningSectionFooter planningCoachFooter">
          <Button size="sm" className="planningCoachPrimaryAction" onClick={handleOpenSuggestedSurface}>
            {resolveLocalAnalysisActionLabel(visibleReply)}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleOpenCoach("free")}>
            Parler au Coach
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleOpenCoach("plan")}>
            Passer en Plan
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpenPilotage?.()}>
            Relire mes progrès
          </Button>
        </div>
      </div>
    </GateSection>
  );
}
