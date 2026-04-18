import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { normalizeLibraryFocusTarget } from "../app/coachCreatedViewTarget";
import AiDebugLine from "../components/ai/AiDebugLine";
import ManualAiStatus from "../components/ai/ManualAiStatus";
import {
  getStoredLibraryActiveCategoryId,
  getVisibleCategories,
  withLibraryActiveCategoryId,
} from "../domain/categoryVisibility";
import { resolveManualAiDisplayState } from "../features/manualAi/displayState";
import {
  buildObjectivesManualAiContextKey,
  createPersistedLocalAnalysisEntry,
} from "../features/manualAi/manualAiAnalysis";
import {
  buildObjectivesControlRoom,
  OBJECTIVES_HORIZONS,
  OBJECTIVES_LENSES,
  normalizeObjectivesHorizon,
  normalizeObjectivesLens,
} from "../features/objectives/objectivesControlModel";
import { useManualAiAnalysis } from "../hooks/useManualAiAnalysis";
import { requestAiLocalAnalysis } from "../infra/aiLocalAnalysisClient";
import {
  AppActionRow,
  AppChip,
  AppScreen,
  CompactCategoryFilter,
  GhostButton,
  PrimaryButton,
  StatusBadge,
} from "../shared/ui/app";
import { OBJECTIVES_SCREEN_COPY, UI_COPY } from "../ui/labels";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { todayLocalKey } from "../utils/datetime";
import "../features/objectives/objectivesControlRoom.css";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round((Number.isFinite(value) ? value : 0) * 100)));
}

function ObjectiveRing({ progress = 0, color = "#8b78ff" }) {
  const circumference = 2 * Math.PI * 21;
  const offset = circumference - circumference * Math.max(0, Math.min(1, progress));
  return (
    <div className="lovableObjectiveRing" aria-hidden="true">
      <svg viewBox="0 0 52 52">
        <circle className="lovableObjectiveRingTrack" cx="26" cy="26" r="21" />
        <circle
          className="lovableObjectiveRingValue"
          cx="26"
          cy="26"
          r="21"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="lovableObjectiveRingLabel">{clampPercent(progress)}%</div>
    </div>
  );
}

function escapeSelectorValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function readObjectivesView(ui) {
  const safeUi = ui && typeof ui === "object" ? ui : {};
  const stored = safeUi.objectivesControlRoomV1 && typeof safeUi.objectivesControlRoomV1 === "object"
    ? safeUi.objectivesControlRoomV1
    : {};
  return {
    lens: normalizeObjectivesLens(stored.lens),
    horizon: normalizeObjectivesHorizon(stored.horizon),
  };
}

function formatShortDate(dateKey) {
  if (!dateKey) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function formatShare(value) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return `${Math.round(safeValue * 100)}%`;
}

function toneToVariant(tone) {
  if (tone === "success") return "success";
  if (tone === "warning") return "warning";
  return "info";
}

function horizonSummary(horizon) {
  if (horizon === OBJECTIVES_HORIZONS.DAY) return OBJECTIVES_SCREEN_COPY.horizonSummaryDay;
  if (horizon === OBJECTIVES_HORIZONS.MONTH) return OBJECTIVES_SCREEN_COPY.horizonSummaryMonth;
  return OBJECTIVES_SCREEN_COPY.horizonSummaryWeek;
}

function buildObjectivesAnalysisMessage({ horizon, lens }) {
  const horizonLabel =
    horizon === OBJECTIVES_HORIZONS.DAY
      ? "jour"
      : horizon === OBJECTIVES_HORIZONS.MONTH
        ? "mois"
        : "semaine";
  const lensLabel =
    lens === OBJECTIVES_LENSES.CATEGORIES
      ? "catégories"
      : lens === OBJECTIVES_LENSES.KEY_ACTIONS
        ? "actions clés"
        : "objectifs";
  return `Recentre mon ${horizonLabel}. Donne un arbitrage concret entre ce qu'il faut protéger, desserrer et recadrer. Angle actif: ${lensLabel}. Si une action est nécessaire, privilégie Planning plutôt qu'un commentaire abstrait.`;
}

function applyObjectivesAction({
  action,
  fallbackDateKey,
  fallbackCategoryId,
  onOpenPlanning,
  onOpenPilotage,
}) {
  if (!action?.intent) return;
  if (action.intent === "open_planning") {
    onOpenPlanning?.({
      categoryId: action.categoryId || fallbackCategoryId || null,
      dateKey: action.dateKey || fallbackDateKey || null,
    });
    return;
  }
  if (action.intent === "open_pilotage") {
    onOpenPilotage?.({
      categoryId: action.categoryId || fallbackCategoryId || null,
    });
  }
}

export default function Objectives({
  data,
  setData,
  persistenceScope = "local_fallback",
  onOpenPlanning,
  onOpenPilotage,
  onOpenCategory,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const { session } = useAuth();
  const todayKey = useMemo(() => todayLocalKey(), []);
  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const activeCategoryId = getStoredLibraryActiveCategoryId(safeData) || null;
  const storedView = useMemo(() => readObjectivesView(safeData?.ui), [safeData?.ui]);
  const [activeLens, setActiveLens] = useState(storedView.lens);
  const [activeHorizon, setActiveHorizon] = useState(storedView.horizon);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState("");
  const focusTarget = normalizeLibraryFocusTarget(safeData?.ui?.libraryFocusTarget);
  const focusSignatureRef = useRef("");

  useEffect(() => {
    if (!focusTarget) focusSignatureRef.current = "";
  }, [focusTarget]);

  useEffect(() => {
    setActiveLens(storedView.lens);
  }, [storedView.lens]);

  useEffect(() => {
    setActiveHorizon(storedView.horizon);
  }, [storedView.horizon]);

  const persistObjectivesView = useCallback(
    ({ lens = activeLens, horizon = activeHorizon } = {}) => {
      if (typeof setData !== "function") return;
      setData((previous) => {
        const safePrevious = previous && typeof previous === "object" ? previous : {};
        const previousUi = safePrevious.ui && typeof safePrevious.ui === "object" ? safePrevious.ui : {};
        const previousView = readObjectivesView(previousUi);
        if (previousView.lens === lens && previousView.horizon === horizon) return previous;
        return {
          ...safePrevious,
          ui: {
            ...previousUi,
            objectivesControlRoomV1: {
              version: 1,
              lens,
              horizon,
            },
          },
        };
      });
    },
    [activeHorizon, activeLens, setData]
  );

  const updateLens = useCallback(
    (nextLens) => {
      const normalized = normalizeObjectivesLens(nextLens);
      setActiveLens(normalized);
      persistObjectivesView({ lens: normalized, horizon: activeHorizon });
    },
    [activeHorizon, persistObjectivesView]
  );

  const updateHorizon = useCallback(
    (nextHorizon) => {
      const normalized = normalizeObjectivesHorizon(nextHorizon);
      setActiveHorizon(normalized);
      persistObjectivesView({ lens: activeLens, horizon: normalized });
    },
    [activeLens, persistObjectivesView]
  );

  const controlRoom = useMemo(
    () =>
      buildObjectivesControlRoom({
        data: safeData,
        activeCategoryId,
        horizon: activeHorizon,
        anchorDateKey: todayKey,
      }),
    [activeCategoryId, activeHorizon, safeData, todayKey]
  );

  const categoryOptions = useMemo(() => {
    const orderById = new Map(controlRoom.categoryCards.map((card, index) => [card.id, index]));
    return [...categories]
      .sort((left, right) => {
        const leftIndex = orderById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = orderById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        return String(left?.name || "").localeCompare(String(right?.name || ""), "fr");
      })
      .map((category) => ({ id: category.id, label: category.name }));
  }, [categories, controlRoom.categoryCards]);

  const analysisContextKey = useMemo(
    () =>
      buildObjectivesManualAiContextKey({
        userId: session?.user?.id || "",
        horizon: activeHorizon,
        lens: activeLens,
        activeCategoryId,
      }),
    [activeCategoryId, activeHorizon, activeLens, session?.user?.id]
  );

  const objectivesAnalysis = useManualAiAnalysis({
    data: safeData,
    setData,
    contextKey: analysisContextKey,
    surface: "objectives",
  });
  const objectivesAnalysisState = useMemo(
    () =>
      resolveManualAiDisplayState({
        loading: objectivesAnalysis.loading,
        visibleAnalysis: objectivesAnalysis.visibleAnalysis,
        wasRefreshed: objectivesAnalysis.wasRefreshed,
      }),
    [objectivesAnalysis.loading, objectivesAnalysis.visibleAnalysis, objectivesAnalysis.wasRefreshed]
  );

  const highlightNode = useCallback((nodeId) => {
    if (!nodeId || typeof document === "undefined" || typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const selector = `[data-objectives-node="${escapeSelectorValue(nodeId)}"]`;
      const node = document.querySelector(selector);
      if (!node || typeof node.scrollIntoView !== "function") return;
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.classList.add("lovableHighlight");
      window.setTimeout(() => node.classList.remove("lovableHighlight"), 1400);
    });
  }, []);

  const jumpToObjective = useCallback(
    (objectiveId) => {
      if (!objectiveId) return;
      updateLens(OBJECTIVES_LENSES.OBJECTIVES);
      setExpandedObjectiveId(objectiveId);
      highlightNode(`objective:${objectiveId}`);
    },
    [highlightNode, updateLens]
  );

  useEffect(() => {
    if (!focusTarget) return;
    const signature = JSON.stringify(focusTarget);
    if (!signature || signature === focusSignatureRef.current) return;
    focusSignatureRef.current = signature;

    const targetActionId = focusTarget?.actionIds?.[0] || "";
    const matchedAction = targetActionId
      ? controlRoom.keyActionCards.find((entry) => entry.actionId === targetActionId) || null
      : null;
    const targetObjectiveId = focusTarget?.outcomeId || matchedAction?.outcomeId || "";

    if (targetObjectiveId) {
      updateLens(OBJECTIVES_LENSES.OBJECTIVES);
      setExpandedObjectiveId(targetObjectiveId);
      highlightNode(`objective:${targetObjectiveId}`);
    } else if (matchedAction?.actionId) {
      updateLens(OBJECTIVES_LENSES.KEY_ACTIONS);
      highlightNode(`action:${matchedAction.actionId}`);
    }

    if (typeof setData === "function") {
      setData((previous) => {
        const safePrevious = previous && typeof previous === "object" ? previous : {};
        const previousUi = safePrevious.ui && typeof safePrevious.ui === "object" ? safePrevious.ui : {};
        if (!previousUi.libraryFocusTarget) return previous;
        return {
          ...safePrevious,
          ui: {
            ...previousUi,
            libraryFocusTarget: null,
          },
        };
      });
    }
  }, [controlRoom.keyActionCards, focusTarget, highlightNode, setData, updateLens]);

  const handleAnalyze = useCallback(async () => {
    await objectivesAnalysis.runAnalysis({
      execute: () =>
        requestAiLocalAnalysis({
          accessToken: session?.access_token || "",
          payload: {
            selectedDateKey: controlRoom.window.anchorDateKey,
            activeCategoryId,
            surface: "objectives",
            message: buildObjectivesAnalysisMessage({
              horizon: activeHorizon,
              lens: activeLens,
            }),
          },
        }),
      serializeSuccess: (result) =>
        createPersistedLocalAnalysisEntry({
          contextKey: analysisContextKey,
          surface: "objectives",
          storageScope: persistenceScope,
          reply: result?.reply,
          summary: controlRoom.aiFallbackNarrative,
        }),
    });
  }, [
    activeCategoryId,
    activeHorizon,
    activeLens,
    analysisContextKey,
    controlRoom.aiFallbackNarrative,
    controlRoom.window.anchorDateKey,
    objectivesAnalysis,
    persistenceScope,
    session?.access_token,
  ]);

  const handleCategoryFilterChange = useCallback(
    (nextValue) => {
      const nextCategoryId = nextValue === "all" ? null : nextValue;
      if (typeof setData !== "function") return;
      setData((previous) => {
        const safePrevious = previous && typeof previous === "object" ? previous : {};
        const previousUi = safePrevious.ui && typeof safePrevious.ui === "object" ? safePrevious.ui : {};
        const nextUi = withLibraryActiveCategoryId(previousUi, nextCategoryId);
        if (
          previousUi.librarySelectedCategoryId === nextUi.librarySelectedCategoryId &&
          JSON.stringify(previousUi.selectedCategoryByView || {}) === JSON.stringify(nextUi.selectedCategoryByView || {})
        ) {
          return previous;
        }
        return {
          ...safePrevious,
          ui: nextUi,
        };
      });
    },
    [setData]
  );

  const activeNarrative =
    objectivesAnalysis.visibleAnalysis?.headline || objectivesAnalysis.visibleAnalysis?.summary || controlRoom.aiFallbackNarrative;
  const activeReason = objectivesAnalysis.visibleAnalysis?.reason || horizonSummary(activeHorizon);
  const viewIsEmpty =
    !controlRoom.objectiveCards.length &&
    !controlRoom.categoryCards.length &&
    !controlRoom.keyActionCards.length;

  return (
    <AppScreen
      pageId="objectives"
      headerTitle={OBJECTIVES_SCREEN_COPY.title}
      headerSubtitle={OBJECTIVES_SCREEN_COPY.subtitle}
    >
      <div className="lovablePage objectivesControlRoom">
        <div className="objectivesControlToolbar">
          <div className="objectivesControlChipRow" role="tablist" aria-label={OBJECTIVES_SCREEN_COPY.title}>
            <AppChip active={activeLens === OBJECTIVES_LENSES.OBJECTIVES} onClick={() => updateLens(OBJECTIVES_LENSES.OBJECTIVES)}>
              {OBJECTIVES_SCREEN_COPY.lensObjectives}
            </AppChip>
            <AppChip active={activeLens === OBJECTIVES_LENSES.CATEGORIES} onClick={() => updateLens(OBJECTIVES_LENSES.CATEGORIES)}>
              {OBJECTIVES_SCREEN_COPY.lensCategories}
            </AppChip>
            <AppChip active={activeLens === OBJECTIVES_LENSES.KEY_ACTIONS} onClick={() => updateLens(OBJECTIVES_LENSES.KEY_ACTIONS)}>
              {OBJECTIVES_SCREEN_COPY.lensKeyActions}
            </AppChip>
          </div>

          <div className="objectivesControlChipRow objectivesControlChipRow--secondary" role="tablist" aria-label="Horizon">
            <AppChip active={activeHorizon === OBJECTIVES_HORIZONS.DAY} onClick={() => updateHorizon(OBJECTIVES_HORIZONS.DAY)}>
              {OBJECTIVES_SCREEN_COPY.horizonDay}
            </AppChip>
            <AppChip active={activeHorizon === OBJECTIVES_HORIZONS.WEEK} onClick={() => updateHorizon(OBJECTIVES_HORIZONS.WEEK)}>
              {OBJECTIVES_SCREEN_COPY.horizonWeek}
            </AppChip>
            <AppChip active={activeHorizon === OBJECTIVES_HORIZONS.MONTH} onClick={() => updateHorizon(OBJECTIVES_HORIZONS.MONTH)}>
              {OBJECTIVES_SCREEN_COPY.horizonMonth}
            </AppChip>
          </div>

          {categories.length ? (
            <CompactCategoryFilter
              label={OBJECTIVES_SCREEN_COPY.categoryFilterLabel}
              options={categoryOptions}
              value={activeCategoryId || "all"}
              onChange={handleCategoryFilterChange}
              allLabel={OBJECTIVES_SCREEN_COPY.allCategories}
            />
          ) : null}
        </div>

        <div className="objectivesControlLead">
          <div className="objectivesOverviewGrid">
            {controlRoom.overviewCards.map((card) => (
              <div key={card.key} className="lovableCard objectivesOverviewCard">
                <div className="objectivesOverviewLabel">{card.label}</div>
                <div className="objectivesOverviewValue">{card.value}</div>
                <div className="objectivesOverviewMeta">{card.meta}</div>
              </div>
            ))}
          </div>

          <div className="lovableCard objectivesAiCard">
            <div className="objectivesAiEyebrow">{OBJECTIVES_SCREEN_COPY.recenterTitle}</div>
            <div className="objectivesAiHeadline">{activeNarrative}</div>
            <p className="objectivesAiReason">{activeReason}</p>
            <ManualAiStatus
              statusKind={objectivesAnalysisState.kind}
              statusLabel={objectivesAnalysisState.label}
              detailLabel={
                objectivesAnalysis.visibleAnalysis
                  ? persistenceScope === "cloud"
                    ? "Lecture synchronisée."
                    : "Lecture enregistrée sur cet appareil."
                  : "Lecture locale prête. La version IA affine l'arbitrage sur demande."
              }
              stageLabel={objectivesAnalysis.loadingStageLabel}
            />
            <AppActionRow align="start" className="objectivesAiActions">
              <PrimaryButton type="button" size="sm" onClick={handleAnalyze} disabled={objectivesAnalysis.loading}>
                {objectivesAnalysis.loading
                  ? objectivesAnalysis.loadingStageLabel || OBJECTIVES_SCREEN_COPY.recenterTitle
                  : objectivesAnalysis.visibleAnalysis
                    ? OBJECTIVES_SCREEN_COPY.recenterRetry
                    : OBJECTIVES_SCREEN_COPY.recenterCta}
              </PrimaryButton>
              <GhostButton
                type="button"
                size="sm"
                onClick={() =>
                  onOpenPlanning?.({
                    categoryId: activeCategoryId,
                    dateKey: controlRoom.window.planningDateKey,
                  })
                }
              >
                {OBJECTIVES_SCREEN_COPY.openPlanning}
              </GhostButton>
              <GhostButton type="button" size="sm" onClick={() => onOpenPilotage?.({ categoryId: activeCategoryId })}>
                {OBJECTIVES_SCREEN_COPY.openPilotage}
              </GhostButton>
              {objectivesAnalysis.visibleAnalysis ? (
                <GhostButton type="button" size="sm" onClick={objectivesAnalysis.dismissAnalysis}>
                  {UI_COPY.backToLocalDiagnostic}
                </GhostButton>
              ) : null}
            </AppActionRow>
            {objectivesAnalysis.error ? (
              <>
                <p className="objectivesAiError">{objectivesAnalysis.error}</p>
                <AiDebugLine diagnostics={objectivesAnalysis.errorDiagnostics} className="lovableMuted" />
              </>
            ) : null}
            {objectivesAnalysis.visibleAnalysis?.primaryAction || objectivesAnalysis.visibleAnalysis?.secondaryAction ? (
              <AppActionRow align="start" className="objectivesAiActions objectivesAiActions--secondary">
                {objectivesAnalysis.visibleAnalysis?.primaryAction ? (
                  <PrimaryButton
                    type="button"
                    size="sm"
                    onClick={() =>
                      applyObjectivesAction({
                        action: objectivesAnalysis.visibleAnalysis.primaryAction,
                        fallbackDateKey: controlRoom.window.planningDateKey,
                        fallbackCategoryId: activeCategoryId,
                        onOpenPlanning,
                        onOpenPilotage,
                      })
                    }
                  >
                    {objectivesAnalysis.visibleAnalysis.primaryAction.label}
                  </PrimaryButton>
                ) : null}
                {objectivesAnalysis.visibleAnalysis?.secondaryAction ? (
                  <GhostButton
                    type="button"
                    size="sm"
                    onClick={() =>
                      applyObjectivesAction({
                        action: objectivesAnalysis.visibleAnalysis.secondaryAction,
                        fallbackDateKey: controlRoom.window.planningDateKey,
                        fallbackCategoryId: activeCategoryId,
                        onOpenPlanning,
                        onOpenPilotage,
                      })
                    }
                  >
                    {objectivesAnalysis.visibleAnalysis.secondaryAction.label}
                  </GhostButton>
                ) : null}
              </AppActionRow>
            ) : null}
          </div>
        </div>

        <div className="objectivesSignalsGrid">
          {[
            controlRoom.focusSignals.protect,
            controlRoom.focusSignals.loosen,
            controlRoom.focusSignals.reframe,
          ].map((signal) => (
            <div key={signal.label} className="lovableCard objectivesSignalCard">
              <div className="objectivesSignalLabel">{signal.label}</div>
              <div className="objectivesSignalTitle">{signal.title}</div>
              <AppActionRow align="start" className="objectivesSignalActions">
                <GhostButton
                  type="button"
                  size="sm"
                  onClick={() =>
                    onOpenPlanning?.({
                      categoryId: signal.categoryId || activeCategoryId,
                      dateKey: controlRoom.window.planningDateKey,
                    })
                  }
                >
                  {OBJECTIVES_SCREEN_COPY.openPlanning}
                </GhostButton>
                <GhostButton
                  type="button"
                  size="sm"
                  onClick={() => onOpenPilotage?.({ categoryId: signal.categoryId || activeCategoryId })}
                >
                  {OBJECTIVES_SCREEN_COPY.openPilotage}
                </GhostButton>
              </AppActionRow>
            </div>
          ))}
        </div>

        {viewIsEmpty ? (
          <div className="lovableCard lovableEmptyCard">
            <div className="lovableEmptyTitle">{OBJECTIVES_SCREEN_COPY.emptyTitle}</div>
            <p className="lovableEmptyCopy">{OBJECTIVES_SCREEN_COPY.emptyCopy}</p>
          </div>
        ) : (
          <div
            key={`${activeLens}:${activeHorizon}:${activeCategoryId || "all"}`}
            className="objectivesLensPanel"
            data-active-lens={activeLens}
          >
            {activeLens === OBJECTIVES_LENSES.OBJECTIVES ? (
              controlRoom.objectiveCards.length ? (
                <div className="objectivesLensGrid objectivesLensGrid--objectives">
                  {controlRoom.objectiveCards.map((card) => {
                    const expanded = expandedObjectiveId === card.id;
                    const color = resolveCategoryColor(card.category, "#8b78ff");
                    return (
                      <div
                        key={card.id}
                        className="lovableCard lovableObjectiveCard objectivesLensCard"
                        data-objectives-node={`objective:${card.id}`}
                      >
                        <button
                          type="button"
                          className="lovableObjectiveHeader"
                          onClick={() => setExpandedObjectiveId((current) => (current === card.id ? "" : card.id))}
                        >
                          <ObjectiveRing progress={card.progress} color={color} />
                          <div className="objectivesLensCardHeaderText">
                            {card.category?.name ? (
                              <div className="lovableObjectiveCategory">{card.category.name}</div>
                            ) : null}
                            <div className="lovableObjectiveTitle">{card.title || OBJECTIVES_SCREEN_COPY.untitledObjective}</div>
                            <div className="lovableObjectiveSubtitle">{card.subtitle}</div>
                          </div>
                          <div className="objectivesLensCardHeaderMeta">
                            <StatusBadge tone={toneToVariant(card.status.tone)}>{card.status.label}</StatusBadge>
                            <div className="lovableObjectiveChevron">{expanded ? "⌃" : "⌄"}</div>
                          </div>
                        </button>
                        <div className="lovableObjectiveBody">
                          <p className="objectivesLensCardReason">{card.status.description}</p>
                          <div className="objectivesMetricGrid">
                            <div className="objectivesMetricCell">
                              <span>Progression</span>
                              <strong>{clampPercent(card.progress)}%</strong>
                            </div>
                            <div className="objectivesMetricCell">
                              <span>Blocs visibles</span>
                              <strong>{card.metrics.expectedCount}</strong>
                            </div>
                            <div className="objectivesMetricCell">
                              <span>Charge</span>
                              <strong>{card.metrics.totalMinutes} min</strong>
                            </div>
                          </div>
                          {expanded ? (
                            <div className="lovableObjectiveSections">
                              <div className="lovableObjectiveSection">
                                <div className="lovableObjectiveSectionTitle">{OBJECTIVES_SCREEN_COPY.objectiveSupportTitle}</div>
                                <div className="objectivesNestedList">
                                  {card.keyActions.length ? (
                                    card.keyActions.map((action) => (
                                      <div key={action.id} className="objectivesNestedItem">
                                        <div className="objectivesNestedText">
                                          <div className="objectivesNestedTitle">{action.title}</div>
                                          <div className="objectivesNestedMeta">{action.summary}</div>
                                        </div>
                                        <StatusBadge tone={toneToVariant(action.status.tone)}>{action.status.label}</StatusBadge>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="lovableMuted">{OBJECTIVES_SCREEN_COPY.noLinkedActions}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}
                          <AppActionRow align="start" className="objectivesLensActions">
                            <GhostButton
                              type="button"
                              size="sm"
                              onClick={() =>
                                onOpenPlanning?.({
                                  categoryId: card.category?.id || activeCategoryId,
                                  dateKey: card.planningDateKey || controlRoom.window.planningDateKey,
                                })
                              }
                            >
                              {OBJECTIVES_SCREEN_COPY.openPlanning}
                            </GhostButton>
                            <GhostButton
                              type="button"
                              size="sm"
                              onClick={() => onOpenPilotage?.({ categoryId: card.category?.id || activeCategoryId })}
                            >
                              {OBJECTIVES_SCREEN_COPY.openPilotage}
                            </GhostButton>
                          </AppActionRow>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="lovableCard lovableEmptyCard">
                  <div className="lovableEmptyTitle">{OBJECTIVES_SCREEN_COPY.lensObjectives}</div>
                  <p className="lovableEmptyCopy">{OBJECTIVES_SCREEN_COPY.noObjectiveSignals}</p>
                </div>
              )
            ) : null}

            {activeLens === OBJECTIVES_LENSES.CATEGORIES ? (
              controlRoom.categoryCards.length ? (
                <div className="objectivesLensGrid objectivesLensGrid--categories">
                  {controlRoom.categoryCards.map((card) => (
                    <div
                      key={card.id}
                      className="lovableCard objectivesCategoryCard"
                      data-objectives-node={`category:${card.id}`}
                    >
                      <div className="objectivesCategoryHeader">
                        <div>
                          <div className="lovableObjectiveCategory">{card.name}</div>
                          <div className="objectivesCategoryTitle">{card.status.label}</div>
                        </div>
                        <StatusBadge tone={toneToVariant(card.status.tone)}>{formatShare(card.share)}</StatusBadge>
                      </div>
                      <p className="objectivesLensCardReason">{card.status.description}</p>
                      <div className="objectivesMetricGrid">
                        <div className="objectivesMetricCell">
                          <span>Objectifs</span>
                          <strong>{card.outcomeCount}</strong>
                        </div>
                        <div className="objectivesMetricCell">
                          <span>Actions</span>
                          <strong>{card.actionCount}</strong>
                        </div>
                        <div className="objectivesMetricCell">
                          <span>Charge</span>
                          <strong>{card.totalMinutes} min</strong>
                        </div>
                      </div>
                      <div className="objectivesCategoryListLabel">{OBJECTIVES_SCREEN_COPY.categoryObjectivesTitle}</div>
                      <div className="objectivesCategoryList">
                        {card.topObjectives.length ? (
                          card.topObjectives.map((title) => (
                            <div key={`${card.id}:${title}`} className="objectivesCategoryListItem">
                              {title}
                            </div>
                          ))
                        ) : (
                          <div className="lovableMuted">{OBJECTIVES_SCREEN_COPY.noObjectiveSignals}</div>
                        )}
                      </div>
                      <AppActionRow align="start" className="objectivesLensActions">
                        <GhostButton
                          type="button"
                          size="sm"
                          onClick={() =>
                            onOpenPlanning?.({
                              categoryId: card.id,
                              dateKey: card.planningDateKey || controlRoom.window.planningDateKey,
                            })
                          }
                        >
                          {OBJECTIVES_SCREEN_COPY.openPlanning}
                        </GhostButton>
                        <GhostButton type="button" size="sm" onClick={() => onOpenCategory?.(card.id)}>
                          {OBJECTIVES_SCREEN_COPY.openCategory}
                        </GhostButton>
                      </AppActionRow>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="lovableCard lovableEmptyCard">
                  <div className="lovableEmptyTitle">{OBJECTIVES_SCREEN_COPY.lensCategories}</div>
                  <p className="lovableEmptyCopy">{OBJECTIVES_SCREEN_COPY.noCategorySignals}</p>
                </div>
              )
            ) : null}

            {activeLens === OBJECTIVES_LENSES.KEY_ACTIONS ? (
              controlRoom.keyActionCards.length ? (
                <div className="objectivesLensGrid objectivesLensGrid--actions">
                  {controlRoom.keyActionCards.map((card) => (
                    <div
                      key={card.id}
                      className="lovableCard objectivesKeyActionCard"
                      data-objectives-node={`action:${card.actionId}`}
                    >
                      <div className="objectivesKeyActionHeader">
                        <div>
                          {card.category?.name ? (
                            <div className="lovableObjectiveCategory">{card.category.name}</div>
                          ) : null}
                          <div className="objectivesKeyActionTitle">{card.title || OBJECTIVES_SCREEN_COPY.untitledAction}</div>
                        </div>
                        <StatusBadge tone={toneToVariant(card.status.tone)}>{card.status.label}</StatusBadge>
                      </div>
                      <p className="objectivesLensCardReason">{card.status.description}</p>
                      <div className="objectivesMetricGrid">
                        <div className="objectivesMetricCell">
                          <span>Objectif lié</span>
                          <strong>{card.linkedOutcome?.title || OBJECTIVES_SCREEN_COPY.keyActionObjectiveFallback}</strong>
                        </div>
                        <div className="objectivesMetricCell">
                          <span>Charge</span>
                          <strong>{card.totalMinutes} min</strong>
                        </div>
                        <div className="objectivesMetricCell">
                          <span>Prochain bloc</span>
                          <strong>{card.nextOccurrence?.date ? formatShortDate(card.nextOccurrence.date) : "Aucun"}</strong>
                        </div>
                      </div>
                      <div className="objectivesKeyActionMeta">{card.summary}</div>
                      <AppActionRow align="start" className="objectivesLensActions">
                        {card.outcomeId ? (
                          <GhostButton type="button" size="sm" onClick={() => jumpToObjective(card.outcomeId)}>
                            {OBJECTIVES_SCREEN_COPY.openObjective}
                          </GhostButton>
                        ) : null}
                        <GhostButton
                          type="button"
                          size="sm"
                          onClick={() =>
                            onOpenPlanning?.({
                              categoryId: card.category?.id || activeCategoryId,
                              dateKey: card.planningDateKey || controlRoom.window.planningDateKey,
                            })
                          }
                        >
                          {OBJECTIVES_SCREEN_COPY.openPlanning}
                        </GhostButton>
                      </AppActionRow>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="lovableCard lovableEmptyCard">
                  <div className="lovableEmptyTitle">{OBJECTIVES_SCREEN_COPY.lensKeyActions}</div>
                  <p className="lovableEmptyCopy">{OBJECTIVES_SCREEN_COPY.noKeyActionSignals}</p>
                </div>
              )
            ) : null}
          </div>
        )}
      </div>
    </AppScreen>
  );
}
