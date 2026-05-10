import React from "react";
import { ShieldCheck } from "lucide-react";
import { AppScreen } from "../../shared/ui/app";
import FirstRunNarrativeBackdrop from "./FirstRunNarrativeBackdrop";
import FirstRunProgressRail from "./FirstRunProgressRail";
import "./firstRun.css";

export default function FirstRunCommandSurface({
  data,
  testId,
  activeStep,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  className = "",
  bodyClassName = "",
}) {
  return (
    <AppScreen data={data} pageId="onboarding" className="firstRunNarrativeScreen">
      <FirstRunNarrativeBackdrop />

      <div className="firstRunNarrativeViewport">
        <FirstRunProgressRail activeStep={activeStep} />

        <section
          className={["firstRunCommandSurface", className].filter(Boolean).join(" ")}
          data-testid={testId}
        >
          <div className="firstRunCommandAura" aria-hidden="true" />

          <div className="firstRunCommandBrand" aria-label="Discip Yourself">
            <span className="firstRunCommandBrandMark" aria-hidden="true">
              <span />
            </span>
            <span className="firstRunCommandBrandText">
              <strong>Discip Yourself</strong>
              <span>Premium discipline command system</span>
            </span>
          </div>

          <header className="firstRunCommandHeader">
            {eyebrow ? <div className="firstRunCommandEyebrow">{eyebrow}</div> : null}
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </header>

          <div className={["firstRunCommandBody", bodyClassName].filter(Boolean).join(" ")}>
            {children}
          </div>

          {footer ? <footer className="firstRunCommandFooter">{footer}</footer> : null}
        </section>

        <div className="firstRunSecurityStrip" aria-label="Système sécurisé">
          <ShieldCheck size={18} strokeWidth={1.9} aria-hidden="true" />
          <span>
            <strong>Système sécurisé</strong>
            <span>Ton système sera créé à partir de ce que tu es. 100% privé.</span>
          </span>
        </div>
      </div>
    </AppScreen>
  );
}
