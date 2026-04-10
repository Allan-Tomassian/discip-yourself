import React, { useEffect, useRef } from "react";
import { GatePanel } from "./Gate";
import "../overlays/overlays.css";

function isDesktopLikeInput() {
  try {
    return Boolean(window?.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches);
  } catch {
    return false;
  }
}

export default function GateDialog({
  open,
  onClose,
  children,
  className = "",
  maxWidth = 520,
  placement = "center",
}) {
  const panelRef = useRef(null);
  const prevOverflowRef = useRef("");

  useEffect(() => {
    if (!open) return undefined;
    if (!isDesktopLikeInput()) return undefined;

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.({ reason: "escape", event });
    }

    const timer = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = root.querySelector(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      focusable?.focus?.();
    }, 0);

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const body = document.body;
    prevOverflowRef.current = body.style.overflow || "";
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflowRef.current;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`modalBackdrop GateOverlayBackdrop${placement === "bottom" ? " modalBackdrop--bottom" : ""}`}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        onClose?.({ reason: "backdrop", event });
      }}
      role="presentation"
    >
      <div
        className={`modalPanelOuter GateGlassOuter${placement === "bottom" ? " modalPanelOuter--bottom" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalPanelClip GateGlassClip GateGlassBackdrop">
          <GatePanel
            ref={panelRef}
            className={`modalPanel GateGlassContent GateSurfacePremium GateCardPremium${placement === "bottom" ? " modalPanel--bottom" : ""}${className ? ` ${className}` : ""}`}
            role="dialog"
            aria-modal="true"
            style={{ width: `min(${maxWidth}px, calc(100vw - (2 * var(--page-pad)) - var(--safe-left) - var(--safe-right)))` }}
          >
            {children}
          </GatePanel>
        </div>
      </div>
    </div>
  );
}
