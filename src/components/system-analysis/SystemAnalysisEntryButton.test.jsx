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

  it("calls onClick for available and explanatory locked states", () => {
    const onClick = vi.fn();
    const available = SystemAnalysisEntryButton({ model: AVAILABLE_MODEL, onClick });
    const locked = SystemAnalysisEntryButton({
      model: { ...AVAILABLE_MODEL, enabled: false, state: "locked", tone: "ai", label: "Analyse système" },
      onClick,
    });

    available.props.onClick({ type: "click" });
    locked.props.onClick({ type: "click" });

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("keeps running disabled while locked and quota states remain explanatory", () => {
    const onClick = vi.fn();
    const locked = SystemAnalysisEntryButton({
      model: { ...AVAILABLE_MODEL, enabled: false, state: "locked", tone: "ai", label: "Analyse système" },
      onClick,
    });
    const running = SystemAnalysisEntryButton({
      model: { ...AVAILABLE_MODEL, enabled: false, state: "running", label: "Analyse en cours…" },
      onClick,
    });
    const quota = SystemAnalysisEntryButton({
      model: { ...AVAILABLE_MODEL, enabled: false, state: "quota_exhausted", tone: "ai", label: "Analyse utilisée" },
      onClick,
    });

    locked.props.onClick({ type: "click" });
    running.props.onClick({ type: "click" });
    quota.props.onClick({ type: "click" });

    expect(locked.props.disabled).toBe(false);
    expect(locked.props["data-system-analysis-explanatory"]).toBe("true");
    expect(running.props.disabled).toBe(true);
    expect(quota.props.disabled).toBe(false);
    expect(quota.props["data-system-analysis-explanatory"]).toBe("true");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("keeps explanatory locked states in the AI visual family", () => {
    const html = renderToStaticMarkup(
      <SystemAnalysisEntryButton
        model={{ ...AVAILABLE_MODEL, enabled: false, state: "locked", tone: "ai", label: "Analyse système" }}
      />
    );

    expect(html).toContain('data-system-analysis-state="locked"');
    expect(html).toContain('data-system-analysis-tone="ai"');
    expect(html).toContain('data-system-analysis-explanatory="true"');
    expect(html).toContain("Analyse système");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("renders nothing without a visible model", () => {
    expect(renderToStaticMarkup(<SystemAnalysisEntryButton model={null} />)).toBe("");
    expect(renderToStaticMarkup(<SystemAnalysisEntryButton model={{ visible: false }} />)).toBe("");
  });
});
