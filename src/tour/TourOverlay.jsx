import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card } from "../components/UI";

const VIEWPORT_PADDING = 12;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function TourOverlay({
  isActive,
  step,
  stepIndex,
  totalSteps,
  anchorEl: providedAnchor,
  onNext,
  onPrev,
  onSkip,
  disableNext = false,
}) {
  const tooltipRef = useRef(null);
  const [style, setStyle] = useState({ top: 0, left: 0, opacity: 0 });

  const anchorEl = providedAnchor || null;

  useLayoutEffect(() => {
    if (!isActive || !step || !anchorEl || !tooltipRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    const tipRect = tooltipRef.current.getBoundingClientRect();
    const placement = step.placement || "bottom";
    let top = 0;
    let left = 0;

    if (placement === "top") {
      top = rect.top - tipRect.height - VIEWPORT_PADDING;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
    } else if (placement === "left") {
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.left - tipRect.width - VIEWPORT_PADDING;
    } else if (placement === "right") {
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.right + VIEWPORT_PADDING;
    } else {
      top = rect.bottom + VIEWPORT_PADDING;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
    }

    const maxTop = window.innerHeight - tipRect.height - VIEWPORT_PADDING;
    const maxLeft = window.innerWidth - tipRect.width - VIEWPORT_PADDING;
    setStyle({
      top: clamp(top, VIEWPORT_PADDING, maxTop),
      left: clamp(left, VIEWPORT_PADDING, maxLeft),
      opacity: 1,
    });
  }, [isActive, step, anchorEl]);

  useEffect(() => {
    if (!isActive || !step || !anchorEl) return;
    const update = () => {
      if (!anchorEl || !tooltipRef.current) return;
      const rect = anchorEl.getBoundingClientRect();
      const tipRect = tooltipRef.current.getBoundingClientRect();
      const placement = step.placement || "bottom";
      let top = 0;
      let left = 0;
      if (placement === "top") {
        top = rect.top - tipRect.height - VIEWPORT_PADDING;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
      } else if (placement === "left") {
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.left - tipRect.width - VIEWPORT_PADDING;
      } else if (placement === "right") {
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.right + VIEWPORT_PADDING;
      } else {
        top = rect.bottom + VIEWPORT_PADDING;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
      }
      const maxTop = window.innerHeight - tipRect.height - VIEWPORT_PADDING;
      const maxLeft = window.innerWidth - tipRect.width - VIEWPORT_PADDING;
      setStyle({
        top: clamp(top, VIEWPORT_PADDING, maxTop),
        left: clamp(left, VIEWPORT_PADDING, maxLeft),
        opacity: 1,
      });
    };
    const handle = () => window.requestAnimationFrame(update);
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [isActive, step, anchorEl]);

  useEffect(() => {
    if (!isActive || !step?.autoAdvanceAfterMs) return;
    const id = window.setTimeout(() => {
      if (typeof onNext === "function") onNext();
    }, step.autoAdvanceAfterMs);
    return () => window.clearTimeout(id);
  }, [isActive, step, onNext]);

  if (!isActive || !step || typeof document === "undefined") return null;
  if (!anchorEl) return null;

  const isLast = stepIndex >= totalSteps - 1;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(0,0,0,0.45)",
        pointerEvents: "auto",
      }}
    >
      <div
        ref={tooltipRef}
        style={{
          position: "fixed",
          top: style.top,
          left: style.left,
          width: "min(92vw, 320px)",
          maxWidth: 320,
          opacity: style.opacity,
          transition: "opacity 120ms ease",
        }}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="titleSm">{step.title}</div>
              <div className="small2">{stepIndex + 1}/{totalSteps}</div>
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              {step.body}
            </div>
            {step.nextActionHint ? (
              <div className="small2" style={{ marginTop: 8, opacity: 0.8 }}>
                {step.nextActionHint}
              </div>
            ) : null}
            <div className="row" style={{ justifyContent: "space-between", marginTop: 12, gap: 8 }}>
              <Button variant="ghost" onClick={onSkip}>
                Passer
              </Button>
              <div className="row" style={{ gap: 8 }}>
                {stepIndex > 0 ? (
                  <Button variant="ghost" onClick={onPrev}>
                    Précédent
                  </Button>
                ) : null}
                <Button onClick={onNext} disabled={disableNext}>
                  {isLast ? "Terminer" : "Suivant"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>,
    document.body
  );
}
