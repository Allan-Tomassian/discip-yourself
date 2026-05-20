import React from "react";
import { AlertTriangle, SlidersHorizontal } from "lucide-react";
import { CommandSurface } from "../../shared/ui/command";

export default function TodaySystemSignalRow({ surface, onOpenAdjust }) {
  if (!surface) return null;
  const tone = surface.tone === "critical" ? "critical" : "attention";
  return (
    <CommandSurface
      tone={tone}
      density="compact"
      className={`todaySystemSignalRow is-signal-${tone}`}
      data-testid="today-system-signal-row"
      aria-label={`${surface.title}. ${surface.message}`}
    >
      <span className="todaySystemSignalIcon" aria-hidden="true">
        <AlertTriangle size={17} strokeWidth={2} />
      </span>
      <span className="todaySystemSignalContent">
        <span className="todaySystemSignalKicker">SIGNAL SYSTÈME</span>
        <strong>{surface.title}</strong>
        <span>{surface.message}</span>
      </span>
      <button
        type="button"
        className="todaySystemSignalAction"
        onClick={() => onOpenAdjust?.()}
      >
        <SlidersHorizontal size={15} strokeWidth={2} aria-hidden="true" />
        <span>{surface.ctaLabel || "Ajuster"}</span>
      </button>
    </CommandSurface>
  );
}
