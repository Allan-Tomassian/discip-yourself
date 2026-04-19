import React from "react";
import { AppCard, AppScreen, AppStickyFooter, ScreenHeader, StatusBadge } from "../../shared/ui/app";
import "./firstRun.css";

export default function FirstRunStepScreen({
  data,
  testId,
  title,
  subtitle = "",
  eyebrow = "First run",
  badge = "",
  children,
  footer,
  bodyClassName = "",
}) {
  const resolvedBodyClassName = ["firstRunBody", bodyClassName].filter(Boolean).join(" ");

  return (
    <AppScreen data={data} pageId="onboarding" className="firstRunScreenShell">
      <AppCard variant="elevated" className="firstRunShell" data-testid={testId}>
        <ScreenHeader
          className="firstRunHeader"
          title={
            <span className="firstRunHeaderTitleBlock">
              <span className="firstRunHeaderEyebrow">{eyebrow}</span>
              <span className="firstRunHeaderTitle">{title}</span>
            </span>
          }
          subtitle={subtitle}
          actions={badge ? <StatusBadge className="firstRunHeaderBadge">{badge}</StatusBadge> : null}
        />

        <div className={resolvedBodyClassName}>{children}</div>

        {footer ? (
          <AppStickyFooter
            className="firstRunFooter"
            surfaceClassName="firstRunFooterSurface"
            actionsClassName="firstRunFooterActions"
          >
            {footer}
          </AppStickyFooter>
        ) : null}
      </AppCard>
    </AppScreen>
  );
}
