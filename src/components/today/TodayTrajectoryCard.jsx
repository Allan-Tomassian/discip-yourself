import React from "react";
import { AlertTriangle, CheckCircle2, Clock3, TrendingUp } from "lucide-react";
import CommandSurface from "./CommandSurface";

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function pluralize(label, count) {
  return Number(count) > 1 ? `${label}s` : label;
}

function buildSmoothPath(points) {
  if (!points.length) return "";
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const clampY = (value) => Math.max(minY, Math.min(maxY, value));
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const beforePrevious = points[index - 2] || previous;
    const next = points[index + 1] || point;
    const controlOneX = previous.x + (point.x - beforePrevious.x) / 6;
    const controlOneY = clampY(previous.y + (point.y - beforePrevious.y) / 6);
    const controlTwoX = point.x - (next.x - previous.x) / 6;
    const controlTwoY = clampY(point.y - (next.y - previous.y) / 6);
    return `${path} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${point.x} ${point.y}`;
  }, "");
}

function pickFrictionMarker(points) {
  const frictionPoints = points.filter((point) => Number(point.frictionCount) > 0 || point.hasFriction);
  if (!frictionPoints.length) return null;
  const current = frictionPoints.find((point) => point.isCurrent);
  if (current) return current;
  return frictionPoints.reduce((selected, point) => {
    if (!selected) return point;
    if (Number(point.frictionCount || 0) > Number(selected.frictionCount || 0)) return point;
    return point.x > selected.x ? point : selected;
  }, null);
}

export default function TodayTrajectoryCard({
  state = "neutral",
  tone = "neutral",
  motionIntensity = "normal",
  trajectory = {},
}) {
  const days = Array.isArray(trajectory.days) && trajectory.days.length
    ? trajectory.days.slice(0, 7)
    : Array.from({ length: 7 }, (_, index) => ({
        id: `empty-${index}`,
        label: "",
        completionPercent: 0,
        frictionCount: 0,
        isCurrent: index === 6,
      }));
  const width = 320;
  const height = 150;
  const chartLeft = 34;
  const chartRight = 302;
  const chartTop = 14;
  const chartBottom = 112;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const points = days.map((day, index) => {
    const denominator = Math.max(1, days.length - 1);
    const percent = clampPercent(day.completionPercent);
    return {
      ...day,
      x: chartLeft + (chartWidth * index) / denominator,
      y: chartBottom - (chartHeight * percent) / 100,
      percent,
    };
  });
  const linePath = buildSmoothPath(points);
  const fillPath = linePath ? `${linePath} L ${points[points.length - 1].x} ${chartBottom} L ${points[0].x} ${chartBottom} Z` : "";
  const currentPoint = points.find((point) => point.isCurrent) || points[points.length - 1];
  const todayLabelWidth = 84;
  const todayLabelCenterX = currentPoint
    ? Math.min(Math.max(todayLabelWidth / 2 + 6, currentPoint.x), width - todayLabelWidth / 2 - 6)
    : 0;
  const completedBlocks = Number.isFinite(trajectory.completedBlocks) ? Math.max(0, trajectory.completedBlocks) : 0;
  const frictionCount = Number.isFinite(trajectory.todayFrictionCount) ? Math.max(0, trajectory.todayFrictionCount) : 0;
  const remainingMinutes = Number.isFinite(trajectory.remainingMinutesToday) ? Math.max(0, trajectory.remainingMinutesToday) : 0;
  const frictionMarker = pickFrictionMarker(points);
  const trajectoryMessage = frictionCount > 0
    ? "Une friction demande un ajustement."
    : "Ton système avance aujourd’hui.";
  const className = [
    "todayTrajectoryCard",
    state ? `today-state-${state}` : "",
    tone ? `today-tone-${tone}` : "",
    motionIntensity ? `today-motion-${motionIntensity}` : "",
  ].filter(Boolean).join(" ");

  return (
    <CommandSurface className={className} tone="execution" data-testid="today-trajectory-card" data-tour-id="today-trajectory-card">
      <div className="todayTrajectoryHeader">
        <span className="todayTrajectoryIcon" aria-hidden="true">
          <TrendingUp size={26} strokeWidth={2.2} />
        </span>
        <div className="todayTrajectoryTitleBlock">
          <h2>Trajectoire du jour</h2>
          <p><span aria-hidden="true" />Vue 7 derniers jours</p>
        </div>
      </div>

      <div className="todayTrajectoryCopy">
        <span>{trajectoryMessage}</span>
      </div>

      <div className="todayTrajectoryChart" aria-label="Trajectoire d’exécution sur les sept derniers jours">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" focusable="false" aria-hidden="true">
          <defs>
            <linearGradient id="todayTrajectoryLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3dff89" />
              <stop offset="64%" stopColor="#28ec73" />
              <stop offset="100%" stopColor="#b4ffd0" />
            </linearGradient>
            <linearGradient id="todayTrajectoryFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(53, 240, 109, 0.32)" />
              <stop offset="100%" stopColor="rgba(53, 240, 109, 0)" />
            </linearGradient>
            <filter id="todayTrajectoryGlow" x="-18%" y="-42%" width="136%" height="184%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = chartBottom - (chartHeight * tick) / 100;
            return (
              <g key={tick} className="todayTrajectoryGridLine">
                <text x="4" y={y + 4}>{tick}%</text>
                <line x1={chartLeft} y1={y} x2={chartRight} y2={y} />
              </g>
            );
          })}
          {points.map((point) => (
            <line key={`v-${point.id}`} className="todayTrajectoryVerticalGrid" x1={point.x} y1={chartTop} x2={point.x} y2={chartBottom} />
          ))}
          <line className="todayTrajectoryAxis" x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} />
          {fillPath ? <path className="todayTrajectoryFill" d={fillPath} /> : null}
          {linePath ? <path className="todayTrajectoryPath todayTrajectoryPathGlow" d={linePath} /> : null}
          {linePath ? <path className="todayTrajectoryPath" d={linePath} /> : null}
          {points.map((point) => (
            <g key={point.id}>
              {frictionMarker?.id === point.id ? (
                <g className="todayTrajectoryFrictionMarker">
                  <line x1={point.x} y1={point.y - 14} x2={point.x} y2={chartBottom} />
                  <circle cx={point.x} cy={point.y} r="4.6" />
                  <text x={point.x} y={point.y - 10}>!</text>
                </g>
              ) : null}
              <circle className={`todayTrajectoryPoint${point.isCurrent ? " is-current" : ""}`} cx={point.x} cy={point.y} r={point.isCurrent ? 7 : 4.6} />
              <text className={`todayTrajectoryDayLabel${point.isCurrent ? " is-current" : ""}`} x={point.x} y="140">{point.label}</text>
            </g>
          ))}
          {currentPoint ? (
            <g className="todayTrajectoryTodayMarker">
              <line x1={currentPoint.x} y1={chartTop - 3} x2={currentPoint.x} y2={chartBottom + 2} />
              <rect x={todayLabelCenterX - todayLabelWidth / 2} y="0" width={todayLabelWidth} height="26" rx="10" />
              <text x={todayLabelCenterX} y="17">Aujourd’hui</text>
            </g>
          ) : null}
        </svg>
      </div>

      <div className="todayTrajectoryStats" aria-label="Résumé du jour">
        <span>
          <CheckCircle2 size={18} strokeWidth={2.1} aria-hidden="true" />
          <strong>{completedBlocks}</strong>
          <em>{pluralize("Bloc terminé", completedBlocks)}</em>
        </span>
        <span>
          <AlertTriangle size={18} strokeWidth={2.1} aria-hidden="true" />
          <strong>{frictionCount}</strong>
          <em>{pluralize("Friction", frictionCount)}</em>
        </span>
        <span>
          <Clock3 size={18} strokeWidth={2.1} aria-hidden="true" />
          <strong>{remainingMinutes}<small> min</small></strong>
          <em>Restantes</em>
        </span>
      </div>
    </CommandSurface>
  );
}
