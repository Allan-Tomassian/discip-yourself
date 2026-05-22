import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AIInsightCard from "./AIInsightCard";

describe("AIInsightCard", () => {
  it("renders the Day Analysis entry without fake apply or unavailable copy", () => {
    const html = renderToStaticMarkup(<AIInsightCard />);

    expect(html).toContain("Analyse IA du jour");
    expect(html).toContain("NOUVEAU");
    expect(html).toContain("L’IA analyse ta journée et propose des ajustements ciblés.");
    expect(html).toContain("Réduire un bloc");
    expect(html).toContain("Déplacer");
    expect(html).toContain("Ajouter un bloc");
    expect(html).toContain("Optimiser aujourd’hui");
    expect(html).toContain("todayAiBackdrop");
    expect(html).not.toContain("todayAiBrainAsset");
    expect(html).not.toContain("Insight IA indisponible");
    expect(html).not.toContain(">Appliquer<");
  });

  it("keeps the CTA non-mutating by delegating to the supplied entry callback", () => {
    const onOptimize = vi.fn();
    const element = AIInsightCard({ onOptimize });
    const button = element.props.children.find((child) => child?.props?.className === "todayAiActions")
      .props.children;

    button.props.onClick();

    expect(onOptimize).toHaveBeenCalledTimes(1);
  });
});
