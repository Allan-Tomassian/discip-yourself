import React from "react";

const LOT2_STEPS = Object.freeze([
  { id: "intro", index: 1, label: "Intro", description: "Point de départ" },
  { id: "why", index: 2, label: "Pourquoi", description: "Raison profonde" },
  { id: "signals", index: 3, label: "Signaux", description: "Structure utile" },
]);

export default function FirstRunProgressRail({ activeStep = "intro" }) {
  const activeIndex = LOT2_STEPS.findIndex((step) => step.id === activeStep);

  return (
    <nav className="firstRunProgressRail" aria-label="Progression first-run">
      {LOT2_STEPS.map((step, index) => {
        const stateClass =
          index < activeIndex ? "is-complete"
          : index === activeIndex ? "is-active"
          : "is-upcoming";
        return (
          <div key={step.id} className={`firstRunProgressStep ${stateClass}`}>
            <span className="firstRunProgressIndex">{step.index}</span>
            <span className="firstRunProgressText">
              <span className="firstRunProgressLabel">{step.label}</span>
              <span className="firstRunProgressDescription">{step.description}</span>
            </span>
          </div>
        );
      })}
    </nav>
  );
}
