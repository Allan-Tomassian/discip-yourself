import React, { useEffect } from "react";
import { createPortal } from "react-dom";

const MICRO_DURATION_MS = 900;
const RICH_DURATION_MS = 2800;

export default function TotemAnimationOverlay({
  open,
  variant = "micro",
  amount = 0,
  bodyColor = "#F59E0B",
  accessory = "",
  onDone,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const timeout = window.setTimeout(() => {
      onDone?.();
    }, variant === "rich" ? RICH_DURATION_MS : MICRO_DURATION_MS);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [onDone, open, variant]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={`totemAnimOverlay totemAnimOverlay--${variant}`} aria-hidden="true">
      <div className="totemAnimScene">
        <span className="totemAnimCloud totemAnimCloud--a" />
        <span className="totemAnimCloud totemAnimCloud--b" />
        <span className="totemAnimBranch" />
        <div className="totemAnimEagle" style={{ "--totem-body-color": bodyColor }}>
          <span className="totemAnimEagleGlyph">🦅</span>
          {accessory ? <span className="totemAnimAccessory">{accessory}</span> : null}
        </div>
        <div className="totemAnimGain">+{Math.max(0, Number(amount) || 0)}</div>
      </div>
    </div>,
    document.body
  );
}
