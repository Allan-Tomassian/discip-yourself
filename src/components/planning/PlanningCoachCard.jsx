import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { getCategoryProfileSummary } from "../../domain/categoryProfile";
import { requestAiCoachChat } from "../../infra/aiCoachChatClient";
import { applyChatDraftChanges } from "../../logic/chatDraftChanges";
import { buildPlanningCoachFallback } from "../../features/planning/planningCoachModel";
import {
  buildPlanningManualAiContextKey,
  createPersistedChatAnalysisEntry,
} from "../../features/manualAi/manualAiAnalysis";
import { resolveManualAiDisplayState } from "../../features/manualAi/displayState";
import { useManualAiAnalysis } from "../../hooks/useManualAiAnalysis";
import ManualAiStatus from "../ai/ManualAiStatus";
import { GateButton as Button, GateSection } from "../../shared/ui/gate/Gate";
import { getCategoryUiVars } from "../../utils/categoryAccent";
import "../categorySurface.css";

function describeDraftChange(change, { goalsById, categoriesById }) {
  if (!change || typeof change !== "object") return "";
  const goalTitle =
    (typeof change.title === "string" && change.title.trim()) ||
    goalsById.get(change.actionId || "")?.title ||
    "Action";
  const categoryName = categoriesById.get(change.categoryId || "")?.name || null;
  const timingBits = [];
  if (change.dateKey) timingBits.push(change.dateKey);
  if (change.startTime) timingBits.push(change.startTime);
  if (Number.isFinite(change.durationMin)) timingBits.push(`${change.durationMin} min`);
  return [goalTitle, categoryName, ...timingBits].filter(Boolean).join(" · ");
}

function renderSuggestion(reply) {
  const label = reply?.primaryAction?.label || "Ajuster le planning";
  const duration = Number.isFinite(reply?.suggestedDurationMin) ? `${reply.suggestedDurationMin} min` : "";
  return [label, duration].filter(Boolean).join(" • ");
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
  const [ignoredDraftKey, setIgnoredDraftKey] = useState("");
  const [applying, setApplying] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  useEffect(() => {
    setReply(null);
    setIgnoredDraftKey("");
    setDraftMessage("");
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
        draftChanges: [],
      }
    : null;
  const visibleReply = reply || persistedReply || fallbackReply;
  const draftChanges = Array.isArray(reply?.draftChanges) ? reply.draftChanges : [];
  const draftKey = draftChanges.length ? JSON.stringify(draftChanges) : "";
  const showDraft = Boolean(draftChanges.length && draftKey !== ignoredDraftKey);

  async function handleAnalyzePlanning() {
    setDraftMessage("");
    setIgnoredDraftKey("");
    const result = await manualPlanningAnalysis.runAnalysis({
      execute: () =>
        requestAiCoachChat({
          accessToken,
          payload: {
            selectedDateKey,
            activeCategoryId,
            message:
              planningView === "week"
                ? "Analyse ce planning hebdomadaire et propose un ajustement prioritaire concret."
                : "Analyse ce planning du jour et propose un ajustement prioritaire concret.",
            recentMessages: [],
          },
        }),
      serializeSuccess: (success) =>
        createPersistedChatAnalysisEntry({
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
    setIgnoredDraftKey("");
    setDraftMessage("");
    manualPlanningAnalysis.dismissAnalysis();
  }

  function applyDraft() {
    if (!showDraft || applying) return;
    setApplying(true);
    setDraftMessage("");
    let result = { state: data, appliedCount: 0, navigationTarget: null };
    setData((previous) => {
      result = applyChatDraftChanges(previous, draftChanges);
      return result.state;
    });
    if (result.appliedCount > 0) {
      setDraftMessage(
        result.appliedCount > 1 ? `${result.appliedCount} changements appliqués.` : "Brouillon appliqué."
      );
      if (result.navigationTarget) setTab?.(result.navigationTarget);
      setIgnoredDraftKey(draftKey);
    } else {
      setDraftMessage("Aucun changement applicable dans l’état actuel.");
    }
    setApplying(false);
  }

  return (
    <GateSection
      className={[
        "GateMainSection",
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
            <div className="titleSm">Coach Planning</div>
            <ManualAiStatus
              statusKind={planningAnalysisState.kind}
              statusLabel={planningAnalysisState.label}
              detailLabel={
                manualPlanningAnalysis.visibleAnalysis
                  ? persistenceScope === "cloud"
                    ? "Synchronisée sur tes appareils."
                    : "Enregistrée sur cet appareil."
                  : ""
              }
              stageLabel={manualPlanningAnalysis.loadingStageLabel}
            />
          </div>
          <div className="planningSectionActions">
            <Button onClick={handleAnalyzePlanning} disabled={manualPlanningAnalysis.loading}>
              {manualPlanningAnalysis.loading
                ? manualPlanningAnalysis.loadingStageLabel || "Analyse..."
                : planningView === "week"
                  ? "Analyser ma semaine"
                  : "Analyser ma journée"}
            </Button>
            {manualPlanningAnalysis.isPersistedForContext ? (
              <Button variant="ghost" onClick={handleDismissPlanningAnalysis}>
                Revenir au diagnostic local
              </Button>
            ) : null}
          </div>
        </div>

        <div className="planningCoachSummary">
          <div className="planningCoachBlock">
            <div className="small2 planningCoachLabel">Ajustement proposé</div>
            <div className="titleSm">{visibleReply?.headline || "Ajustement du planning"}</div>
          </div>
          <div className="planningCoachBlock">
            <div className="small2 planningCoachLabel">Ce qui compte</div>
            <div className="small">{visibleReply?.reason || "Le planning a besoin d’un ajustement simple et crédible."}</div>
          </div>
          <div className="planningCoachBlock">
            <div className="small2 planningCoachLabel">Prochain pas</div>
            <div className="small">{renderSuggestion(visibleReply)}</div>
          </div>
        </div>

        {manualPlanningAnalysis.error ? (
          <div className="small2 planningSectionMeta">
            {manualPlanningAnalysis.error}
          </div>
        ) : null}

        {showDraft ? (
          <div className="planningDraftSection">
            <div className="small2 planningCoachLabel">Brouillon proposé</div>
            <div className="col" style={{ gap: 6 }}>
              {draftChanges.map((change, index) => (
                <div key={`planning-draft-${index}`} className="small2">
                  {describeDraftChange(change, { goalsById, categoriesById })}
                </div>
              ))}
            </div>
            <div className="planningSectionFooter">
              <Button onClick={applyDraft} disabled={applying}>
                {applying ? "Application..." : "Appliquer"}
              </Button>
              <Button variant="ghost" onClick={() => setIgnoredDraftKey(draftKey)}>
                Ignorer
              </Button>
            </div>
          </div>
        ) : null}

        {draftMessage ? (
          <div className="small2 planningSectionMeta">
            {draftMessage}
          </div>
        ) : null}

        <div className="planningSectionFooter planningCoachFooter">
          <Button variant="ghost" onClick={() => onOpenCoach?.()}>
            Ouvrir le coach
          </Button>
          <Button variant="ghost" onClick={() => onOpenPilotage?.()}>
            Voir mes progrès
          </Button>
        </div>
      </div>
    </GateSection>
  );
}
