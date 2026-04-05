import React, { useEffect, useMemo } from "react";

function resolveMenuStyle(anchorRect) {
  if (!anchorRect || typeof window === "undefined") {
    return { right: 24, bottom: 104 };
  }
  const width = 236;
  const top = Math.min(anchorRect.bottom + 10, window.innerHeight - 220);
  const left = Math.max(16, Math.min(anchorRect.right - width, window.innerWidth - width - 16));
  return { top, left };
}

export default function LovableCreateMenu({
  open = false,
  anchorRect = null,
  onClose,
  onChooseObjective,
  onChooseAction,
  onResumeDraft,
  hasDraft = false,
}) {
  const menuStyle = useMemo(() => resolveMenuStyle(anchorRect), [anchorRect]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="lovableMenuOverlay" role="presentation">
      <div className="lovableMenuBackdrop" onClick={() => onClose?.()} />
      <div className="lovableMenu" style={menuStyle} role="menu" aria-label="Create">
        <button type="button" className="lovableMenuButton" onClick={() => onChooseObjective?.()} role="menuitem">
          <span className="lovableMenuLabel">New objective</span>
          <span className="lovableMenuMeta">Outcome</span>
        </button>
        <button type="button" className="lovableMenuButton" onClick={() => onChooseAction?.()} role="menuitem">
          <span className="lovableMenuLabel">New action</span>
          <span className="lovableMenuMeta">Process</span>
        </button>
        {hasDraft ? (
          <button type="button" className="lovableMenuButton" onClick={() => onResumeDraft?.()} role="menuitem">
            <span className="lovableMenuLabel">Resume draft</span>
            <span className="lovableMenuMeta">Continue</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
