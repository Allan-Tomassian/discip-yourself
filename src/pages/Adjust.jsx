import React, { useMemo } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Gauge,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { AppScreen } from "../shared/ui/app";
import {
  CommandAIBlock,
  CommandBadge,
  CommandCard,
  CommandCTA,
  CommandEmptyState,
  CommandSectionHeader,
  CommandSurface,
} from "../shared/ui/command";
import { ADJUST_ACTION_IDS, buildAdjustDiagnostic } from "../features/adjust/adjustDiagnostic";
import { buildAdjustSystemSignalPreview } from "../features/adjust/adjustSystemSignalPreviewModel";
import { getPrimarySystemSignal } from "../logic/systemSignals";
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

function formatDateLabel(dateKey) {
  const date = fromLocalDateKey(dateKey);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatShortDay(dateKey) {
  const date = fromLocalDateKey(dateKey);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date).replace(".", "");
}

function formatMinutes(minutes) {
  const safeMinutes = Number(minutes);
  if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) return "0 min";
  const rounded = Math.round(safeMinutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours}h ${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function formatScore(score) {
  return Number.isFinite(score) ? `${Math.round(score)}%` : "--%";
}

function formatBlockMeta(block) {
  if (!block) return "Aucun bloc net";
  const parts = [];
  if (block.categoryName) parts.push(block.categoryName);
  if (block.dateKey) parts.push(formatDateLabel(block.dateKey));
  if (block.start) parts.push(block.start);
  if (block.durationMinutes) parts.push(formatMinutes(block.durationMinutes));
  return parts.join(" · ");
}

function resolveSummaryTone(summary) {
  if (!summary?.hasPlannedData) return "neutral";
  if (summary.state === "friction") return "attention";
  if (summary.state === "control") return "execution";
  return "neutral";
}

function resolveStateLabel(summary) {
  if (!summary?.hasPlannedData) return "Signal faible";
  if (summary.state === "friction") return "Friction";
  if (summary.state === "control") return "Sous contrôle";
  return "À ajuster";
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
  const Icon = ACTION_ICONS[action.id] || SlidersHorizontal;
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

export default function Adjust({ data, onAdjustAction }) {
  const safeData = useMemo(() => (data && typeof data === "object" ? data : {}), [data]);
  const activeDateKey =
    normalizeLocalDateKey(safeData?.ui?.selectedDateKey) ||
    normalizeLocalDateKey(safeData?.ui?.selectedDate) ||
    todayLocalKey();
  const diagnostic = useMemo(
    () => buildAdjustDiagnostic(safeData, activeDateKey),
    [activeDateKey, safeData]
  );
  const { summary, nextBlock, frictionSignals, recommendation, quickActions, trendSnapshot, categorySignals, systemSignals } = diagnostic;
  const summaryTone = resolveSummaryTone(summary);
  const systemSignalPreview = buildAdjustSystemSignalPreview(
    getPrimarySystemSignal(Array.isArray(systemSignals) ? systemSignals : [])
  );
  const hasSignals = Array.isArray(frictionSignals) && frictionSignals.length > 0;
  const visibleFrictionSignals = hasSignals ? frictionSignals.slice(0, 2) : [];
  const hiddenFrictionCount = hasSignals ? Math.max(0, frictionSignals.length - visibleFrictionSignals.length) : 0;
  const recommendationTone = recommendation?.tone || "execution";
  const hasUsefulData = Boolean(summary?.hasPlannedData || nextBlock || hasSignals);

  const recommendationAction = quickActions.find((action) => action.id === recommendation?.actionId) || null;

  return (
    <AppScreen
      pageId="adjust"
      headerTitle={ADJUST_SCREEN_COPY.title}
      headerSubtitle={ADJUST_SCREEN_COPY.subtitle}
    >
      <div className="adjustCommandPage CommandMotionReveal">
        <CommandSurface tone="execution" className="adjustHero" density="compact">
          <span className="adjustHeroGlyph" aria-hidden="true">
            <SlidersHorizontal size={22} strokeWidth={2} />
          </span>
          <CommandSectionHeader
            label="AJUSTER"
            title="Corrige ton système."
            subtitle="Analyse la friction, allège la charge et protège le prochain bloc utile."
            tone="execution"
          />
          <span className="adjustHeroWave" aria-hidden="true" />
        </CommandSurface>

        <CommandCard tone={summaryTone} className="adjustSummaryCard" density="compact">
          <div className="adjustSummaryHeader">
            <div>
              <span className="adjustSectionKicker">ÉTAT DU SYSTÈME — AUJOURD’HUI</span>
              <strong>{resolveStateLabel(summary)}</strong>
            </div>
            <CommandBadge tone={summaryTone}>{formatDateLabel(summary.activeDateKey)}</CommandBadge>
          </div>
          <div className="adjustSummaryGrid">
            <div className="adjustScoreRing" style={{ "--adjust-score": `${summary.completionScore || 0}%` }}>
              <span>{formatScore(summary.completionScore)}</span>
              <small>Score</small>
            </div>
            <div className="adjustSummaryMetrics">
              <div><span>Blocs planifiés</span><strong>{summary.plannedCount}</strong></div>
              <div><span>Terminés</span><strong>{summary.doneCount}</strong></div>
              <div><span>Manqués / reportés</span><strong>{summary.missedCount + summary.postponedCount}</strong></div>
              <div><span>Charge restante</span><strong>{formatMinutes(summary.remainingMinutes)}</strong></div>
            </div>
          </div>
        </CommandCard>

        {systemSignalPreview ? (
          <CommandCard
            tone={systemSignalPreview.tone}
            className={`adjustSystemSignalCard is-signal-${systemSignalPreview.tone}`}
            density="compact"
            data-testid="adjust-system-signal-preview"
          >
            <div className="adjustSystemSignalIcon" aria-hidden="true">
              <AlertTriangle size={17} strokeWidth={2} />
            </div>
            <div className="adjustSystemSignalText">
              <span className="adjustSectionKicker">SIGNAL SYSTÈME</span>
              <strong>{systemSignalPreview.title}</strong>
              <p>{systemSignalPreview.message}</p>
            </div>
          </CommandCard>
        ) : null}

        <CommandCard tone={recommendationTone} className="adjustRecommendationCard adjustRecommendationCard--primary" density="compact">
          <CommandSectionHeader
            label="RECOMMANDATION"
            title={recommendation?.title || "Choisis un ajustement simple"}
            subtitle={recommendation?.description || "Aucune correction automatique n’est appliquée depuis cette page."}
            tone={recommendationTone}
          />
          <CommandCTA
            variant="primary"
            onClick={() => onAdjustAction?.(recommendation?.actionId || ADJUST_ACTION_IDS.ASK_COACH)}
          >
            {recommendationAction ? recommendationAction.label : "Lancer cette correction"}
          </CommandCTA>
          {Array.isArray(recommendation?.expectedImpact) && recommendation.expectedImpact.length ? (
            <div className="adjustImpactList">
              <span>Impact attendu</span>
              {recommendation.expectedImpact.map((item) => (
                <div key={item}><Sparkles size={13} strokeWidth={2} aria-hidden="true" />{item}</div>
              ))}
            </div>
          ) : null}
          <p className="adjustHonestNote">Aucune modification n’est appliquée sans passer par l’action choisie.</p>
        </CommandCard>

        {nextBlock ? (
          <CommandCard tone="execution" className="adjustNextBlockCard" density="compact">
            <Target size={20} strokeWidth={2} aria-hidden="true" />
            <div>
              <span className="adjustSectionKicker">PROCHAIN BLOC UTILE</span>
              <strong>{nextBlock.title}</strong>
              <p>{formatBlockMeta(nextBlock)}</p>
            </div>
          </CommandCard>
        ) : null}

        {!hasUsefulData ? (
          <CommandEmptyState
            label="DIAGNOSTIC"
            title="Pas encore assez de signaux"
            subtitle="Ajuster devient utile quand des blocs sont planifiés ou exécutés. Commence par structurer ton planning ou demande au Coach IA de clarifier le prochain bloc."
            tone="neutral"
            className="adjustEmptyState"
            actions={(
              <>
                <CommandCTA variant="primary" onClick={() => onAdjustAction?.(ADJUST_ACTION_IDS.REORGANIZE_SCHEDULE)}>
                  Ouvrir Planning
                </CommandCTA>
                <CommandCTA variant="secondary" tone="ai" onClick={() => onAdjustAction?.(ADJUST_ACTION_IDS.ASK_COACH)}>
                  Demander au Coach IA
                </CommandCTA>
              </>
            )}
          />
        ) : null}

        <section className="adjustSection" aria-labelledby="adjust-friction-title">
          <CommandSectionHeader
            id="adjust-friction-title"
            label="FRICTION"
            title="Ce qui bloque maintenant"
            subtitle={hasSignals ? "Les signaux les plus utiles à corriger maintenant." : "Aucune friction forte détectée pour le moment."}
            tone={hasSignals ? "attention" : "neutral"}
            className="adjustInlineHeader"
          />
          {hasSignals ? (
            <div className="adjustFrictionGrid">
              {visibleFrictionSignals.map((signal) => (
                <CommandCard key={signal.id} tone="attention" className="adjustFrictionCard adjustFrictionCard--preview" density="compact">
                  <div className="adjustFrictionIcon" aria-hidden="true">
                    <AlertTriangle size={17} strokeWidth={2} />
                  </div>
                  <div>
                    <strong>{signal.title}</strong>
                    <p>{signal.description}</p>
                  </div>
                </CommandCard>
              ))}
              {hiddenFrictionCount ? (
                <p className="adjustFrictionMore">
                  {hiddenFrictionCount} autre{hiddenFrictionCount > 1 ? "s" : ""} {hiddenFrictionCount > 1 ? "signaux placés" : "signal placé"} plus bas dans l’analyse.
                </p>
              ) : null}
            </div>
          ) : (
            <CommandCard tone="neutral" className="adjustCalmCard" density="compact">
              <CheckCircle2 size={20} strokeWidth={2} aria-hidden="true" />
              <div>
                <strong>Système lisible</strong>
                <p>Rien ne justifie une alerte. Tu peux garder le prochain bloc comme point d’appui.</p>
              </div>
            </CommandCard>
          )}
        </section>

        <section className="adjustSection" aria-labelledby="adjust-actions-title">
          <CommandSectionHeader
            id="adjust-actions-title"
            label="ACTIONS RAPIDES"
            title="Choisis le bon levier"
            subtitle="Ces actions ouvrent Coach IA ou Planning. Elles ne modifient rien automatiquement."
            tone="execution"
            className="adjustInlineHeader"
          />
          <div className="adjustQuickActions">
            {quickActions.map((action) => (
              <ActionButton key={action.id} action={action} onAction={onAdjustAction} />
            ))}
          </div>
        </section>

        <TrendSnapshot trendSnapshot={trendSnapshot} />
        <CategorySignals signals={categorySignals} />

        <CommandAIBlock
          label="COACH IA"
          title="Besoin d’un arbitrage ?"
          subtitle="Le Coach peut transformer ce diagnostic en plan d’action conversationnel."
          className="adjustCoachBlock"
        >
          <div className="adjustCoachBlockBody">
            <BrainCircuit size={21} strokeWidth={2} aria-hidden="true" />
            <div>
              <strong>Demander une analyse au Coach IA</strong>
              <p>Tu gardes le contrôle : le Coach propose, tu valides.</p>
            </div>
          </div>
          <CommandCTA tone="ai" variant="secondary" onClick={() => onAdjustAction?.(ADJUST_ACTION_IDS.ASK_COACH)}>
            Ouvrir le Coach IA
          </CommandCTA>
        </CommandAIBlock>

      </div>
    </AppScreen>
  );
}
