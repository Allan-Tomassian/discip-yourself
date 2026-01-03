import React from "react";

export default function Gauge({ label, currentValue, targetValue, unit, accentColor, className }) {
  const hasTarget = Number.isFinite(targetValue) && targetValue > 0;
  const current = Number.isFinite(currentValue) && currentValue >= 0 ? currentValue : 0;
  const target = hasTarget ? targetValue : 0;
  const progress = hasTarget ? Math.min(current / target, 1) : 0;
  const displayUnit = unit ? ` ${unit}` : "";
  const fillColor = accentColor || "var(--accent)";

  return (
    <div
      className={`gaugeWrap${className ? ` ${className}` : ""}`}
      style={{ gap: 6 }}
    >
      <div className="gaugeTop">
        <div className="small2 gaugeTitle">{label}</div>
        <div className="small2 gaugeValue">
          {hasTarget ? (
            <>
              {current}
              {displayUnit} / {target}
              {displayUnit}
            </>
          ) : (
            "Non configuré"
          )}
        </div>
      </div>
      <div className="gaugeBarRow"
        style={{
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
      {!hasTarget ? (
        <div className="small2" style={{ opacity: 0.7 }}>
          Définir une cible pour activer la jauge
        </div>
      ) : null}
    </div>
  );
}
