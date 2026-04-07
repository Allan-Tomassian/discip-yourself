const MAX_MENU_WIDTH = 360;
const VIEWPORT_MARGIN = 8;

export function computeSelectPosition({ rect, menuRect, viewport, minMargin = VIEWPORT_MARGIN }) {
  const safeRect = rect || {};
  const safeMenuRect = menuRect || {};
  const viewportW = Math.round(viewport?.width || 0);
  const viewportH = Math.round(viewport?.height || 0);
  const anchorWidth = Math.round(safeRect.width || 0);
  const measuredWidth = Math.round(safeMenuRect.width || 0);
  const popoverHeight = Math.round(safeMenuRect.height || 0);

  const viewportMaxWidth = Math.max(0, viewportW - minMargin * 2);
  const maxWidth = Math.min(MAX_MENU_WIDTH, viewportMaxWidth || MAX_MENU_WIDTH);
  const baseWidth = anchorWidth || measuredWidth || maxWidth || 0;
  const minWidth = Math.min(baseWidth, maxWidth || baseWidth);

  let left = Math.round(safeRect.left || 0);
  const rectRight = Number.isFinite(safeRect.right) ? safeRect.right : left + minWidth;
  if (left + minWidth > viewportW - minMargin) {
    left = Math.round(rectRight - minWidth);
  }
  left = Math.max(minMargin, Math.min(left, viewportW - minWidth - minMargin));

  let top = Math.round(safeRect.bottom || 0);
  if (popoverHeight && top + popoverHeight > viewportH - minMargin) {
    const rectTop = Number.isFinite(safeRect.top) ? safeRect.top : top;
    const flipped = Math.round(rectTop - popoverHeight);
    if (flipped >= minMargin) top = flipped;
  }
  top = Math.max(minMargin, Math.min(top, viewportH - popoverHeight - minMargin));

  return { top, left, width: minWidth, minWidth, maxWidth };
}
