import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GateButton, GateHeader, GatePanel } from "../../shared/ui/gate/Gate";

const REWARDED_AD_DURATION_MS = 3000;

export default function RewardedAdModal({ open, placement = "micro-actions", onComplete, onDismiss }) {
  const timeoutRef = useRef(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!open) {
      setRunning(false);
      return;
    }

    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (running) return;
      onDismiss?.({ reason: "escape" });
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onDismiss, running]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  if (!open || typeof document === "undefined") return null;

  const startVideo = () => {
    if (running) return;
    setRunning(true);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setRunning(false);
      onComplete?.();
    }, REWARDED_AD_DURATION_MS);
  };

  const close = (reason) => {
    if (running) return;
    onDismiss?.({ reason });
  };

  return createPortal(
    <div
      className="microAdBackdrop"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        close("backdrop");
      }}
      role="presentation"
    >
      <div
        className="microAdPanelOuter GateGlassOuter"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="microAdPanelClip GateGlassClip GateGlassBackdrop">
          <GatePanel
            className="microAdPanel GateGlassContent GateSurfacePremium GateCardPremium"
            role="dialog"
            aria-modal="true"
            aria-label="Vidéo sponsorisée"
            data-testid="rewarded-ad-modal"
          >
            <GateHeader
              title="Vidéo sponsorisée"
              subtitle={`Placement: ${placement}`}
              className="microAdHeader"
            />
            <p className="microAdText">
              Simule une vidéo courte pour recevoir ta récompense.
            </p>
            <div className="microAdActions GatePrimaryCtaRow">
              <GateButton
                type="button"
                className="GatePressable"
                withSound
                onClick={startVideo}
                disabled={running}
                data-testid="rewarded-ad-complete"
              >
                {running ? "Lecture..." : "Simuler fin de vidéo (3s)"}
              </GateButton>
              <GateButton
                type="button"
                variant="ghost"
                className="GatePressable"
                withSound
                onClick={() => close("dismissed")}
                disabled={running}
                data-testid="rewarded-ad-close"
              >
                Fermer
              </GateButton>
            </div>
          </GatePanel>
        </div>
      </div>
    </div>,
    document.body
  );
}
