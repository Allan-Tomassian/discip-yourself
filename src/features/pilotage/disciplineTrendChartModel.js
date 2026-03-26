const DEFAULT_GEOMETRY = {
  width: 360,
  height: 196,
  paddingTop: 22,
  paddingRight: 20,
  paddingBottom: 26,
  paddingLeft: 28,
};

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function sanitizeScore(score) {
  const safeScore = toFiniteNumber(score);
  if (safeScore == null) return null;
  return clamp(safeScore, 0, 100);
}

function buildX(index, totalCount, geometry) {
  const drawableWidth = Math.max(geometry.width - geometry.paddingLeft - geometry.paddingRight, 0);
  return geometry.paddingLeft + (drawableWidth * index) / Math.max(totalCount - 1, 1);
}

function buildY(score, geometry) {
  const drawableHeight = Math.max(geometry.height - geometry.paddingTop - geometry.paddingBottom, 0);
  return geometry.height - geometry.paddingBottom - ((score / 100) * drawableHeight);
}

function formatCoord(value) {
  return Number.parseFloat(value.toFixed(2));
}

function buildStraightPath(points) {
  if (points.length < 2) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${formatCoord(point.x)} ${formatCoord(point.y)}`)
    .join(" ");
}

function buildSmoothPath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) return buildStraightPath(points);

  let path = `M ${formatCoord(points[0].x)} ${formatCoord(points[0].y)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] || next;
    const controlPoint1X = current.x + ((next.x - previous.x) / 6);
    const controlPoint1Y = current.y + ((next.y - previous.y) / 6);
    const controlPoint2X = next.x - ((afterNext.x - current.x) / 6);
    const controlPoint2Y = next.y - ((afterNext.y - current.y) / 6);
    path += ` C ${formatCoord(controlPoint1X)} ${formatCoord(controlPoint1Y)} ${formatCoord(controlPoint2X)} ${formatCoord(controlPoint2Y)} ${formatCoord(next.x)} ${formatCoord(next.y)}`;
  }
  return path;
}

function buildAreaPath(points, linePathD, geometry) {
  if (points.length < 2 || !linePathD) return "";
  const baselineY = formatCoord(geometry.height - geometry.paddingBottom);
  const firstX = formatCoord(points[0].x);
  const lastX = formatCoord(points[points.length - 1].x);
  return `${linePathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
}

export function buildDisciplineTrendChartGeometry(series, geometryOverrides = {}) {
  const geometry = { ...DEFAULT_GEOMETRY, ...(geometryOverrides || {}) };
  const safeSeries = Array.isArray(series) ? series : [];
  const totalCount = safeSeries.length;
  const baselineY = formatCoord(geometry.height - geometry.paddingBottom);

  const points = safeSeries.map((entry, index) => {
    const safeScore = sanitizeScore(entry?.score);
    const x = buildX(index, totalCount, geometry);
    const y = safeScore == null ? baselineY : buildY(safeScore, geometry);
    return {
      dateKey: typeof entry?.dateKey === "string" ? entry.dateKey : "",
      score: safeScore,
      isNeutral: Boolean(entry?.isNeutral),
      expected: Number.isFinite(entry?.expected) ? entry.expected : 0,
      done: Number.isFinite(entry?.done) ? entry.done : 0,
      index,
      x: formatCoord(x),
      y: formatCoord(y),
    };
  });

  const scoredPoints = points.filter((point) => point.score != null);
  const neutralPoints = points.filter((point) => point.isNeutral);
  const hasDrawableLine = scoredPoints.length >= 2;
  const hasSingleScoredPoint = scoredPoints.length === 1;
  const lastScoredPoint = scoredPoints.at(-1) || null;
  const isEmpty = scoredPoints.length === 0;
  const linePathD = hasDrawableLine ? buildSmoothPath(scoredPoints) : "";
  const areaPathD = hasDrawableLine ? buildAreaPath(scoredPoints, linePathD, geometry) : "";

  return {
    geometry,
    points,
    scoredPoints,
    neutralPoints,
    linePathD,
    areaPathD,
    baselineY,
    hasDrawableLine,
    hasSingleScoredPoint,
    lastScoredPoint,
    isEmpty,
  };
}
