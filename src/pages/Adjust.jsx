import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Gauge,
  ShieldCheck,
  Sparkles,
  Target,
  ChevronDown,
} from "lucide-react";
import { AppScreen } from "../shared/ui/app";
import SystemAnalysisEntryButton from "../components/system-analysis/SystemAnalysisEntryButton";
import SystemAnalysisCommandSheet from "../components/system-analysis/SystemAnalysisCommandSheet";
import { useAuth } from "../auth/useAuth";
import {
  CommandCard,
  CommandCTA,
  CommandSectionHeader,
} from "../shared/ui/command";
import { ADJUST_ACTION_IDS, buildAdjustDiagnostic } from "../features/adjust/adjustDiagnostic";
import { buildAdjustPresentationModel } from "../features/adjust/adjustPresentationModel";
import { resolveAdjustRecoveryRequest } from "../features/recovery/recoveryEntryPoints";
import {
  applySystemAnalysisSelectedCorrections,
  buildSystemAnalysisApplicationPreview,
} from "../features/system-analysis/systemAnalysisApplyModel";
import { validateSystemAnalysisResult } from "../features/system-analysis/systemAnalysisContract";
import { buildSystemAnalysisEligibility } from "../features/system-analysis/systemAnalysisEligibility";
import { buildSystemAnalysisEntryModel } from "../features/system-analysis/systemAnalysisEntryModel";
import { buildSystemAnalysisCorrectionReview } from "../features/system-analysis/systemAnalysisCorrectionReviewModel";
import {
  buildSystemAnalysisHistoryDisplayModel,
  createSystemAnalysisRecord,
  ensureSystemAnalysisHistoryState,
  findReusableSystemAnalysisRecord,
  markSystemAnalysisRecordApplied,
  upsertSystemAnalysisRecord,
} from "../features/system-analysis/systemAnalysisHistory";
import { buildSystemAnalysisSnapshot } from "../features/system-analysis/systemAnalysisSnapshot";
import { requestAiSystemAnalysis } from "../infra/aiSystemAnalysisClient";
import { fromLocalDateKey, normalizeLocalDateKey, todayLocalKey } from "../utils/datetime";
import "../features/adjust/adjust.css";

const ADJUST_SCREEN_COPY = Object.freeze({
  title: "Ajuster",
  subtitle: "Corrige ton système.",
});

const ACTION_ICONS = Object.freeze({
  [ADJUST_ACTION_IDS.SIMPLIFY_DAY]: ShieldCheck,
  [ADJUST_ACTION_IDS.REORGANIZE_SCHEDULE]: Clock3,
  [ADJUST_ACTION_IDS.REDUCE_LOAD]: Gauge,
  [ADJUST_ACTION_IDS.ASK_COACH]: BrainCircuit,
});

function formatShortDay(dateKey) {
  const date = fromLocalDateKey(dateKey);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date).replace(".", "");
}

function buildSystemAnalysisReferenceNow(dateKey) {
  return new Date(`${dateKey}T12:00:00`);
}

function resolveBrowserLocale() {
  if (typeof navigator !== "undefined" && typeof navigator.language === "string" && navigator.language.trim()) {
    return navigator.language;
  }
  return "fr-FR";
}

function resolveBrowserTimezone() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timezone === "string" && timezone.trim() ? timezone : "Europe/Paris";
  } catch {
    return "Europe/Paris";
  }
}

function createInitialSystemAnalysisState() {
  return {
    status: "idle",
    result: null,
    analysisId: null,
    errorCode: "",
    message: "",
    missingRequirements: [],
    requestId: null,
  };
}

function createInitialSystemAnalysisApplicationState() {
  return {
    status: "idle",
    result: null,
    errorCode: "",
    message: "",
  };
}

function resolveSystemAnalysisStatus(result) {
  const code = String(result?.errorCode || "").trim().toUpperCase();
  if (code === "PREMIUM_REQUIRED") return "premium_required";
  if (code === "SYSTEM_ANALYSIS_INELIGIBLE") return "ineligible";
  if (code === "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT") return "timeout";
  return "error";
}

function resolveSystemAnalysisAvailabilityState({ requestState, fallbackState }) {
  if (requestState?.status === "loading") return "running";
  if (requestState?.errorCode === "QUOTA_EXCEEDED") return "quota_exhausted";
  if (requestState?.errorCode === "SYSTEM_ANALYSIS_QUOTA_EXCEEDED") return "quota_exhausted";
  return fallbackState;
}

function TrendSnapshot({ trendSnapshot }) {
  const series = Array.isArray(trendSnapshot?.series) ? trendSnapshot.series : [];
  const visible = series.slice(-7);
  if (!visible.length) return null;

  return (
    <CommandCard tone="neutral" className="adjustTrendCard" density="compact">
      <CommandSectionHeader
        label="APERÇU 7 JOURS"
        title="Rythme récent"
        subtitle="Réalisé vs prévu, sans analyse artificielle."
        tone="neutral"
      />
      <div className="adjustTrendBars" aria-label="Aperçu des 7 derniers jours">
        {visible.map((entry) => {
          const expected = Math.max(0, Number(entry.expected) || 0);
          const done = Math.max(0, Number(entry.done) || 0);
          const score = Number.isFinite(entry.score) ? Math.max(0, Math.min(100, entry.score)) : 0;
          const plannedHeight = expected > 0 ? 44 : 10;
          const doneHeight = expected > 0 ? Math.max(8, Math.round((score / 100) * plannedHeight)) : 0;
          return (
            <div key={entry.dateKey} className="adjustTrendDay">
              <div className="adjustTrendBarSlot">
                <span
                  className="adjustTrendBar adjustTrendBar--planned"
                  style={{ height: `${plannedHeight}px` }}
                  aria-hidden="true"
                />
                {done > 0 ? (
                  <span
                    className="adjustTrendBar adjustTrendBar--done"
                    style={{ height: `${doneHeight}px` }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <span>{formatShortDay(entry.dateKey)}</span>
            </div>
          );
        })}
      </div>
      <div className="adjustTrendLegend" aria-hidden="true">
        <span><i className="is-done" /> Réalisé</span>
        <span><i className="is-planned" /> Prévu</span>
      </div>
    </CommandCard>
  );
}

function CategorySignals({ signals }) {
  const visibleSignals = Array.isArray(signals) ? signals.filter((signal) => signal.expected > 0).slice(0, 4) : [];
  if (!visibleSignals.length) return null;

  return (
    <CommandCard tone="neutral" className="adjustCategoryCard" density="compact">
      <CommandSectionHeader
        label="CATÉGORIES"
        title="Directions récentes"
        subtitle="Seulement les catégories avec une activité planifiée."
        tone="neutral"
      />
      <div className="adjustCategoryList">
        {visibleSignals.map((signal) => {
          const score = Number.isFinite(signal.score) ? Math.max(0, Math.min(100, signal.score)) : 0;
          const tone = signal.expected >= 2 && signal.done === 0 ? "attention" : "execution";
          return (
            <div key={signal.id} className="adjustCategoryRow" data-command-tone={tone}>
              <div>
                <span>{signal.label}</span>
                <small>{signal.done}/{signal.expected} blocs</small>
              </div>
              <div className="adjustCategoryProgress" aria-label={`${signal.label}: ${score}%`}>
                <span style={{ width: `${score}%` }} />
              </div>
              <strong>{Number.isFinite(signal.score) ? `${signal.score}%` : "--"}</strong>
            </div>
          );
        })}
      </div>
    </CommandCard>
  );
}

function ActionButton({ action, onAction }) {
  const Icon = ACTION_ICONS[action.id] || Gauge;
  return (
    <button
      type="button"
      className="adjustQuickAction"
      data-command-tone={action.tone || "neutral"}
      onClick={() => onAction?.(action.id)}
    >
      <span className="adjustQuickActionIcon" aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="adjustQuickActionText">
        <strong>{action.label}</strong>
        <small>{action.description}</small>
      </span>
    </button>
  );
}

function AdjustDetailSection({ section, open, onToggle, children }) {
  const panelId = `adjust-detail-panel-${section.id}`;
  return (
    <section className="adjustDetailSection">
      <button
        type="button"
        className="adjustDetailToggle"
        aria-expanded={open ? "true" : "false"}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span>
          <strong>{section.title}</strong>
          <small>{section.summary}</small>
        </span>
        <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} className="adjustDetailPanel">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function AdjustSignalsDetail({ section }) {
  const signals = Array.isArray(section.items) ? section.items : [];
  if (!signals.length) {
    return (
      <CommandCard tone="neutral" className="adjustCalmCard" density="compact">
        <CheckCircle2 size={20} strokeWidth={2} aria-hidden="true" />
        <div>
          <strong>Système lisible</strong>
          <p>Rien ne justifie une alerte. Tu peux garder le prochain bloc comme point d’appui.</p>
        </div>
      </CommandCard>
    );
  }
  return (
    <div className="adjustFrictionGrid">
      {signals.map((signal) => (
        <CommandCard key={signal.id} tone="attention" className="adjustFrictionCard" density="compact">
          <div className="adjustFrictionIcon" aria-hidden="true">
            <AlertTriangle size={17} strokeWidth={2} />
          </div>
          <div>
            <strong>{signal.title}</strong>
            <p>{signal.description}</p>
          </div>
        </CommandCard>
      ))}
    </div>
  );
}

function AdjustTrendsDetail({ section }) {
  const hasTrend = Array.isArray(section.trendSnapshot?.series) && section.trendSnapshot.series.length > 0;
  const hasCategories = Array.isArray(section.categorySignals) && section.categorySignals.some((signal) => signal.expected > 0);
  if (!hasTrend && !hasCategories) {
    return (
      <p className="adjustDetailEmpty">Pas encore assez d’historique pour lire une tendance fiable.</p>
    );
  }
  return (
    <div className="adjustDetailStack">
      <TrendSnapshot trendSnapshot={section.trendSnapshot} />
      <CategorySignals signals={section.categorySignals} />
    </div>
  );
}

function AdjustActionsDetail({ section, onAction }) {
  const actions = Array.isArray(section.actions) ? section.actions : [];
  if (!actions.length) {
    return (
      <p className="adjustDetailEmpty">Le Coach IA est déjà l’action recommandée maintenant.</p>
    );
  }
  return (
    <div className="adjustQuickActions">
      {actions.map((action) => (
        <ActionButton key={action.id} action={action} onAction={onAction} />
      ))}
    </div>
  );
}

function AdjustDiagnosticDetail({ section }) {
  const metrics = Array.isArray(section.metrics) ? section.metrics : [];
  const expectedImpact = Array.isArray(section.expectedImpact) ? section.expectedImpact : [];
  return (
    <div className="adjustDiagnosticDetail">
      <div className="adjustSummaryMetrics adjustSummaryMetrics--detail">
        {metrics.map((metric) => (
          <div key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      {expectedImpact.length ? (
        <div className="adjustImpactList">
          <span>Impact attendu</span>
          {expectedImpact.map((item) => (
            <div key={item}><Sparkles size={13} strokeWidth={2} aria-hidden="true" />{item}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Adjust({
  data,
  setData,
  onAdjustAction,
  onOpenRecoverySheet,
  onSystemAnalysisEntry,
  systemAnalysisAvailabilityState = "ready",
}) {
  const { session } = useAuth();
  const [systemAnalysisRequestState, setSystemAnalysisRequestState] = useState(createInitialSystemAnalysisState);
  const [systemAnalysisSheetOpen, setSystemAnalysisSheetOpen] = useState(false);
  const [openDetailSections, setOpenDetailSections] = useState({});
  const [selectedSystemAnalysisCorrectionIds, setSelectedSystemAnalysisCorrectionIds] = useState([]);
  const [systemAnalysisConfirmationOpen, setSystemAnalysisConfirmationOpen] = useState(false);
  const [preparedSystemAnalysisApplicationPreview, setPreparedSystemAnalysisApplicationPreview] = useState(null);
  const [systemAnalysisApplicationState, setSystemAnalysisApplicationState] = useState(createInitialSystemAnalysisApplicationState);
  const systemAnalysisAbortRef = useRef(null);
  const safeData = useMemo(() => (data && typeof data === "object" ? data : {}), [data]);
  const activeDateKey =
    normalizeLocalDateKey(safeData?.ui?.selectedDateKey) ||
    normalizeLocalDateKey(safeData?.ui?.selectedDate) ||
    todayLocalKey();
  const diagnostic = useMemo(
    () => buildAdjustDiagnostic(safeData, activeDateKey),
    [activeDateKey, safeData]
  );
  const { recommendation } = diagnostic;
  const recoveryRequest = useMemo(
    () => resolveAdjustRecoveryRequest({
      diagnostic,
      state: safeData,
      selectedDateKey: activeDateKey,
      now: new Date(),
    }),
    [activeDateKey, diagnostic, safeData]
  );
  const adjustPresentation = useMemo(
    () => buildAdjustPresentationModel({
      diagnostic,
      recoveryRequest,
      systemAnalysisEntry: {
        placement: "header",
        priority: "secondary",
        state: systemAnalysisAvailabilityState,
      },
    }),
    [diagnostic, recoveryRequest, systemAnalysisAvailabilityState]
  );
  const toggleDetailSection = useCallback((sectionId) => {
    setOpenDetailSections((current) => ({
      ...current,
      [sectionId]: !current?.[sectionId],
    }));
  }, []);
  const handlePrimaryRecommendationAction = useCallback(() => {
    if (recoveryRequest && typeof onOpenRecoverySheet === "function") {
      const opened = onOpenRecoverySheet(recoveryRequest);
      if (opened) return;
    }
    onAdjustAction?.(recommendation?.actionId || ADJUST_ACTION_IDS.ASK_COACH);
  }, [onAdjustAction, onOpenRecoverySheet, recommendation?.actionId, recoveryRequest]);
  const systemAnalysisSnapshot = useMemo(
    () => buildSystemAnalysisSnapshot({
      state: safeData,
      period: { endDateKey: activeDateKey, days: 14 },
      referenceDateKey: activeDateKey,
      now: buildSystemAnalysisReferenceNow(activeDateKey),
    }),
    [activeDateKey, safeData]
  );
  const systemAnalysisEligibility = useMemo(
    () => buildSystemAnalysisEligibility({
      state: safeData,
      snapshot: systemAnalysisSnapshot,
      now: buildSystemAnalysisReferenceNow(activeDateKey),
    }),
    [activeDateKey, safeData, systemAnalysisSnapshot]
  );
  const systemAnalysisHistory = useMemo(
    () => ensureSystemAnalysisHistoryState(safeData.system_analysis_v1),
    [safeData.system_analysis_v1]
  );
  const systemAnalysisHistoryDisplay = useMemo(
    () => buildSystemAnalysisHistoryDisplayModel({
      history: systemAnalysisHistory,
      currentSnapshot: systemAnalysisSnapshot,
      activeDateKey,
    }),
    [activeDateKey, systemAnalysisHistory, systemAnalysisSnapshot]
  );
  const resolvedSystemAnalysisAvailabilityState = resolveSystemAnalysisAvailabilityState({
    requestState: systemAnalysisRequestState,
    fallbackState: systemAnalysisAvailabilityState,
  });
  const systemAnalysisEntryModel = useMemo(
    () => buildSystemAnalysisEntryModel({
      eligibility: systemAnalysisEligibility,
      availabilityState: resolvedSystemAnalysisAvailabilityState,
    }),
    [resolvedSystemAnalysisAvailabilityState, systemAnalysisEligibility]
  );
  const displayedSystemAnalysisRecordId = systemAnalysisRequestState.status === "success"
    ? systemAnalysisRequestState.analysisId
    : (systemAnalysisRequestState.status === "idle" && systemAnalysisHistoryDisplay.visible
      ? systemAnalysisHistoryDisplay.record?.id || null
      : null);
  const displayedSystemAnalysisRecord = useMemo(
    () => {
      if (!displayedSystemAnalysisRecordId) return null;
      return systemAnalysisHistory.analyses.find((record) => record.id === displayedSystemAnalysisRecordId) || null;
    },
    [displayedSystemAnalysisRecordId, systemAnalysisHistory]
  );
  const displayedSystemAnalysisPreviewState = useMemo(
    () => {
      if (systemAnalysisRequestState.status === "idle" && systemAnalysisHistoryDisplay.visible) {
        return {
          status: "success",
          result: systemAnalysisHistoryDisplay.result,
          errorCode: "",
          message: "",
          missingRequirements: [],
          title: systemAnalysisHistoryDisplay.title,
          staleNote: systemAnalysisHistoryDisplay.staleNote,
        };
      }
      return {
        ...systemAnalysisRequestState,
        title: "",
        staleNote: "",
      };
    },
    [systemAnalysisHistoryDisplay, systemAnalysisRequestState]
  );
  const displayedSystemAnalysisResult = displayedSystemAnalysisPreviewState.status === "success"
    ? displayedSystemAnalysisPreviewState.result
    : null;
  const displayedAppliedCorrectionIds = useMemo(
    () => (Array.isArray(displayedSystemAnalysisRecord?.appliedCorrectionIds)
      ? displayedSystemAnalysisRecord.appliedCorrectionIds
      : []),
    [displayedSystemAnalysisRecord]
  );
  const systemAnalysisCorrectionReview = useMemo(
    () => {
      if (!displayedSystemAnalysisResult) return null;
      return buildSystemAnalysisCorrectionReview({
        result: displayedSystemAnalysisResult,
        state: safeData,
        snapshot: systemAnalysisSnapshot,
        selectedIds: selectedSystemAnalysisCorrectionIds,
        appliedCorrectionIds: displayedAppliedCorrectionIds,
      });
    },
    [
      displayedAppliedCorrectionIds,
      displayedSystemAnalysisResult,
      safeData,
      selectedSystemAnalysisCorrectionIds,
      systemAnalysisSnapshot,
    ]
  );
  const liveSystemAnalysisApplicationPreview = useMemo(
    () => systemAnalysisCorrectionReview
      ? buildSystemAnalysisApplicationPreview({ review: systemAnalysisCorrectionReview })
      : null,
    [systemAnalysisCorrectionReview]
  );
  const systemAnalysisApplicationPreview = systemAnalysisConfirmationOpen
    ? preparedSystemAnalysisApplicationPreview || liveSystemAnalysisApplicationPreview
    : liveSystemAnalysisApplicationPreview;

  useEffect(() => () => {
    systemAnalysisAbortRef.current?.abort();
  }, []);

  const resetSystemAnalysisReviewState = useCallback(() => {
    setSelectedSystemAnalysisCorrectionIds([]);
    setSystemAnalysisConfirmationOpen(false);
    setPreparedSystemAnalysisApplicationPreview(null);
    setSystemAnalysisApplicationState(createInitialSystemAnalysisApplicationState());
  }, []);

  const handleSystemAnalysisEntry = useCallback(() => {
    onSystemAnalysisEntry?.({
      status: systemAnalysisEntryModel.state,
      eligibility: systemAnalysisEligibility,
      snapshot: systemAnalysisSnapshot,
    });
    setSystemAnalysisSheetOpen(true);

    if (systemAnalysisRequestState.status === "loading") return;

    if (systemAnalysisEntryModel.state === "quota_exhausted") {
      resetSystemAnalysisReviewState();
      setSystemAnalysisRequestState({
        status: "error",
        result: null,
        analysisId: null,
        errorCode: "QUOTA_EXCEEDED",
        message: "Quota mensuel utilisé.",
        missingRequirements: [],
        requestId: null,
      });
      return;
    }

    const reusableRecord = findReusableSystemAnalysisRecord(systemAnalysisHistory, {
      snapshotHash: systemAnalysisSnapshot?.snapshotHash,
      period: systemAnalysisSnapshot?.period,
    });
    if (reusableRecord) {
      resetSystemAnalysisReviewState();
      setSystemAnalysisRequestState({
        status: "success",
        result: reusableRecord.result,
        analysisId: reusableRecord.id,
        errorCode: "",
        message: "",
        missingRequirements: [],
        requestId: reusableRecord.modelMeta?.requestId || null,
      });
    }
  }, [
    onSystemAnalysisEntry,
    resetSystemAnalysisReviewState,
    systemAnalysisEligibility,
    systemAnalysisEntryModel.state,
    systemAnalysisHistory,
    systemAnalysisRequestState.status,
    systemAnalysisSnapshot,
  ]);

  const handleLaunchSystemAnalysis = useCallback(async () => {
    if (systemAnalysisRequestState.status === "loading") return;
    setSystemAnalysisSheetOpen(true);

    if (systemAnalysisEntryModel.state === "quota_exhausted") {
      resetSystemAnalysisReviewState();
      setSystemAnalysisRequestState({
        status: "error",
        result: null,
        analysisId: null,
        errorCode: "QUOTA_EXCEEDED",
        message: "Quota mensuel utilisé.",
        missingRequirements: [],
        requestId: null,
      });
      return;
    }

    if (!systemAnalysisEligibility?.eligible) {
      resetSystemAnalysisReviewState();
      setSystemAnalysisRequestState(createInitialSystemAnalysisState());
      return;
    }

    const reusableRecord = findReusableSystemAnalysisRecord(systemAnalysisHistory, {
      snapshotHash: systemAnalysisSnapshot?.snapshotHash,
      period: systemAnalysisSnapshot?.period,
    });
    if (reusableRecord) {
      resetSystemAnalysisReviewState();
      setSystemAnalysisRequestState({
        status: "success",
        result: reusableRecord.result,
        analysisId: reusableRecord.id,
        errorCode: "",
        message: "",
        missingRequirements: [],
        requestId: reusableRecord.modelMeta?.requestId || null,
      });
      return;
    }

    systemAnalysisAbortRef.current?.abort();
    const controller = new AbortController();
    systemAnalysisAbortRef.current = controller;
    resetSystemAnalysisReviewState();
    setSystemAnalysisRequestState({
      status: "loading",
      result: null,
      analysisId: null,
      errorCode: "",
      message: "",
      missingRequirements: [],
      requestId: null,
    });

    const result = await requestAiSystemAnalysis({
      snapshot: systemAnalysisSnapshot,
      state: safeData,
      locale: resolveBrowserLocale(),
      timezone: resolveBrowserTimezone(),
      referenceDateKey: activeDateKey,
      accessToken: session?.access_token || "",
      signal: controller.signal,
    });

    if (controller.signal.aborted) return;
    systemAnalysisAbortRef.current = null;

    if (result.ok) {
      const validation = validateSystemAnalysisResult(result.result, {
        snapshot: systemAnalysisSnapshot,
        state: safeData,
      });
      if (!validation.ok) {
        resetSystemAnalysisReviewState();
        setSystemAnalysisRequestState({
          status: "error",
          result: null,
          analysisId: null,
          errorCode: "INVALID_SYSTEM_ANALYSIS_RESPONSE",
          message: "L’analyse n’a pas pu être validée.",
          missingRequirements: [],
          requestId: result.requestId || null,
        });
        return;
      }
      const recordResult = createSystemAnalysisRecord({
        result: validation.normalized,
        snapshot: systemAnalysisSnapshot,
        eligibility: systemAnalysisEligibility,
        state: safeData,
        now: buildSystemAnalysisReferenceNow(activeDateKey),
      });
      if (!recordResult.ok) {
        resetSystemAnalysisReviewState();
        setSystemAnalysisRequestState({
          status: "error",
          result: null,
          analysisId: null,
          errorCode: "INVALID_SYSTEM_ANALYSIS_RESPONSE",
          message: "L’analyse n’a pas pu être enregistrée proprement.",
          missingRequirements: [],
          requestId: result.requestId || null,
        });
        return;
      }
      if (typeof setData === "function") {
        setData((current) => ({
          ...(current && typeof current === "object" ? current : safeData),
          system_analysis_v1: upsertSystemAnalysisRecord(
            current?.system_analysis_v1 || safeData.system_analysis_v1,
            recordResult.record
          ),
        }));
      }
      resetSystemAnalysisReviewState();
      setSystemAnalysisRequestState({
        status: "success",
        result: validation.normalized,
        analysisId: recordResult.record.id,
        errorCode: "",
        message: "",
        missingRequirements: [],
        requestId: result.requestId || null,
      });
      return;
    }

    resetSystemAnalysisReviewState();
    setSystemAnalysisRequestState({
      status: resolveSystemAnalysisStatus(result),
      result: null,
      analysisId: null,
      errorCode: result.errorCode || "UNKNOWN",
      message: result.errorMessage || "",
      missingRequirements: Array.isArray(result.errorDetails?.missingRequirements)
        ? result.errorDetails.missingRequirements
        : [],
      requestId: result.requestId || null,
    });
  }, [
    activeDateKey,
    resetSystemAnalysisReviewState,
    safeData,
    session?.access_token,
    setData,
    systemAnalysisEligibility,
    systemAnalysisEntryModel.state,
    systemAnalysisHistory,
    systemAnalysisRequestState.status,
    systemAnalysisSnapshot,
  ]);

  const handleToggleSystemAnalysisCorrection = useCallback((id, selected) => {
    const safeId = typeof id === "string" ? id.trim() : "";
    if (!safeId) return;
    setSystemAnalysisConfirmationOpen(false);
    setPreparedSystemAnalysisApplicationPreview(null);
    setSystemAnalysisApplicationState(createInitialSystemAnalysisApplicationState());
    setSelectedSystemAnalysisCorrectionIds((current) => {
      const existing = new Set(Array.isArray(current) ? current : []);
      if (selected) existing.add(safeId);
      else existing.delete(safeId);
      return Array.from(existing);
    });
  }, []);

  const handleConfirmSystemAnalysisCorrections = useCallback(() => {
    if (!systemAnalysisCorrectionReview?.hasValidSelection) return;
    setPreparedSystemAnalysisApplicationPreview(
      buildSystemAnalysisApplicationPreview({ review: systemAnalysisCorrectionReview })
    );
    setSystemAnalysisApplicationState(createInitialSystemAnalysisApplicationState());
    setSystemAnalysisConfirmationOpen(true);
  }, [systemAnalysisCorrectionReview]);

  const handleApplySystemAnalysisCorrections = useCallback(() => {
    if (!systemAnalysisCorrectionReview?.hasValidSelection) return;
    if (typeof setData !== "function") {
      setSystemAnalysisApplicationState({
        status: "error",
        result: null,
        errorCode: "SET_DATA_MISSING",
        message: "Les corrections n’ont pas pu être appliquées dans cette vue.",
      });
      return;
    }

    setSystemAnalysisApplicationState({
      status: "applying",
      result: null,
      errorCode: "",
      message: "",
    });
    const result = applySystemAnalysisSelectedCorrections({
      state: safeData,
      review: systemAnalysisCorrectionReview,
      now: buildSystemAnalysisReferenceNow(activeDateKey),
      invariantOptions: { todayKey: activeDateKey },
    });

    if (!result.ok) {
      setSystemAnalysisApplicationState({
        status: "error",
        result,
        errorCode: result.errorCode || "UNKNOWN",
        message: result.summary?.message || "Rien n’a été modifié.",
      });
      return;
    }

    const appliedAt = new Date().toISOString();
    const totalApplicableIds = (Array.isArray(displayedSystemAnalysisRecord?.appliedCorrectionIds)
      ? displayedSystemAnalysisRecord.appliedCorrectionIds.length
      : 0) + Math.max(0, Number(systemAnalysisCorrectionReview.selectableCount) || 0);
    setData((current) => {
      const baseNextState = result.nextState;
      const currentHistory = current?.system_analysis_v1 || baseNextState.system_analysis_v1 || safeData.system_analysis_v1;
      const nextHistory = displayedSystemAnalysisRecordId
        ? markSystemAnalysisRecordApplied(currentHistory, {
          analysisId: displayedSystemAnalysisRecordId,
          appliedItems: result.appliedItems,
          changedOccurrenceIds: result.changedOccurrenceIds,
          appliedAt,
          totalApplicableIds,
        })
        : ensureSystemAnalysisHistoryState(currentHistory);
      return {
        ...baseNextState,
        system_analysis_v1: nextHistory,
      };
    });
    setSystemAnalysisApplicationState({
      status: "success",
      result,
      errorCode: "",
      message: "",
    });
  }, [
    activeDateKey,
    displayedSystemAnalysisRecord,
    displayedSystemAnalysisRecordId,
    safeData,
    setData,
    systemAnalysisCorrectionReview,
  ]);

  const handleBackToSystemAnalysisCorrections = useCallback(() => {
    setSystemAnalysisConfirmationOpen(false);
    setSystemAnalysisApplicationState(createInitialSystemAnalysisApplicationState());
  }, []);

  const handleCloseSystemAnalysisSheet = useCallback(() => {
    if (systemAnalysisRequestState.status === "loading") {
      systemAnalysisAbortRef.current?.abort();
      systemAnalysisAbortRef.current = null;
      setSystemAnalysisRequestState(createInitialSystemAnalysisState());
    }
    setSystemAnalysisSheetOpen(false);
    if (systemAnalysisApplicationState.status === "success") {
      resetSystemAnalysisReviewState();
    }
  }, [resetSystemAnalysisReviewState, systemAnalysisApplicationState.status, systemAnalysisRequestState.status]);

  const systemAnalysisSheetState = useMemo(() => {
    if (systemAnalysisApplicationState.status === "success") return "applied_success";
    if (systemAnalysisConfirmationOpen) return "final_confirmation";
    const status = String(displayedSystemAnalysisPreviewState.status || "idle");
    const errorCode = String(displayedSystemAnalysisPreviewState.errorCode || "").toUpperCase();
    if (status === "loading") return "loading";
    if (status === "ineligible" || errorCode === "SYSTEM_ANALYSIS_INELIGIBLE") return "data_limited";
    if (status === "premium_required" || errorCode === "PREMIUM_REQUIRED") return "premium_required";
    if (
      status === "quota_exhausted" ||
      errorCode === "QUOTA_EXCEEDED" ||
      errorCode === "SYSTEM_ANALYSIS_QUOTA_EXCEEDED"
    ) {
      return "quota_exhausted";
    }
    if (status === "timeout" || errorCode === "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT") return "timeout";
    if (status === "error") return "error";
    if (displayedSystemAnalysisResult) {
      return systemAnalysisRequestState.status === "idle" && systemAnalysisHistoryDisplay.visible
        ? "latest_analysis"
        : "result_review";
    }
    if (!systemAnalysisEligibility?.eligible) return "data_limited";
    return "intro";
  }, [
    displayedSystemAnalysisPreviewState.errorCode,
    displayedSystemAnalysisPreviewState.status,
    displayedSystemAnalysisResult,
    systemAnalysisApplicationState.status,
    systemAnalysisConfirmationOpen,
    systemAnalysisEligibility?.eligible,
    systemAnalysisHistoryDisplay.visible,
    systemAnalysisRequestState.status,
  ]);

  const systemAnalysisHeaderAction = (
    <SystemAnalysisEntryButton
      className="adjustSystemAnalysisEntryButton"
      model={systemAnalysisEntryModel}
      onClick={handleSystemAnalysisEntry}
    />
  );
  const systemAnalysisIntroLimited =
    systemAnalysisEligibility?.eligible === true && systemAnalysisEligibility?.behavioralEligible !== true;

  return (
    <AppScreen
      pageId="adjust"
      headerTitle={ADJUST_SCREEN_COPY.title}
      headerSubtitle={ADJUST_SCREEN_COPY.subtitle}
      headerRight={systemAnalysisHeaderAction}
    >
      <div className="adjustCommandPage CommandMotionReveal">
        <CommandCard
          tone={adjustPresentation.primaryDiagnosis.tone}
          className="adjustPrimaryDecisionCard"
          density="compact"
          data-testid="adjust-primary-decision"
        >
          <div className="adjustPrimaryDecisionHeader">
            <span className="adjustPrimaryDecisionIcon" aria-hidden="true">
              {adjustPresentation.primaryAction.kind === "recovery" ? (
                <AlertTriangle size={20} strokeWidth={2} />
              ) : adjustPresentation.source === "recommendation" ? (
                <CheckCircle2 size={20} strokeWidth={2} />
              ) : (
                <Target size={20} strokeWidth={2} />
              )}
            </span>
            <CommandSectionHeader
              label={adjustPresentation.primaryDiagnosis.eyebrow}
              title={adjustPresentation.primaryDiagnosis.title}
              subtitle=""
              tone={adjustPresentation.primaryDiagnosis.tone}
            />
          </div>
          <div className="adjustEvidenceLine">
            <span>Pourquoi</span>
            <p>{adjustPresentation.evidence}</p>
          </div>
          <CommandCTA
            variant="primary"
            tone={adjustPresentation.primaryAction.tone}
            onClick={handlePrimaryRecommendationAction}
          >
            {adjustPresentation.primaryAction.label}
          </CommandCTA>
          {adjustPresentation.note ? <p className="adjustHonestNote">{adjustPresentation.note}</p> : null}
        </CommandCard>

        <CommandCard tone="execution" className="adjustContextCard" density="compact">
          <Target size={19} strokeWidth={2} aria-hidden="true" />
          <div>
            <span className="adjustSectionKicker">{adjustPresentation.secondaryContext.label}</span>
            <strong>{adjustPresentation.secondaryContext.title}</strong>
            <p>{adjustPresentation.secondaryContext.description}</p>
          </div>
        </CommandCard>

        <div className="adjustDetailSections" data-testid="adjust-detail-sections">
          {adjustPresentation.detailSections.map((section) => (
            <AdjustDetailSection
              key={section.id}
              section={section}
              open={Boolean(openDetailSections[section.id])}
              onToggle={() => toggleDetailSection(section.id)}
            >
              {section.kind === "signals" ? (
                <AdjustSignalsDetail section={section} />
              ) : section.kind === "trends" ? (
                <AdjustTrendsDetail section={section} />
              ) : section.kind === "actions" ? (
                <AdjustActionsDetail section={section} onAction={onAdjustAction} />
              ) : (
                <AdjustDiagnosticDetail section={section} />
              )}
            </AdjustDetailSection>
          ))}
        </div>
      </div>
      <SystemAnalysisCommandSheet
        open={systemAnalysisSheetOpen}
        state={systemAnalysisSheetState}
        result={displayedSystemAnalysisResult}
        errorCode={displayedSystemAnalysisPreviewState.errorCode}
        message={displayedSystemAnalysisPreviewState.message}
        staleNote={displayedSystemAnalysisPreviewState.staleNote}
        review={systemAnalysisCorrectionReview}
        applicationPreview={systemAnalysisApplicationPreview}
        applicationResult={systemAnalysisApplicationState}
        onClose={handleCloseSystemAnalysisSheet}
        onLaunchAnalysis={handleLaunchSystemAnalysis}
        onSelectChange={handleToggleSystemAnalysisCorrection}
        onConfirmSelection={handleConfirmSystemAnalysisCorrections}
        onBackToCorrections={handleBackToSystemAnalysisCorrections}
        onApplySelectedCorrections={handleApplySystemAnalysisCorrections}
        limited={systemAnalysisIntroLimited}
      />
    </AppScreen>
  );
}
