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

  const hasListItem = typeof className === "string" && className.split(" ").includes("listItem");
  const padding = hasListItem ? "" : (compact ? "8px 10px" : "10px 10px");

  function normalizeHex(input) {
    if (typeof input !== "string") return null;
    const raw = input.trim().replace(/^#/, "");
    if (raw.length === 3) {
      const expanded = `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
      return /^[0-9a-fA-F]{6}$/.test(expanded) ? `#${expanded.toUpperCase()}` : null;
    }
    if (raw.length === 6) return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : null;
    return null;
  }

  function hexToRgba(hex, alpha = 0.1) {
    const clean = normalizeHex(hex);
    if (!clean) return "";
    const r = parseInt(clean.slice(1, 3), 16);
    const g = parseInt(clean.slice(3, 5), 16);
    const b = parseInt(clean.slice(5, 7), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return "";
    const a = typeof alpha === "number" ? Math.max(0, Math.min(1, alpha)) : 0.1;
    return `rgba(${r},${g},${b},${a})`;
  }

  const normalizedHex = normalizeHex(color);
  const accentTint = !isNeutral && normalizedHex
    ? hexToRgba(normalizedHex, selected ? 0.12 : 0.08)
    : "";

  const accentVars = !isNeutral
    ? {
        "--accent": normalizedHex || color,
        ...(accentTint ? { "--accentTint": accentTint } : null),
        "--accentRailInset": compact ? "8px" : "10px",
      }
    : {};

  const baseStyle = {
    ...(padding ? { padding } : null),
    cursor: clickable ? "pointer" : "default",
    outline: "none",
    ...(isNeutral ? { background: "var(--surface)" } : null),
    ...accentVars,
    ...style,
  };

  const mergedClassName = [
    "accentItem",
    isNeutral ? "" : "accentSurface accentRail",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={mergedClassName}
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
