export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function indexAtCenter({
  scrollLeft,
  containerWidth,
  paddingLeft = 0,
  paddingRight = 0,
  firstCenter,
  stride,
  count,
}) {
  if (!stride || count <= 0) return null;
  const effectiveW = containerWidth - paddingLeft - paddingRight;
  const centerX = scrollLeft + paddingLeft + effectiveW / 2;
  const rawIndex = Math.round((centerX - firstCenter) / stride);
  return clamp(rawIndex, 0, Math.max(0, count - 1));
}

export function targetScrollLeft({
  containerWidth,
  paddingLeft = 0,
  paddingRight = 0,
  firstCenter,
  stride,
  index,
}) {
  if (!stride) return null;
  const effectiveW = containerWidth - paddingLeft - paddingRight;
  const targetCenter = firstCenter + index * stride;
  return Math.max(0, targetCenter - (paddingLeft + effectiveW / 2));
}

export function computeTargetScrollLeftFromRects({
  scrollLeft,
  scrollerLeft,
  scrollerWidth,
  itemLeft,
  itemWidth,
}) {
  if (!scrollerWidth || !itemWidth) return null;
  const itemCenter = itemLeft - scrollerLeft + itemWidth / 2;
  const target = scrollLeft + itemCenter - scrollerWidth / 2;
  return Math.max(0, Math.round(target));
}

export function computeScrollPadding({ containerWidth, itemWidth }) {
  if (!containerWidth || !itemWidth) return 0;
  return Math.max(0, Math.round((containerWidth - itemWidth) / 2));
}
