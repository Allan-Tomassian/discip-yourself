import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "./UI";

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
    const viewportW = window.innerWidth || 0;
    const viewportH = window.innerHeight || 0;
    const menuW = panelRect?.width || 220;
    const menuH = panelRect?.height || 180;
    const anchor = anchorRect || { top: 56, left: viewportW - 56, right: viewportW - 16, bottom: 56 };
    const shouldDropUp = anchor.bottom + menuH + 10 > viewportH && anchor.top - menuH - 10 > 8;
    const top = shouldDropUp
      ? Math.max(8, anchor.top - menuH - 10)
      : Math.min(viewportH - menuH - 8, anchor.bottom + 10);
    let left = anchor.right - menuW;
    left = Math.max(8, Math.min(left, viewportW - menuW - 8));
    return {
      left,
      top,
      origin: shouldDropUp ? "bottom right" : "top right",
    };
  }, [anchorRect, panelRect]);

  if (!open) return null;

  return (
    <div
      className="plusExpander isOpen"
      style={{ left: position.left, top: position.top, transformOrigin: position.origin }}
    >
      <div className="plusExpanderPanel" ref={panelRef} role="menu" aria-label="Créer">
        <div className="stack stackGap8">
          <Button onClick={onChooseObjective}>
            Créer un objectif
          </Button>
          <Button variant="ghost" onClick={onChooseAction}>
            Créer une action
          </Button>
          {hasDraft && typeof onResumeDraft === "function" ? (
            <Button variant="ghost" onClick={onResumeDraft}>
              Reprendre
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
