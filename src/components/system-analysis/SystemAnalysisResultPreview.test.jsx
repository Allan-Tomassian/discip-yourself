import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SystemAnalysisResultPreview from "./SystemAnalysisResultPreview";

const RESULT = {
  executiveSummary: "Le système avance, mais la charge est trop concentrée.",
  invisibleFriction: [
    { title: "Charge invisible du matin", message: "Trop de blocs critiques au même moment." },
    { title: "Objectif négligé", message: "Une direction reçoit peu d’exécution." },
    { title: "Friction secondaire", message: "Cette ligne ne doit pas dominer." },
  ],
  recommendedCorrections: [
    { title: "Réduire le bloc le plus long", message: "Le raccourcir protège le démarrage." },
    { title: "Déplacer un bloc support", message: "Le mettre demain baisse la charge." },
  ],
  next7DaysFocus: [{ title: "Protéger deux matinées" }],
  dataLimitations: ["Snapshot compact.", "Pas de données externes."],
  correctionDraft: {
    occurrenceAdjustments: [{ occurrenceId: "occ_1", action: "reduce_duration" }],
  },
};

describe("SystemAnalysisResultPreview", () => {
  it("renders the loading state with premium AI copy", () => {
    const html = renderToStaticMarkup(<SystemAnalysisResultPreview status="loading" />);

    expect(html).toContain("Analyse du système en cours");
    expect(html).toContain("Lecture de tes blocs, frictions et progrès.");
    expect(html).toContain('data-command-tone="ai"');
  });

  it("renders a compact success summary without raw JSON or applying corrections", () => {
    const html = renderToStaticMarkup(<SystemAnalysisResultPreview status="success" result={RESULT} />);

    expect(html).toContain("Diagnostic profond terminé");
    expect(html).toContain("Le système avance");
    expect(html).toContain("Charge invisible du matin");
    expect(html).toContain("Réduire le bloc le plus long");
    expect(html).toContain("Protéger deux matinées");
    expect(html).toContain("Snapshot compact");
    expect(html).toContain("Aucune modification n’a été appliquée.");
    expect(html).toContain("Corrections à valider bientôt");
    expect(html).toContain("aria-disabled=\"true\"");
    expect(html).not.toContain("occurrenceAdjustments");
    expect(html).not.toContain("{&quot;");
  });

  it("can expose the correction review entry after a successful result", () => {
    const html = renderToStaticMarkup(
      <SystemAnalysisResultPreview status="success" result={RESULT} onOpenCorrections={() => {}} />
    );

    expect(html).toContain("Voir les corrections proposées");
    expect(html).not.toContain("Corrections à valider bientôt");
  });

  it("renders persisted latest-analysis title and stale note when provided", () => {
    const html = renderToStaticMarkup(
      <SystemAnalysisResultPreview
        status="success"
        result={RESULT}
        title="Dernière analyse"
        staleNote="Ton système a changé depuis cette analyse."
      />
    );

    expect(html).toContain("Dernière analyse");
    expect(html).toContain("Ton système a changé depuis cette analyse.");
    expect(html).toContain("Aucune modification n’a été appliquée.");
  });

  it("renders calm premium, ineligible, timeout, and invalid states", () => {
    const premium = renderToStaticMarkup(<SystemAnalysisResultPreview status="premium_required" />);
    const ineligible = renderToStaticMarkup(
      <SystemAnalysisResultPreview
        status="ineligible"
        missingRequirements={[{ label: "Pas assez de blocs planifiés" }]}
      />
    );
    const timeout = renderToStaticMarkup(<SystemAnalysisResultPreview status="timeout" />);
    const invalid = renderToStaticMarkup(
      <SystemAnalysisResultPreview status="error" errorCode="INVALID_SYSTEM_ANALYSIS_RESPONSE" />
    );

    expect(premium).toContain("Analyse système premium");
    expect(premium).toContain("Cette analyse avancée est réservée au plan Premium.");
    expect(ineligible).toContain("Analyse système");
    expect(ineligible).toContain("Crée ou valide d’abord un système");
    expect(timeout).toContain("L’analyse prend trop de temps. Réessaie plus tard.");
    expect(invalid).toContain("L’analyse n’a pas pu être validée.");
  });

  it("exposes retry only for retryable errors", () => {
    const onRetry = vi.fn();
    const retryable = SystemAnalysisResultPreview({ status: "error", onRetry });
    const locked = SystemAnalysisResultPreview({ status: "premium_required", onRetry });
    const retryButton = React.Children.toArray(retryable.props.children)[1].props.children[1];

    retryButton.props.onClick({ type: "click" });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(locked)).not.toContain("Réessayer");
  });

  it("renders nothing while idle", () => {
    expect(renderToStaticMarkup(<SystemAnalysisResultPreview status="idle" />)).toBe("");
  });
});
