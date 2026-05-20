import React from "react";
import { Lock, Sparkles } from "lucide-react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function SystemAnalysisEntryButton({
  model,
  onClick,
  className = "",
}) {
  if (!model?.visible) return null;
  const enabled = model.enabled === true;
  const tone = model.tone || "disabled";
  const state = model.state || "locked";
  const isRunning = state === "running";
  const isExplanatory = !enabled && !isRunning;
  const Icon = tone === "ai" || enabled || state === "running" ? Sparkles : Lock;

  function handleClick(event) {
    if (isRunning) return;
    onClick?.(event);
  }

  return (
    <button
      type="button"
      className={cx(
        "systemAnalysisEntryButton",
        `systemAnalysisEntryButton--${state}`,
        `systemAnalysisEntryButton--tone-${tone}`,
        className
      )}
      data-system-analysis-state={state}
      data-system-analysis-tone={tone}
      data-system-analysis-explanatory={isExplanatory ? "true" : undefined}
      aria-label={model.ariaLabel || model.label}
      title={model.reason || model.title || model.label}
      disabled={isRunning}
      onClick={handleClick}
    >
      <span className="systemAnalysisEntryButton__icon" aria-hidden="true">
        <Icon size={14} strokeWidth={2.2} />
      </span>
      <span className="systemAnalysisEntryButton__label">{model.label}</span>
    </button>
  );
}
