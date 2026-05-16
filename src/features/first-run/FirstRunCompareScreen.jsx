import React from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Gauge,
  ListChecks,
  Lock,
  Mountain,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { ChoiceCard, GhostButton, PrimaryButton } from "../../shared/ui/app";
import { FIRST_RUN_AI_ASSISTED_SOURCE } from "./firstRunPlanContract";
import FirstRunCommandSurface from "./FirstRunCommandSurface";

function buildMetrics(plan) {
  const metrics = plan?.comparisonMetrics || {};
  return [
    Number(metrics.weeklyMinutes) > 0 ? `${metrics.weeklyMinutes} min` : "",
    Number(metrics.totalBlocks) > 0 ? `${metrics.totalBlocks} blocs` : "",
    Number(metrics.recoverySlots) > 0 ? `${metrics.recoverySlots} marges` : "",
    metrics.dailyDensity === "soutenue" ? "Rythme soutenu" : "Rythme respirable",
  ].filter(Boolean);
}

function renderPreviewLine(item) {
  if (!item || typeof item !== "object") return "";
  const prefix = [item.dayLabel, item.slotLabel].filter(Boolean).join(" • ");
  const suffix = [item.categoryLabel, Number(item.minutes) > 0 ? `${item.minutes} min` : ""]
    .filter(Boolean)
    .join(" • ");
  return [prefix, item.title, suffix].filter(Boolean).join(" — ");
}

function getPlanTone(plan) {
  return plan?.variant === "ambitious" || plan?.id === "ambitious" ? "ambitious" : "tenable";
}

function isRecommendedPlanSet(generatedPlans, selectedPlan) {
  return (
    Number(generatedPlans?.version) === 3 ||
    generatedPlans?.source === "deterministic_starter" ||
    selectedPlan?.id === "recommended" ||
    selectedPlan?.variant === "recommended"
  );
}

function PlanDecisionCard({ plan, selected, onSelect }) {
  const tone = getPlanTone(plan);
  const metrics = buildMetrics(plan).slice(0, 4);
  const rationale = [plan?.rationale?.whyFit, plan?.rationale?.capacityFit, plan?.rationale?.constraintFit]
    .filter(Boolean)
    .slice(0, 3);

  return (
    <ChoiceCard
      className={`firstRunPlanDecisionCard firstRunPlanDecisionCard--${tone}`}
      selected={selected}
      onClick={() => onSelect(plan.id)}
    >
      <div className="firstRunPlanDecisionTop">
        <span className="firstRunPlanDecisionIcon" aria-hidden="true">
          {tone === "ambitious" ? <Zap size={22} strokeWidth={1.7} /> : <Mountain size={22} strokeWidth={1.7} />}
        </span>
        <span className="firstRunPlanDecisionTitleBlock">
          <strong>{plan.title}</strong>
          <span>{plan.summary || (tone === "ambitious" ? "Plus dense, plus exigeant." : "Durable et réaliste.")}</span>
        </span>
        <span className="firstRunPlanDecisionCheck" aria-hidden="true">
          {selected ? <Check size={16} strokeWidth={2.2} /> : null}
        </span>
      </div>

      {metrics.length ? (
        <div className="firstRunPlanMetricGrid">
          {metrics.map((metric) => (
            <span key={`${plan.id}_${metric}`}>{metric}</span>
          ))}
        </div>
      ) : null}

      {rationale.length ? (
        <div className="firstRunPlanSignalList">
          {rationale.map((line, index) => (
            <span key={`${plan.id}_rationale_${index}`}>
              <Check size={13} strokeWidth={2} aria-hidden="true" />
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </ChoiceCard>
  );
}

function formatMinutes(minutes) {
  const numeric = Number(minutes);
  return Number.isFinite(numeric) && numeric > 0 ? `${Math.round(numeric)} min` : "";
}

function getPrimaryTodayBlock(plan) {
  const todayPreview = Array.isArray(plan?.todayPreview) ? plan.todayPreview : [];
  const preview = Array.isArray(plan?.preview) ? plan.preview : [];
  return todayPreview[0] || preview[0] || null;
}

function buildCreatedSummary(plan) {
  const draft = plan?.commitDraft || {};
  const actionCount = Array.isArray(draft.actions) ? draft.actions.length : 0;
  const occurrenceCount = Array.isArray(draft.occurrences) ? draft.occurrences.length : 0;
  return [
    { icon: Target, label: "Objectif", value: "1 objectif principal" },
    { icon: ListChecks, label: "Actions", value: actionCount ? `${actionCount} actions prévues` : "Actions prêtes" },
    { icon: CalendarDays, label: "Planning", value: occurrenceCount ? `${occurrenceCount} blocs sur 7 jours` : "7 jours préparés" },
    { icon: ShieldCheck, label: "Today", value: "Premier bloc prêt" },
  ];
}

function RecommendedWeekStructure({ weekSchedule = [] }) {
  const safeSchedule = Array.isArray(weekSchedule) ? weekSchedule.slice(0, 7) : [];
  const totalBlocks = safeSchedule.reduce((sum, day) => sum + (Number(day?.blockCount) || 0), 0);
  const totalMinutes = safeSchedule.reduce((sum, day) => sum + (Number(day?.totalMinutes) || 0), 0);
  return (
    <div className="firstRunRecommendedWeek">
      <div className="firstRunRecommendedWeekBars" aria-label="Structure 7 jours">
        {safeSchedule.map((day, index) => (
          <span
            key={day.dayKey || `day_${index}`}
            className={Number(day.blockCount) > 0 ? "is-active" : "is-rest"}
            title={`${day.dayLabel}: ${day.loadLabel || "Récupération"}`}
          >
            <i style={{ height: `${10 + 20 * Math.min(1, Math.max(0.16, (Number(day.blockCount) || 0) / 3))}px` }} />
            <em>{String(day.dayLabel || "").slice(0, 1) || index + 1}</em>
          </span>
        ))}
      </div>
      <p>
        {totalBlocks ? `${totalBlocks} blocs préparés` : "Structure préparée"}
        {totalMinutes ? ` · ${totalMinutes} min` : ""} · rythme réaliste.
      </p>
    </div>
  );
}

function RecommendedPlanReview({ data, plan, generatedPlans, onBack, onContinue }) {
  const todayBlock = getPrimaryTodayBlock(plan);
  const draft = plan?.commitDraft || {};
  const actions = Array.isArray(draft.actions) ? draft.actions.slice(0, 4) : [];
  const isAiAssisted = generatedPlans?.source === FIRST_RUN_AI_ASSISTED_SOURCE;
  const sourceLabel = isAiAssisted
    ? "Affiné par l’IA à partir de tes signaux."
    : "Créé à partir de tes signaux. Tu peux l’activer maintenant.";
  const missingInformation = Array.isArray(generatedPlans?.ai?.missingInformation) && generatedPlans.ai.missingInformation.length
    ? generatedPlans.ai.missingInformation
    : ["Horaires précis", "Niveau d’énergie", "Habitudes actuelles", "Contraintes fixes"];

  return (
    <FirstRunCommandSurface
      data={data}
      testId="first-run-screen-compare"
      activeStep="compare"
      progressMode="activation"
      tone="execution"
      className="firstRunCommandSurface--compare firstRunCommandSurface--compareRecommended"
      bodyClassName="firstRunCompareBody firstRunActivationBody firstRunRecommendedBody"
      eyebrow="PLAN RECOMMANDÉ"
      title="Ton plan recommandé est prêt."
      subtitle={sourceLabel}
      securityTitle="Activation sécurisée"
      securityText="Tu pourras ajuster ton système après."
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!plan} onClick={onContinue}>
            Activer ce plan
          </PrimaryButton>
        </>
      }
    >
      <div
        className={`firstRunRecommendedSourceBadge ${
          isAiAssisted ? "firstRunRecommendedSourceBadge--ai" : "firstRunRecommendedSourceBadge--system"
        }`}
        data-testid="first-run-v3-source-label"
      >
        {isAiAssisted ? <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" /> : <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />}
        <span>{sourceLabel}</span>
      </div>

      <div className="firstRunRecommendedPlanGrid" data-testid="first-run-v3-plan-review">
        <div className="firstRunRecommendedInfoCard firstRunRecommendedInfoCard--goal">
          <Target size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong>Objectif principal</strong>
            <em>{plan?.weekGoal || draft.goals?.[0]?.title || "Reprendre le contrôle de ma journée"}</em>
          </span>
        </div>

        <div className="firstRunRecommendedInfoCard firstRunRecommendedInfoCard--today">
          <Zap size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong>Premier bloc Today</strong>
            <em>
              {todayBlock
                ? [todayBlock.title, formatMinutes(todayBlock.minutes), todayBlock.slotLabel].filter(Boolean).join(" · ")
                : "Premier bloc prêt"}
            </em>
          </span>
          <b>Prêt</b>
        </div>

        <div className="firstRunRecommendedInfoCard firstRunRecommendedInfoCard--week">
          <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong>Structure 7 jours</strong>
            <em>{plan?.weekBenefit || "Créer une preuve d’exécution dès aujourd’hui."}</em>
          </span>
          <RecommendedWeekStructure weekSchedule={plan?.weekSchedule} />
        </div>

        <div className="firstRunRecommendedInfoCard firstRunRecommendedInfoCard--actions">
          <ListChecks size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong>Actions prévues</strong>
            <em>Ce qui sera activé dans ton système.</em>
          </span>
          <div className="firstRunRecommendedActionList">
            {actions.map((action) => (
              <span key={action.id}>
                <Check size={13} strokeWidth={2} aria-hidden="true" />
                {action.title}
                {formatMinutes(action.durationMinutes) ? <em>{formatMinutes(action.durationMinutes)}</em> : null}
              </span>
            ))}
          </div>
        </div>

        <div className="firstRunRecommendedInfoCard firstRunRecommendedInfoCard--rationale">
          <Gauge size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong>Pourquoi ce plan est réaliste</strong>
            <em>{plan?.rationale?.capacityFit || "La charge est calibrée sur tes signaux."}</em>
            {plan?.rationale?.constraintFit ? <em>{plan.rationale.constraintFit}</em> : null}
          </span>
        </div>

        <div className="firstRunRecommendedCreationGrid">
          {buildCreatedSummary(plan).map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="firstRunRecommendedCreationTile">
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            );
          })}
        </div>
      </div>

      <div className="firstRunAiLockedCard" data-testid="first-run-ai-precision-locked">
        <div className="firstRunAiLockedHeader">
          <span className="firstRunAiLockedIcon" aria-hidden="true">
            <Sparkles size={18} strokeWidth={1.8} />
            <Lock size={13} strokeWidth={2} />
          </span>
          <span>
            <strong>Plan plus précis avec IA</strong>
            <em>Verrouillé</em>
          </span>
        </div>
        <p>Ajoute plus d’informations pour générer une version vraiment personnalisée.</p>
        <div className="firstRunAiLockedMissingList">
          {missingInformation.map((item) => (
            <span key={item}>
              <Lock size={13} strokeWidth={1.9} aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
        <button className="firstRunAiLockedButton" type="button" disabled>
          Ajouter les infos manquantes
        </button>
      </div>
    </FirstRunCommandSurface>
  );
}

export default function FirstRunCompareScreen({
  data,
  generatedPlans,
  selectedPlanId,
  onBack,
  onSelectPlan,
  onContinue,
}) {
  const safePlans = Array.isArray(generatedPlans?.plans) ? generatedPlans.plans : [];
  const selectedPlan = safePlans.find((plan) => plan.id === selectedPlanId) || safePlans[0] || null;
  if (isRecommendedPlanSet(generatedPlans, selectedPlan)) {
    return (
      <RecommendedPlanReview
        data={data}
        plan={selectedPlan}
        generatedPlans={generatedPlans}
        onBack={onBack}
        onContinue={onContinue}
      />
    );
  }

  const isLocalFallback = generatedPlans?.source === "local_fallback";
  const previewItems = selectedPlan
    ? Array.isArray(selectedPlan.todayPreview) && selectedPlan.todayPreview.length
      ? selectedPlan.todayPreview
      : Array.isArray(selectedPlan.preview) ? selectedPlan.preview : []
    : [];

  return (
    <FirstRunCommandSurface
      data={data}
      testId="first-run-screen-compare"
      activeStep="compare"
      progressMode="activation"
      tone="execution"
      className="firstRunCommandSurface--compare"
      bodyClassName="firstRunCompareBody firstRunActivationBody"
      eyebrow="Compare les plans"
      title="Choisis ton plan"
      subtitle="Deux niveaux d’ambition. Un seul système à activer."
      securityTitle="Choix réversible"
      securityText="Tu pourras ajuster ton système après activation."
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!selectedPlanId} onClick={onContinue}>
            Continuer avec ce plan
          </PrimaryButton>
        </>
      }
    >
      {isLocalFallback ? (
        <div className="firstRunLocalFallbackBanner" data-testid="first-run-local-fallback-banner">
          <AlertCircle size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong>IA indisponible</strong>
            <span>Ton système est généré localement.</span>
          </span>
        </div>
      ) : null}

      <div className="firstRunPlanDecisionGrid">
        {safePlans.map((plan) => (
          <PlanDecisionCard
            key={plan.id}
            plan={plan}
            selected={selectedPlanId === plan.id}
            onSelect={onSelectPlan}
          />
        ))}
      </div>

      <div className="firstRunSelectedPlanPanel">
        <div className="firstRunSelectedPlanHeader">
          <ShieldCheck size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong>{selectedPlan ? "Plan sélectionné" : "Sélectionne un plan"}</strong>
            <span>
              {selectedPlan
                ? `${selectedPlan.title} est prêt pour l’activation.`
                : "Le bouton d’activation reste verrouillé tant qu’aucun plan n’est choisi."}
            </span>
          </span>
        </div>

        {selectedPlan ? (
          <>
            <div className="firstRunCompareCategoryRow">
              {(Array.isArray(selectedPlan.categories) ? selectedPlan.categories : []).map((category) => (
                <AppChip
                  key={`${selectedPlan.id}_category_${category.id}`}
                  className={`firstRunCompareCategoryChip ${category.role === "primary" ? "is-primary" : ""}`}
                >
                  {category.label}
                  {Number(category.blockCount) > 0 ? ` · ${category.blockCount}` : ""}
                </AppChip>
              ))}
            </div>

            {previewItems.length ? (
              <div className="firstRunPlanPreviewList firstRunPlanPreviewList--compact">
                {previewItems.slice(0, 3).map((previewItem, index) => (
                  <div key={`${selectedPlan.id}_${index}`} className="firstRunPlanPreviewItem">
                    {renderPreviewLine(previewItem)}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="firstRunCompareReminder">
        <Gauge size={16} strokeWidth={1.8} aria-hidden="true" />
        <span>Rappel: l’important est d’activer un système que tu peux tenir.</span>
      </div>
    </FirstRunCommandSurface>
  );
}
