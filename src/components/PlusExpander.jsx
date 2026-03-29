import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Portal from "../ui/portal/Portal";
import { LABELS } from "../ui/labels";
import { GateButton } from "../shared/ui/gate/Gate";

function toAnchorRect(rect) {
  if (!rect) return null;
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export default function PlusExpander({
  open,
  anchorRect,
  anchorEl,
  onClose,
  onChooseObjective,
  onChooseAction,
  onChooseStructuring,
  onResumeDraft,
  hasDraft = false,
}) {
  const panelRef = useRef(null);
  const [panelRect, setPanelRect] = useState(null);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    setPanelRect(toAnchorRect(panelRef.current.getBoundingClientRect()));
  }, [open, hasDraft]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && typeof onClose === "function") onClose();
    };
    const handlePointerDown = (event) => {
      if (panelRef.current && panelRef.current.contains(event.target)) return;
      if (anchorEl && anchorEl.contains && anchorEl.contains(event.target)) return;
      if (typeof onClose === "function") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open, onClose, anchorEl]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const firstButton = panelRef.current.querySelector("button");
    if (firstButton && typeof firstButton.focus === "function") firstButton.focus();
  }, [open, hasDraft]);

  const position = useMemo(() => {
    if (typeof window === "undefined") return { left: 16, top: 72, origin: "top right" };
    const vv = window.visualViewport;
    const viewportW = vv?.width || window.innerWidth || 0;
    const viewportH = vv?.height || window.innerHeight || 0;
    const styles = window.getComputedStyle(document.documentElement);
    const pagePad = Number.parseFloat(styles.getPropertyValue("--page-pad")) || 16;
    const safeLeft = Number.parseFloat(styles.getPropertyValue("--safe-left")) || 0;
    const safeRight = Number.parseFloat(styles.getPropertyValue("--safe-right")) || 0;
    const safeTop = Number.parseFloat(styles.getPropertyValue("--safe-top")) || 0;
    const minMargin = Math.max(8, pagePad + Math.max(safeLeft, safeRight));
    const menuW = panelRect?.width || 220;
    const menuH = panelRect?.height || 180;
    const anchor = anchorRect || { top: 56, left: viewportW - 56, right: viewportW - minMargin, bottom: 56 };
    const shouldDropUp = anchor.bottom + menuH + 10 > viewportH && anchor.top - menuH - 10 > minMargin;
    const top = shouldDropUp
      ? Math.max(minMargin, anchor.top - menuH - 10)
      : Math.min(viewportH - menuH - Math.max(minMargin, safeTop), anchor.bottom + 10);
    let left = anchor.right - menuW;
    left = Math.max(minMargin, Math.min(left, viewportW - menuW - minMargin));
    return {
      left,
      top,
      origin: shouldDropUp ? "bottom right" : "top right",
    };
  }, [anchorRect, panelRect]);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="plusExpander isOpen"
        style={{ left: position.left, top: position.top, transformOrigin: position.origin }}
      >
        <div className="plusExpanderPanel GateGlassOuter">
          <div className="plusExpanderPanelClip GateGlassClip GateGlassBackdrop">
            <div className="plusExpanderPanelContent GateGlassContent" ref={panelRef} role="menu" aria-label="Créer">
              <div className="stack stackGap8">
                <GateButton className="GatePressable" onClick={onChooseAction}>
                  Action rapide
                </GateButton>
                <GateButton variant="ghost" className="GatePressable" onClick={onChooseObjective}>
                  {LABELS.goal}
                </GateButton>
                {typeof onChooseStructuring === "function" ? (
                  <GateButton variant="ghost" className="GatePressable" onClick={onChooseStructuring}>
                    Structurer avec le Coach
                  </GateButton>
                ) : null}
                {hasDraft && typeof onResumeDraft === "function" ? (
                  <GateButton variant="ghost" className="GatePressable" onClick={onResumeDraft}>
                    Reprendre
                  </GateButton>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
