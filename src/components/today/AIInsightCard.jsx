import React from "react";
import { ArrowDown, ArrowRight, ChevronRight, Plus, Sparkles } from "lucide-react";
import CommandSurface from "./CommandSurface";

export default function AIInsightCard({
  state = "neutral",
  tone = "neutral",
  motionIntensity = "normal",
  aiMode = "",
  status = "available",
  canApply = true,
  onApply,
  onOpenCoach,
  onOptimize,
}) {
  const resolvedAiMode = aiMode || status;
  const statusClass = resolvedAiMode ? ` is-ai-${String(resolvedAiMode).replace(/_/g, "-")}` : "";
  const applyClass = canApply ? " is-ai-entry" : "";
  const stateClass = state ? ` today-state-${state}` : "";
  const toneClass = tone ? ` today-tone-${tone}` : "";
  const motionClass = motionIntensity ? ` today-motion-${motionIntensity}` : "";
  const handleOptimize = () => {
    if (typeof onOptimize === "function") {
      onOptimize();
      return;
    }
    if (typeof onOpenCoach === "function") {
      onOpenCoach();
      return;
    }
    if (typeof onApply === "function") onApply();
  };

  return (
    <CommandSurface className={`todayAiInsightCard${statusClass}${applyClass}${stateClass}${toneClass}${motionClass}`} tone="ai" data-testid="today-ai-insight-card" data-tour-id="today-ai-insight-card">
      <div className="todayAiBackdrop" aria-hidden="true" />
      <div className="todayAiBody">
        <div className="todayAiTitleRow">
          <span className="todayAiBadgeIcon" aria-hidden="true">
            <Sparkles size={24} strokeWidth={2.1} />
          </span>
          <div className="todayAiTitleCopy">
            <div className="todayAiHeadlineRow">
              <h2>Analyse IA du jour</h2>
              <span className="todayAiNewBadge">NOUVEAU</span>
            </div>
            <p>L’IA analyse ta journée et propose des ajustements ciblés.</p>
          </div>
        </div>
        <div className="todayAiChips" aria-label="Actions d’optimisation proposées">
          <span><ArrowDown size={15} strokeWidth={2} aria-hidden="true" />Réduire un bloc</span>
          <span><ArrowRight size={15} strokeWidth={2} aria-hidden="true" />Déplacer</span>
          <span><Plus size={15} strokeWidth={2} aria-hidden="true" />Ajouter un bloc</span>
        </div>
      </div>

      <div className="todayAiActions">
        <button
          type="button"
          className="todayAiApplyButton"
          onClick={handleOptimize}
        >
          <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
          Optimiser aujourd’hui
          <ChevronRight size={18} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>
    </CommandSurface>
  );
}
