import React from "react";
import { AppCard } from "../shared/ui/app";
import { getCategoryUiVars } from "../utils/categoryAccent";
import "./categorySurface.css";

export default function AccentItem({
  color = "#6EE7FF",
  selected = false,
  onClick,
  children,
  rightSlot = null,
  tone = "accent",
  style = {},
  className = "",
  "aria-label": ariaLabel,
}) {
  const isNeutral = tone === "neutral";
  const interactive = typeof onClick === "function";
  const mergedClassName = [
    "accentItem",
    !isNeutral ? "categorySurface categorySurface--surface" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AppCard
      interactive={interactive}
      className={mergedClassName}
      selected={selected}
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        ...(isNeutral ? { background: "var(--surface-primary)" } : getCategoryUiVars(color, { level: selected ? "focus" : "surface" })),
        ...style,
      }}
    >
      <div className="libraryAccentItemFrame">
        <div className="categorySurfaceBody">{children}</div>
        {rightSlot ? <div className="libraryAccentItemRight">{rightSlot}</div> : null}
      </div>
    </AppCard>
  );
}
