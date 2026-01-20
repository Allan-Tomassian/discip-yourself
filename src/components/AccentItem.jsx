import React from "react";

// AccentItem = source de vérité UI pour :
// - dégradé par catégorie
// - "parenthèse" (border-left) quand selected
// - transitions + spacing identiques à Pilotage
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
  const clickable = typeof onClick === "function";
  const isNeutral = tone === "neutral";

  const padding = compact ? "8px 10px" : "10px 10px";

  const baseStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding,
    borderRadius: 12,
    background: isNeutral
      ? "var(--surface)"
      : selected
        ? `linear-gradient(90deg, rgba(0,0,0,0), ${color}22)`
        : `linear-gradient(90deg, rgba(0,0,0,0), ${color}0F)`,
    borderLeft: isNeutral ? "4px solid transparent" : selected ? `4px solid ${color}` : "4px solid transparent",
    transition: "background 180ms ease, border-left-color 180ms ease",
    cursor: clickable ? "pointer" : "default",
    outline: "none",
    ...style,
  };

  return (
    <div
      className={className}
      style={baseStyle}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
      {rightSlot ? <div style={{ display: "flex", alignItems: "center" }}>{rightSlot}</div> : null}
    </div>
  );
}
