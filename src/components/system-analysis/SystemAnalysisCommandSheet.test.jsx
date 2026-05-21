import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SystemAnalysisCommandSheet from "./SystemAnalysisCommandSheet";

const VALID_ITEM_ID = "occurrence:0:occ_focus:reduce_duration";

const resultFixture = {
  executiveSummary: "Le système avance, mais la charge reste trop concentrée.",
  invisibleFriction: [{ title: "Charge invisible du matin" }],
  systemWeaknesses: [{ title: "Charge mal répartie" }],
  strongestPatterns: [{ title: "Les blocs courts tiennent mieux" }],
  recommendedCorrections: [{ title: "Réduire le bloc le plus long" }],
  next7DaysFocus: [{ title: "Protéger deux blocs courts" }],
  dataLimitations: ["Snapshot compact."],
};

function reviewFixture({ selected = false, applied = false } = {}) {
  const status = applied ? "applied" : "valid";
  const validItem = {
    id: VALID_ITEM_ID,
    group: "occurrences",
    label: "Réduire la durée",
    description: "Réduire à 30 min.",
    reason: "Version plus faisable.",
    expectedImpact: "Démarrage plus simple",
    confidence: 0.8,
    status,
    selected,
    selectable: !applied,
    applied,
    validationIssues: [],
    repairPreview: applied ? null : { type: "reduce_duration", occurrenceId: "occ_focus", durationMinutes: 30 },
  };
  const unsupportedItem = {
    id: "occurrence:1:occ_focus:protect",
    group: "occurrences",
    label: "Protéger ce bloc",
    description: "Protection à afficher seulement pour l’instant.",
    reason: "Bloc important.",
    expectedImpact: "",
    confidence: 0.6,
    status: "unsupported",
    selected: false,
    selectable: false,
    validationIssues: [{ message: "Protection à revoir plus tard." }],
    repairPreview: null,
  };
  const items = [validItem, unsupportedItem];
  return {
    items,
    groups: [{
      id: "occurrences",
      label: "Blocs",
      items,
      itemCount: items.length,
      selectableCount: applied ? 0 : 1,
      validCount: applied ? 0 : 1,
    }],
    selectedIds: selected ? [VALID_ITEM_ID] : [],
    selectableCount: applied ? 0 : 1,
    selectedCount: selected ? 1 : 0,
    validSelectedCount: selected ? 1 : 0,
    hasValidSelection: selected,
    contractIssues: [],
    confirmationSummary: {
      description: selected ? "1 correction prête pour la validation finale." : "Aucune correction prête sélectionnée.",
    },
  };
}

function applicationPreviewFixture() {
  return {
    ok: true,
    selectedItems: [{ id: VALID_ITEM_ID, label: "Réduire la durée", description: "Réduire à 30 min." }],
    summary: {
      message: "1 correction prête à appliquer après confirmation.",
      willNotChange: "Les corrections à revoir ne seront pas appliquées.",
    },
  };
}

describe("SystemAnalysisCommandSheet", () => {
  it("renders intro with premium analysis scope and launch CTA", () => {
    const html = renderToStaticMarkup(<SystemAnalysisCommandSheet open state="intro" />);

    expect(html).toContain("Analyse système");
    expect(html).toContain("Lis ton système. Trouve les failles. Propose une correction.");
    expect(html).toContain("Ce que l’analyse va lire");
    expect(html).toContain("Objectifs");
    expect(html).toContain("Planning");
    expect(html).toContain("Sessions");
    expect(html).toContain("Frictions");
    expect(html).toContain("Progression");
    expect(html).toContain("Lancer l’analyse");
  });

  it("renders data-limited state without launch copy", () => {
    const html = renderToStaticMarkup(<SystemAnalysisCommandSheet open state="data_limited" />);

    expect(html).toContain("Données encore limitées.");
    expect(html).toContain("L’analyse sera plus précise après quelques jours d’exécution.");
    expect(html).toContain("L’analyse sera structurelle : elle vérifiera ton planning, tes objectifs et les blocs manquants.");
    expect(html).not.toContain("L’analyse complète n’est pas lancée tant que les signaux sont trop fins.");
    expect(html).toContain("Structure du planning");
    expect(html).toContain("Créneaux libres");
    expect(html).toContain("Objectifs sans blocs");
    expect(html).toContain("Prochain bloc manquant");
    expect(html).toContain("Compris");
    expect(html).not.toContain("Continuer à exécuter");
    expect(html).not.toContain("Fermer</button>");
    expect(html).not.toContain("Lancer l’analyse");
  });

  it("renders loading with deterministic steps and no generic spinner copy", () => {
    const html = renderToStaticMarkup(<SystemAnalysisCommandSheet open state="loading" />);

    expect(html).toContain("Analyse du système en cours");
    expect(html).toContain("Lecture du système");
    expect(html).toContain("Détection des failles");
    expect(html).toContain("Préparation des corrections");
    expect(html).toContain("Aucune modification ne sera appliquée sans validation.");
  });

  it("renders result review and latest analysis inside the sheet", () => {
    const reviewHtml = renderToStaticMarkup(
      <SystemAnalysisCommandSheet open state="result_review" result={resultFixture} review={reviewFixture()} />
    );
    const latestHtml = renderToStaticMarkup(
      <SystemAnalysisCommandSheet
        open
        state="latest_analysis"
        result={resultFixture}
        review={reviewFixture({ applied: true })}
        staleNote="Ton système a changé depuis cette analyse."
      />
    );

    expect(reviewHtml).toContain("Corrections proposées");
    expect(reviewHtml).toContain("Faille principale");
    expect(reviewHtml).toContain("Réduire la durée");
    expect(reviewHtml).toContain("APPLICABLE");
    expect(reviewHtml).toContain("Rien n’est appliqué sans validation finale.");
    expect(latestHtml).toContain("Dernière analyse");
    expect(latestHtml).toContain("Ton système a changé depuis cette analyse.");
    expect(latestHtml).toContain("Déjà appliquée");
  });

  it("renders final confirmation and applied success as separate states", () => {
    const confirmationHtml = renderToStaticMarkup(
      <SystemAnalysisCommandSheet
        open
        state="final_confirmation"
        applicationPreview={applicationPreviewFixture()}
        applicationResult={{ status: "idle" }}
      />
    );
    const successHtml = renderToStaticMarkup(
      <SystemAnalysisCommandSheet
        open
        state="applied_success"
        applicationResult={{
          status: "success",
          result: {
            summary: { message: "1 correction appliquée." },
            appliedItems: [{ id: VALID_ITEM_ID, label: "Réduire la durée", description: "Réduire à 30 min." }],
          },
        }}
      />
    );

    expect(confirmationHtml).toContain("Validation finale");
    expect(confirmationHtml).toContain("Ces corrections vont modifier ton planning. Tu gardes le contrôle.");
    expect(confirmationHtml).toContain("Appliquer les corrections");
    expect(confirmationHtml).toContain("Retour aux corrections");
    expect(successHtml).toContain("Corrections appliquées");
    expect(successHtml).toContain("Ton système a été ajusté.");
    expect(successHtml).toContain("Retour à Ajuster");
  });

  it("renders premium, quota, timeout, and generic error states calmly", () => {
    const premium = renderToStaticMarkup(<SystemAnalysisCommandSheet open state="premium_required" />);
    const quota = renderToStaticMarkup(<SystemAnalysisCommandSheet open state="quota_exhausted" />);
    const timeout = renderToStaticMarkup(<SystemAnalysisCommandSheet open state="timeout" />);
    const error = renderToStaticMarkup(<SystemAnalysisCommandSheet open state="error" />);

    expect(premium).toContain("Analyse système premium");
    expect(premium).toContain("Cette analyse avancée est réservée au plan Premium.");
    expect(quota).toContain("Analyse utilisée");
    expect(quota).toContain("Tu as utilisé tes analyses système du mois.");
    expect(timeout).toContain("L’analyse prend trop de temps. Réessaie plus tard.");
    expect(error).toContain("Analyse indisponible");
  });

  it("renders nothing when closed", () => {
    expect(renderToStaticMarkup(<SystemAnalysisCommandSheet open={false} state="intro" />)).toBe("");
  });
});
