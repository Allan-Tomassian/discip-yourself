import React from "react";
import { GateCard } from "../shared/ui/gate/Gate";
import { getCategoryUiVars } from "../utils/categoryAccent";
import "./categorySurface.css";

export default function AccentItem({
  color = "#6EE7FF",
  selected = false,
  onClick,
  children,
  rightSlot = null,
  compact = false,
  tone = "accent",
  style = {},
  className = "",
  "aria-label": ariaLabel,
}) {
  const isNeutral = tone === "neutral";
  const mergedClassName = [
    "accentItem",
    "GateRowPremium",
    !compact ? "GateInlineMetaCard" : "",
    !isNeutral ? "categorySurface categorySurface--surface" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <GateCard
      className={mergedClassName}
      selected={selected}
      onClick={onClick}
      right={rightSlot}
      aria-label={ariaLabel}
      style={{
        ...(isNeutral ? { background: "var(--surface-primary)" } : getCategoryUiVars(color, { level: selected ? "focus" : "surface" })),
        ...style,
      }}
    >
      <div className="categorySurfaceBody">{children}</div>
    </GateCard>
  );
}
