import React from "react";

export default function Gauge({ label, currentValue, targetValue, unit, accentColor }) {
  const current = Number.isFinite(currentValue) ? currentValue : null;
  const target = Number.isFinite(targetValue) ? targetValue : null;
  if (!target || target <= 0 || current == null) return null;

  const progress = Math.min(current / target, 1);
  const displayUnit = unit ? ` ${unit}` : "";
  const fillColor = accentColor || "var(--accent)";

  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="small2">{label}</div>
        <div className="small2">
          {current}
          {displayUnit} / {target}
          {displayUnit}
        </div>
      </div>
      <div
        style={{
          width: "100%",
          height: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: "100%",
            borderRadius: 999,
            background: fillColor,
          }}
        />
      </div>
    </div>
  );
}
