const DEFAULT_MAX_MENU_WIDTH = 360;
const VIEWPORT_MARGIN = 8;

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function computeSelectPosition({
  rect,
  menuRect,
  viewport,
  minMargin = VIEWPORT_MARGIN,
  preferredWidth = 0,
  minWidth: requestedMinWidth = 0,
  maxWidth: requestedMaxWidth = DEFAULT_MAX_MENU_WIDTH,
} = {}) {
  const safeRect = rect || {};
  const safeMenuRect = menuRect || {};
  const viewportW = Math.round(viewport?.width || 0);
  const viewportH = Math.round(viewport?.height || 0);
  const anchorWidth = Math.round(safeRect.width || 0);
  const measuredWidth = Math.round(safeMenuRect.width || 0);
  const popoverHeight = Math.round(safeMenuRect.height || 0);

  const viewportMaxWidth = Math.max(0, viewportW - minMargin * 2);
  const requestedMax = toPositiveNumber(requestedMaxWidth) || DEFAULT_MAX_MENU_WIDTH;
  const maxWidth = Math.min(requestedMax, viewportMaxWidth || requestedMax);
  const preferred = Math.round(toPositiveNumber(preferredWidth));
  const requestedMin = Math.round(toPositiveNumber(requestedMinWidth));
  const baseWidth = preferred || anchorWidth || measuredWidth || maxWidth || 0;
  const resolvedMin = requestedMin ? Math.min(requestedMin, maxWidth || requestedMin) : 0;
  const menuWidth = Math.min(Math.max(baseWidth, resolvedMin), maxWidth || Math.max(baseWidth, resolvedMin));

  let left = Math.round(safeRect.left || 0);
  const rectRight = Number.isFinite(safeRect.right) ? safeRect.right : left + menuWidth;
  if (left + menuWidth > viewportW - minMargin) {
    left = Math.round(rectRight - menuWidth);
  }
  left = Math.max(minMargin, Math.min(left, viewportW - menuWidth - minMargin));

  let top = Math.round(safeRect.bottom || 0);
  if (popoverHeight && top + popoverHeight > viewportH - minMargin) {
    const rectTop = Number.isFinite(safeRect.top) ? safeRect.top : top;
    const flipped = Math.round(rectTop - popoverHeight);
    if (flipped >= minMargin) top = flipped;
  }
  top = Math.max(minMargin, Math.min(top, viewportH - popoverHeight - minMargin));

  return { top, left, width: menuWidth, minWidth: menuWidth, maxWidth };
}
