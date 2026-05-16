import React from "react";

const LOT2_STEPS = Object.freeze([
  { id: "intro", index: 1, label: "Intro", description: "Point de départ" },
  { id: "why", index: 2, label: "Pourquoi", description: "Raison profonde" },
  { id: "signals", index: 3, label: "Signaux", description: "Structure utile" },
]);

const ACTIVATION_STEPS = Object.freeze([
  { id: "generate", index: 4, label: "Générer", description: "Préparer" },
  { id: "compare", index: 5, label: "Plan", description: "Revoir" },
  { id: "commit", index: 6, label: "Activer", description: "Déployer" },
  { id: "discovery", index: 7, label: "Découverte", description: "Explorer" },
  { id: "today", index: 8, label: "Today", description: "Cockpit" },
]);

export default function FirstRunProgressRail({ activeStep = "intro", mode = "foundation" }) {
  const steps = mode === "activation" ? ACTIVATION_STEPS : LOT2_STEPS;
  const activeIndex = steps.findIndex((step) => step.id === activeStep);
  const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <nav className={`firstRunProgressRail firstRunProgressRail--${mode}`} aria-label="Progression first-run">
      {steps.map((step, index) => {
        const stateClass =
          index < resolvedActiveIndex ? "is-complete"
          : index === resolvedActiveIndex ? "is-active"
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
