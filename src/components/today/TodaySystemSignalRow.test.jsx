import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TodaySystemSignalRow from "./TodaySystemSignalRow";

const SURFACE = {
  severity: "attention",
  tone: "attention",
  title: "Surcharge détectée",
  message: "Allège avant de forcer l’exécution.",
  ctaLabel: "Ajuster",
  actionType: "open_adjust",
  signalId: "signal-1",
  signalType: "overload",
};

describe("TodaySystemSignalRow", () => {
  it("renders a compact system signal row with an Adjust CTA", () => {
    const html = renderToStaticMarkup(<TodaySystemSignalRow surface={SURFACE} />);

    expect(html).toContain("today-system-signal-row");
    expect(html).toContain("SIGNAL SYSTÈME");
    expect(html).toContain("Surcharge détectée");
    expect(html).toContain("Allège avant de forcer l’exécution.");
    expect(html).toContain("Ajuster");
  });

  it("uses restrained critical styling and does not introduce Coach copy", () => {
    const html = renderToStaticMarkup(
      <TodaySystemSignalRow surface={{ ...SURFACE, tone: "critical", severity: "critical" }} />
    );

    expect(html).toContain("is-signal-critical");
    expect(html).not.toContain("Coach IA");
  });

  it("renders nothing without a surface model", () => {
    expect(renderToStaticMarkup(<TodaySystemSignalRow surface={null} />)).toBe("");
  });

  it("routes the CTA through the existing Adjust callback", () => {
    const onOpenAdjust = vi.fn();
    const element = TodaySystemSignalRow({ surface: SURFACE, onOpenAdjust });
    const button = React.Children.toArray(element.props.children).find((child) => child?.type === "button");

    button.props.onClick();

    expect(onOpenAdjust).toHaveBeenCalledTimes(1);
  });
});
