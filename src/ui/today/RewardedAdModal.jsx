import React, { useEffect, useRef, useState } from "react";
import { GateHeader } from "../../shared/ui/gate/Gate";
import { AppSheet, GhostButton, PrimaryButton } from "../../shared/ui/app";

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

  return (
    <AppSheet
      open={open}
      onClose={({ reason }) => close(reason || "backdrop")}
      className="microAdSheet"
      maxWidth={420}
    >
      <div className="microAdPanel" data-testid="rewarded-ad-modal">
        <GateHeader
          title="Vidéo sponsorisée"
          subtitle={`Placement: ${placement}`}
          className="microAdHeader"
        />
        <p className="microAdText">
          Simule une vidéo courte pour recevoir ta récompense.
        </p>
        <div className="microAdActions GatePrimaryCtaRow">
          <PrimaryButton
            type="button"
            withSound
            onClick={startVideo}
            disabled={running}
            data-testid="rewarded-ad-complete"
          >
            {running ? "Lecture..." : "Simuler fin de vidéo (3s)"}
          </PrimaryButton>
          <GhostButton
            type="button"
            withSound
            onClick={() => close("dismissed")}
            disabled={running}
            data-testid="rewarded-ad-close"
          >
            Fermer
          </GhostButton>
        </div>
      </div>
    </AppSheet>
  );
}
