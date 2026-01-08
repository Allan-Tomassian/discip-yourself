

import React, { useMemo } from "react";

// UI row used across pages to display a selectable category with:
// - the same left "parenthesis" marker as Pilotage when selected
// - the same soft gradient background when selected
// - proper accessibility (button semantics + focus ring)
//
// Usage:
// <CategorySelectableRow
//   label="Travail"
//   sublabel="3 objectifs · 5 actions"
//   accent="#4BD3FF" // optional
//   selected={isSelected}
//   onSelect={() => setSelected(id)}
//   right={<Pill>Active</Pill>}
// />

function normalizeAccent(accent) {
  if (!accent) return null;
  // Accept: "#RRGGBB", "rgb(...)", "hsl(...)", CSS var, etc.
  return String(accent);
}

export default function CategorySelectableRow({
  label,
  sublabel,
  accent,
  selected = false,
  onSelect,
  right = null,
  disabled = false,
  className = "",
  style = {},
  "aria-label": ariaLabel,
  "data-testid": testId,
}) {
  const a = useMemo(() => normalizeAccent(accent) || "var(--accent, #5bc7ff)", [accent]);

  const handleClick = (e) => {
    if (disabled) return;
    onSelect?.(e);
  };

  // Keep the existing bracket/gradient look: we only replicate the same visual rule.
  const rowStyle = {
    position: "relative",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,

    padding: "18px 18px 18px 22px",
    borderRadius: 18,

    // Do not touch global theme borders; mimic the Pilotage selected gradient only.
    background: selected
      ? `linear-gradient(90deg, ${a}26 0%, ${a}14 35%, rgba(0,0,0,0) 100%)`
      : "transparent",

    border: "0",
    cursor: disabled ? "not-allowed" : "pointer",

    // Let existing typography come from parent; just ensure text aligns.
    textAlign: "left",
    ...style,
  };

  const titleStyle = {
    fontWeight: 700,
    fontSize: 22,
    lineHeight: "26px",
  };

  const subStyle = {
    opacity: 0.75,
    fontSize: 14,
    marginTop: 4,
  };

  // Left "parenthesis" marker (same shape logic as Pilotage)
  const bracketStyle = {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    width: 10,
    height: 52,
    borderLeft: `5px solid ${selected ? a : "rgba(255,255,255,0.10)"}`,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    pointerEvents: "none",
    opacity: selected ? 1 : 0.65,
  };

  const focusRing = {
    outline: "none",
    boxShadow: "none",
  };

  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel || label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={handleClick}
      className={className}
      style={rowStyle}
      onFocus={(e) => {
        // Add a visible focus ring without changing existing design.
        e.currentTarget.style.boxShadow = `0 0 0 2px ${a}55`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span style={bracketStyle} />

      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <span style={{ ...titleStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
        {sublabel ? (
          <span
            style={{
              ...subStyle,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sublabel}
          </span>
        ) : null}
      </span>

      {right ? <span style={{ flex: "none" }}>{right}</span> : null}

      {/* Keep for future: consistent outline reset */}
      <span style={focusRing} />
    </button>
  );
}