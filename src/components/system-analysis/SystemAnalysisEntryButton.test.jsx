import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SystemAnalysisEntryButton from "./SystemAnalysisEntryButton";

const AVAILABLE_MODEL = {
  visible: true,
  enabled: true,
  state: "available",
  tone: "ai",
  label: "Analyser le système",
  reason: "Analyse premium disponible.",
  ariaLabel: "Analyser le système avec l’analyse premium",
};

describe("SystemAnalysisEntryButton", () => {
  it("renders a compact labeled entry", () => {
    const html = renderToStaticMarkup(<SystemAnalysisEntryButton model={AVAILABLE_MODEL} />);

    expect(html).toContain("systemAnalysisEntryButton");
    expect(html).toContain("Analyser le système");
    expect(html).toContain('data-system-analysis-state="available"');
    expect(html).toContain('data-system-analysis-tone="ai"');
  });

  it("calls onClick only when enabled", () => {
    const onClick = vi.fn();
    const element = SystemAnalysisEntryButton({ model: AVAILABLE_MODEL, onClick });

    element.props.onClick({ type: "click" });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps locked, running, and quota entries disabled", () => {
    const onClick = vi.fn();
    const locked = SystemAnalysisEntryButton({
      model: { ...AVAILABLE_MODEL, enabled: false, state: "locked", tone: "disabled", label: "Analyse système" },
      onClick,
    });
    const running = SystemAnalysisEntryButton({
      model: { ...AVAILABLE_MODEL, enabled: false, state: "running", label: "Analyse en cours…" },
      onClick,
    });
    const quota = SystemAnalysisEntryButton({
      model: { ...AVAILABLE_MODEL, enabled: false, state: "quota_exhausted", tone: "attention", label: "Analyse système" },
      onClick,
    });

    locked.props.onClick({ type: "click" });
    running.props.onClick({ type: "click" });
    quota.props.onClick({ type: "click" });

    expect(locked.props.disabled).toBe(true);
    expect(running.props.disabled).toBe(true);
    expect(quota.props.disabled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders nothing without a visible model", () => {
    expect(renderToStaticMarkup(<SystemAnalysisEntryButton model={null} />)).toBe("");
    expect(renderToStaticMarkup(<SystemAnalysisEntryButton model={{ visible: false }} />)).toBe("");
  });
});
