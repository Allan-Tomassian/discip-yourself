import React, { useId, useMemo } from "react";
import { buildDisciplineTrendChartGeometry } from "./disciplineTrendChartModel";

function formatShortDateLabel(dateKey) {
  if (!dateKey) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function parseColor(input) {
  const color = typeof input === "string" ? input.trim() : "";
  if (!color) return null;
  const hex = color.startsWith("#") ? color.slice(1) : "";
  if (hex.length === 3) {
    const [r, g, b] = hex.split("");
    return {
      r: Number.parseInt(`${r}${r}`, 16),
      g: Number.parseInt(`${g}${g}`, 16),
      b: Number.parseInt(`${b}${b}`, 16),
    };
  }
  if (hex.length === 6) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }
  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) return null;
  const [r, g, b] = rgbMatch[1]
    .split(",")
    .slice(0, 3)
    .map((value) => Number.parseFloat(value.trim()));
  if (![r, g, b].every(Number.isFinite)) return null;
  return { r, g, b };
}

function toRgbString({ r, g, b }, alpha = 1) {
  const safeR = Math.max(0, Math.min(255, Math.round(r)));
  const safeG = Math.max(0, Math.min(255, Math.round(g)));
  const safeB = Math.max(0, Math.min(255, Math.round(b)));
  if (alpha >= 1) return `rgb(${safeR}, ${safeG}, ${safeB})`;
  return `rgba(${safeR}, ${safeG}, ${safeB}, ${alpha})`;
}

function mixWithWhite(color, amount = 0.22) {
  const parsed = parseColor(color);
  if (!parsed) return "#87eeff";
  return toRgbString({
    r: parsed.r + ((255 - parsed.r) * amount),
    g: parsed.g + ((255 - parsed.g) * amount),
    b: parsed.b + ((255 - parsed.b) * amount),
  });
}

function resolveChartPalette(color) {
  const stroke = mixWithWhite(color, 0.22);
  const glow = mixWithWhite(color, 0.44);
  const parsedStroke = parseColor(stroke) || { r: 135, g: 238, b: 255 };
  return {
    stroke,
    glow,
    fillStrong: toRgbString(parsedStroke, 0.26),
    fillSoft: toRgbString(parsedStroke, 0.05),
    pointFill: toRgbString(parsedStroke, 1),
    pointHalo: toRgbString(parsedStroke, 0.24),
  };
}

export default function DisciplineTrendChart({ trend, color = "#6EE7FF", animated = true }) {
  const gradientId = useId();
  const chart = useMemo(() => buildDisciplineTrendChartGeometry(trend?.series || []), [trend?.series]);
  const palette = useMemo(() => resolveChartPalette(color), [color]);
  const geometry = chart.geometry;
  const firstLabel = trend?.series?.[0]?.dateKey ? formatShortDateLabel(trend.series[0].dateKey) : "";
  const lastLabel = trend?.series?.length ? formatShortDateLabel(trend.series[trend.series.length - 1].dateKey) : "";
  const summaryParts = [];
  if (Number.isFinite(trend?.summary?.currentScore)) summaryParts.push(`Dernier score ${trend.summary.currentScore}%`);
  if (typeof trend?.summary?.trendLabel === "string" && trend.summary.trendLabel) summaryParts.push(trend.summary.trendLabel);
  if (Number.isFinite(trend?.summary?.scoredDays)) {
    summaryParts.push(`${trend.summary.scoredDays} jour${trend.summary.scoredDays > 1 ? "s" : ""} scoré${trend.summary.scoredDays > 1 ? "s" : ""}`);
  }

  if (chart.isEmpty) {
    return (
      <div className="pilotageTrendChart pilotageTrendChart--empty">
        <div className="pilotageTrendState small2 textMuted">Aucune action prévue sur cette période.</div>
      </div>
    );
  }

  const rootClassName = [
    "pilotageTrendChart",
    animated ? "is-animated" : "",
    chart.hasSingleScoredPoint ? "pilotageTrendChart--single" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        role="img"
        aria-label="Évolution discipline"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={palette.fillStrong} />
            <stop offset="100%" stopColor={palette.fillSoft} />
          </linearGradient>
        </defs>
        <line
          x1={geometry.paddingLeft}
          y1={geometry.paddingTop}
          x2={geometry.paddingLeft}
          y2={geometry.height - geometry.paddingBottom}
          className="pilotageTrendAxis"
        />
        <line
          x1={geometry.paddingLeft}
          y1={geometry.height - geometry.paddingBottom}
          x2={geometry.width - geometry.paddingRight}
          y2={geometry.height - geometry.paddingBottom}
          className="pilotageTrendAxis"
        />
        <line
          x1={geometry.paddingLeft}
          y1={geometry.paddingTop}
          x2={geometry.width - geometry.paddingRight}
          y2={geometry.paddingTop}
          className="pilotageTrendGuide"
        />
        <line
          x1={geometry.paddingLeft}
          y1={(geometry.paddingTop + geometry.height - geometry.paddingBottom) / 2}
          x2={geometry.width - geometry.paddingRight}
          y2={(geometry.paddingTop + geometry.height - geometry.paddingBottom) / 2}
          className="pilotageTrendGuide"
        />
        {chart.areaPathD ? (
          <path d={chart.areaPathD} fill={`url(#${gradientId})`} className="pilotageTrendArea" />
        ) : null}
        {chart.linePathD ? (
          <>
            <path
              d={chart.linePathD}
              fill="none"
              stroke={palette.glow}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pilotageTrendLineGlow"
            />
            <path
              d={chart.linePathD}
              fill="none"
              stroke={palette.stroke}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              className="pilotageTrendLine"
            />
          </>
        ) : null}
        {chart.neutralPoints.map((point) => (
          <circle
            key={`neutral-${point.dateKey}`}
            cx={point.x}
            cy={geometry.height - geometry.paddingBottom}
            r="3"
            className="pilotageTrendNeutralPoint"
          />
        ))}
        {chart.scoredPoints.map((point, index) => (
          <g
            key={point.dateKey}
            className="pilotageTrendPointGroup"
            style={{ "--pilotage-point-delay": `${Math.min(index * 80, 280)}ms` }}
          >
            <circle cx={point.x} cy={point.y} r="7" fill={palette.pointHalo} className="pilotageTrendPointHalo" />
            <circle cx={point.x} cy={point.y} r="4.2" fill={palette.pointFill} className="pilotageTrendPoint" />
          </g>
        ))}
        {chart.hasSingleScoredPoint && chart.lastScoredPoint ? (
          <text
            x={chart.lastScoredPoint.x}
            y={Math.max(chart.lastScoredPoint.y - 12, geometry.paddingTop + 8)}
            textAnchor="middle"
            className="pilotageTrendSingleLabel"
          >
            1 seul jour scoré
          </text>
        ) : null}
        <text x={geometry.paddingLeft} y={geometry.paddingTop - 6} className="pilotageTrendAxisLabel">100</text>
        <text x={geometry.paddingLeft} y={geometry.height - geometry.paddingBottom + 16} className="pilotageTrendAxisLabel">0</text>
      </svg>
      {summaryParts.length ? <div className="pilotageTrendSummary">{summaryParts.join(" • ")}</div> : null}
      {chart.hasSingleScoredPoint ? (
        <div className="pilotageTrendState small2 textMuted">
          Une seule journée scorée sur cette fenêtre. Planifie encore 1 ou 2 blocs pour lire une vraie courbe.
        </div>
      ) : null}
      <div className="pilotageTrendAxisFooter">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}
