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
  progressMode = "foundation",
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  tone = "execution",
  securityTitle = "Système sécurisé",
  securityText = "Ton système sera créé à partir de ce que tu es. 100% privé.",
  className = "",
  bodyClassName = "",
}) {
  const screenClassName = ["firstRunNarrativeScreen", `firstRunNarrativeScreen--${tone}`].filter(Boolean).join(" ");
  const surfaceClassName = ["firstRunCommandSurface", `firstRunCommandSurface--tone-${tone}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <AppScreen data={data} pageId="onboarding" className={screenClassName}>
      <FirstRunNarrativeBackdrop />

      <div className="firstRunNarrativeViewport">
        <FirstRunProgressRail activeStep={activeStep} mode={progressMode} />

        <section
          className={surfaceClassName}
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
            <strong>{securityTitle}</strong>
            <span>{securityText}</span>
          </span>
        </div>
      </div>
    </AppScreen>
  );
}
