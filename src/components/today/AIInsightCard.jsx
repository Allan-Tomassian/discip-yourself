import React from "react";
import { BrainCircuit, Sparkles } from "lucide-react";
import CommandSurface from "./CommandSurface";

export default function AIInsightCard({
  headline = "Insight disponible.",
  recommendation = "Protège le prochain bloc avant de renégocier.",
  reason = "",
  onApply,
  onWhy,
  onOpenCoach,
}) {
  return (
    <CommandSurface className="todayAiInsightCard" tone="ai" data-testid="today-ai-insight-card">
      <div className="todayAiSignal" aria-hidden="true" />
      <div className="todayAiHeader">
        <span className="todayAiEyebrow">
          <BrainCircuit size={18} strokeWidth={1.8} aria-hidden="true" />
          Insight IA
        </span>
        <button type="button" className="todayAiCoachButton" onClick={() => onOpenCoach?.()}>
          <Sparkles size={14} strokeWidth={1.9} aria-hidden="true" />
          Coach IA
        </button>
      </div>

      <div className="todayAiBody">
        <h2>{headline}</h2>
        {recommendation ? <p className="todayAiRecommendation">{recommendation}</p> : null}
        {reason ? <p className="todayAiReason">{reason}</p> : null}
      </div>

      <div className="todayAiActions">
        <button type="button" className="todayAiApplyButton" onClick={() => onApply?.()}>
          <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
          Appliquer
        </button>
        <button type="button" className="todayAiWhyButton" onClick={() => onWhy?.()}>
          Voir pourquoi
        </button>
      </div>
    </CommandSurface>
  );
}
