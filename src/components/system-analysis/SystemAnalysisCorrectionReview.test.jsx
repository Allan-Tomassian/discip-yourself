import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SystemAnalysisCorrectionReview from "./SystemAnalysisCorrectionReview";

const VALID_ITEM_ID = "occurrence:0:occ_focus:reduce_duration";

function reviewFixture({ selected = false, unsupported = true, confirmation = false } = {}) {
  const validItem = {
    id: VALID_ITEM_ID,
    group: "occurrences",
    label: "Réduire la durée",
    description: "Réduire à 30 min.",
    reason: "Version plus faisable.",
    expectedImpact: "Démarrage plus simple",
    confidence: 0.8,
    status: "valid",
    selected,
    selectable: true,
    validationIssues: [],
    repairPreview: { type: "reduce_duration", occurrenceId: "occ_focus", durationMinutes: 30 },
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
    validationIssues: [{ code: "PROTECT_CORRECTION_REQUIRES_FUTURE_HELPER", message: "Protect corrections are display-only." }],
    repairPreview: null,
  };
  const items = unsupported ? [validItem, unsupportedItem] : [validItem];
  return {
    items,
    groups: [{
      id: "occurrences",
      label: "Blocs",
      items,
      itemCount: items.length,
      selectableCount: 1,
      validCount: 1,
    }],
    selectedIds: selected ? [VALID_ITEM_ID] : [],
    selectableCount: 1,
    selectedCount: selected ? 1 : 0,
    validSelectedCount: selected ? 1 : 0,
    hasValidSelection: selected,
    contractIssues: [],
    confirmationSummary: {
      description: selected ? "1 correction prête pour la validation finale." : "Aucune correction prête sélectionnée.",
      items: selected ? [{ id: VALID_ITEM_ID, label: "Réduire la durée", description: "Réduire à 30 min." }] : [],
    },
    confirmation,
  };
}

function v2ReviewFixture() {
  const destructiveItem = {
    id: "ci-remove",
    group: "unsupported",
    label: "Supprimer",
    description: "Supprimer un bloc non prioritaire.",
    reason: "Ce bloc crée une surcharge.",
    expectedImpact: "Charge plus basse",
    confidence: 0.7,
    status: "needs_review",
    selected: false,
    selectable: false,
    destructive: true,
    supportStatus: "needs_review",
    validationIssues: [],
    repairPreview: null,
  };
  const unsupportedItem = {
    id: "ci-protect",
    group: "unsupported",
    label: "Protéger",
    description: "Protéger une fenêtre de focus.",
    reason: "Créneau sensible.",
    expectedImpact: "",
    confidence: 0.6,
    status: "unsupported",
    selected: false,
    selectable: false,
    destructive: false,
    supportStatus: "unsupported",
    validationIssues: [],
    repairPreview: null,
  };
  const items = [destructiveItem, unsupportedItem];
  return {
    ...reviewFixture({ unsupported: false }),
    items,
    groups: [{
      id: "unsupported",
      label: "À revoir",
      items,
      itemCount: items.length,
      selectableCount: 0,
      validCount: 0,
    }],
    selectableCount: 0,
    hasValidSelection: false,
  };
}

function applicationPreviewFixture() {
  return {
    ok: true,
    selectedItems: [{ id: VALID_ITEM_ID, label: "Réduire la durée", description: "Réduire à 30 min." }],
    notAppliedItems: [{ id: "occurrence:1:occ_focus:protect", label: "Protéger ce bloc" }],
    summary: {
      message: "1 correction prête à appliquer après confirmation.",
      willNotChange: "Les propositions non sélectionnées, à revoir ou non prises en charge ne seront pas modifiées.",
    },
  };
}

describe("SystemAnalysisCorrectionReview", () => {
  it("renders compact correction review with honest non-mutation copy", () => {
    const html = renderToStaticMarkup(<SystemAnalysisCorrectionReview review={reviewFixture()} />);

    expect(html).toContain("Corrections proposées");
    expect(html).toContain("Aucune modification n’est appliquée sans validation.");
    expect(html).toContain("Réduire la durée");
    expect(html).toContain("APPLICABLE");
    expect(html).toContain("1 correction prête");
    expect(html).toContain("Sélectionner");
    expect(html).toContain("Ignorer");
    expect(html).toContain("Préparer la validation");
    expect(html).toContain("disabled");
    expect(html).not.toContain("VALIDÉE");
    expect(html).not.toContain("Valider les corrections sélectionnées");
  });

  it("renders selected valid corrections and enables the confirmation CTA", () => {
    const html = renderToStaticMarkup(<SystemAnalysisCorrectionReview review={reviewFixture({ selected: true })} />);

    expect(html).toContain("SÉLECTIONNÉE");
    expect(html).toContain("1 sélectionnée");
    expect(html).toContain("data-system-analysis-confirm=\"true\"");
    expect(html).not.toContain("Acceptée");
  });

  it("renders unsupported corrections with explanatory copy and no accept button for that item", () => {
    const html = renderToStaticMarkup(<SystemAnalysisCorrectionReview review={reviewFixture({ unsupported: true })} />);

    expect(html).toContain("NON PRIS EN CHARGE");
    expect(html).toContain("Protect corrections are display-only.");
    expect(html).toContain("Revue manuelle requise");
  });

  it("renders v2 destructive and unsupported badges without pre-application validée copy", () => {
    const html = renderToStaticMarkup(<SystemAnalysisCorrectionReview review={v2ReviewFixture()} />);

    expect(html).toContain("DESTRUCTIF");
    expect(html).toContain("NON PRIS EN CHARGE");
    expect(html).not.toContain("VALIDÉE");
    expect(html).not.toContain("Sélectionner");
  });

  it("renders already-applied corrections as visible but non-selectable", () => {
    const appliedItem = {
      id: VALID_ITEM_ID,
      group: "occurrences",
      label: "Réduire la durée",
      description: "Réduire à 30 min.",
      reason: "Version plus faisable.",
      expectedImpact: "",
      confidence: 0.8,
      status: "applied",
      selected: false,
      selectable: false,
      applied: true,
      validationIssues: [],
      repairPreview: null,
    };
    const review = {
      ...reviewFixture({ unsupported: false }),
      items: [appliedItem],
      groups: [{
        id: "occurrences",
        label: "Blocs",
        items: [appliedItem],
        itemCount: 1,
        selectableCount: 0,
        validCount: 0,
      }],
      selectableCount: 0,
      selectedCount: 0,
      validSelectedCount: 0,
      hasValidSelection: false,
    };
    const html = renderToStaticMarkup(<SystemAnalysisCorrectionReview review={review} />);

    expect(html).toContain("Déjà appliquée");
    expect(html).not.toContain("Sélectionner");
  });

  it("renders a local confirmation placeholder without applying corrections", () => {
    const html = renderToStaticMarkup(
      <SystemAnalysisCorrectionReview
        review={reviewFixture({ selected: true })}
        applicationPreview={applicationPreviewFixture()}
        confirmationOpen
      />
    );

    expect(html).toContain("Prochaine étape : validation finale");
    expect(html).toContain("1 correction prête à appliquer après confirmation.");
    expect(html).toContain("Appliquer les corrections");
    expect(html).toContain("Les propositions non sélectionnées");
    expect(html).toContain("Aucune correction n’a encore été appliquée.");
    expect(html).not.toContain("applyOccurrenceRepair");
  });

  it("renders successful and failed application summaries without implying hidden mutation", () => {
    const successHtml = renderToStaticMarkup(
      <SystemAnalysisCorrectionReview
        review={reviewFixture({ selected: true })}
        applicationPreview={applicationPreviewFixture()}
        applicationResult={{
          status: "success",
          result: {
            summary: { message: "1 correction appliquée." },
            appliedItems: [{ id: VALID_ITEM_ID, label: "Réduire la durée", description: "Réduire à 30 min." }],
          },
        }}
        confirmationOpen
      />
    );
    const errorHtml = renderToStaticMarkup(
      <SystemAnalysisCorrectionReview
        review={reviewFixture({ selected: true })}
        applicationPreview={applicationPreviewFixture()}
        applicationResult={{
          status: "error",
          message: "Rien n’a été modifié.",
        }}
        confirmationOpen
      />
    );

    expect(successHtml).toContain("Corrections appliquées");
    expect(successHtml).toContain("1 correction appliquée.");
    expect(errorHtml).toContain("Les corrections n’ont pas pu être appliquées proprement.");
    expect(errorHtml).toContain("Rien n’a été modifié.");
  });

  it("renders nothing without review items", () => {
    expect(renderToStaticMarkup(<SystemAnalysisCorrectionReview review={null} />)).toBe("");
    expect(renderToStaticMarkup(<SystemAnalysisCorrectionReview review={{ items: [] }} />)).toBe("");
  });
});
