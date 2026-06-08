import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import AIInsightCard from "../today/AIInsightCard";
import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_TARGET_TYPE,
} from "../../features/day-analysis/dayAnalysisTypes";
import { DAY_ANALYSIS_SHEET_STATE } from "../../features/day-analysis/dayAnalysisSheetModel";
import DayAnalysisSheet, {
  DayAnalysisActionCard,
  DayAnalysisCloseButton,
  DayAnalysisSheetContent,
} from "./DayAnalysisSheet";

function action(overrides = {}) {
  return {
    id: "reduce_duration:occ-1",
    type: DAY_ANALYSIS_ACTION_TYPE.REDUCE_DURATION,
    label: "Réduire à 15 min",
    description: "Allège le prochain bloc sans changer l’objectif.",
    targetType: DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE,
    targetId: "occ-1",
    supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE,
    deterministicAction: {
      kind: "planning_repair",
      occurrenceId: "occ-1",
    },
    confirmationRequired: true,
    preview: {
      summary: "Durée actuelle : 30 min. Nouvelle durée : 15 min.",
      targetTitle: "Préparer la publication",
      before: { summary: "30 min" },
      after: { summary: "15 min" },
    },
    ...overrides,
  };
}

function resultFixture(overrides = {}) {
  return {
    version: 1,
    dayKey: "2026-04-19",
    diagnosis: {
      title: "Un bloc est à récupérer",
      explanation: "Le bloc prévu ce matin est encore récupérable en version simple.",
      evidence: ["Bloc prévu à 08:30", "Action : Préparer la publication", "Temps restant suffisant"],
      confidence: 0.82,
    },
    recommendedAction: action(),
    alternatives: [
      action({
        id: "open_planning:2026-04-19",
        type: DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING,
        label: "Ouvrir Planning",
        description: "Voir la journée et choisir l’ajustement manuellement.",
        targetType: DAY_ANALYSIS_TARGET_TYPE.PLANNING,
        targetId: "2026-04-19",
        supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY,
        deterministicAction: { kind: "navigation", route: "planning" },
        confirmationRequired: false,
        preview: { summary: "Aucune modification automatique." },
      }),
      action({
        id: "open_coach:day",
        type: DAY_ANALYSIS_ACTION_TYPE.OPEN_COACH,
        label: "Ouvrir le Coach",
        description: "Demander une aide conversationnelle.",
        targetType: DAY_ANALYSIS_TARGET_TYPE.COACH,
        targetId: "coach",
        supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY,
        deterministicAction: { kind: "navigation", route: "coach" },
        confirmationRequired: false,
        preview: { summary: "Aucune modification automatique." },
      }),
    ],
    dataLimitations: [],
    userConfirmationRequired: true,
    modelMeta: { requestId: "req-day" },
    ...overrides,
  };
}

function renderSheet(props = {}) {
  return renderToStaticMarkup(
    <DayAnalysisSheet
      open
      state={DAY_ANALYSIS_SHEET_STATE.INTRO}
      {...props}
    />
  );
}

function expandElement(node) {
  if (Array.isArray(node)) return node.map(expandElement);
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === "function") return expandElement(node.type(node.props));
  const children = React.Children.toArray(node.props?.children).map(expandElement);
  return React.cloneElement(node, node.props, ...children);
}

function findAll(node, predicate) {
  const matches = [];
  function visit(current) {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!React.isValidElement(current)) return;
    if (predicate(current)) matches.push(current);
    React.Children.toArray(current.props?.children).forEach(visit);
  }
  visit(node);
  return matches;
}

function nodeText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (!React.isValidElement(node)) return "";
  return React.Children.toArray(node.props?.children).map(nodeText).join("");
}

describe("DayAnalysisSheet", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing when closed", () => {
    expect(renderToStaticMarkup(<DayAnalysisSheet open={false} />)).toBe("");
  });

  it("intro renders hero asset layer, scope rows and launch CTA", () => {
    const html = renderSheet();

    expect(html).toContain("data-hero-asset=\"day-analysis-sheet-hero-bg.webp\"");
    expect(html).toContain("Analyse IA du jour");
    expect(html).toContain("Optimise uniquement ta journée.");
    expect(html).toContain("L’IA lit ta journée et propose une correction ciblée.");
    expect(html).toContain("Planning du jour");
    expect(html).toContain("Prochain bloc");
    expect(html).toContain("Retards / blocs manqués");
    expect(html).toContain("Temps restant");
    expect(html).toContain("Objectif prioritaire");
    expect(html).toContain("Lancer l’analyse");
  });

  it("loading renders premium loading state and reassurance", () => {
    const html = renderSheet({ state: DAY_ANALYSIS_SHEET_STATE.LOADING });

    expect(html).toContain("Analyse de ta journée");
    expect(html).toContain("Lecture des blocs, retards et options possibles.");
    expect(html).toContain("dayAnalysisSheet__signal");
    expect(html).toContain("Lecture du jour");
    expect(html).toContain("Détection du point à corriger");
    expect(html).toContain("Préparation de l’action");
    expect(html).toContain("Aucune modification ne sera appliquée sans validation.");
  });

  it("result renders diagnosis, recommended action, alternatives and no-mutation note", () => {
    const html = renderSheet({
      state: DAY_ANALYSIS_SHEET_STATE.RESULT,
      result: resultFixture(),
    });

    expect(html).toContain("Analyse terminée");
    expect(html).toContain("Un bloc est à récupérer");
    expect(html).toContain("Confiance 82%");
    expect(html).toContain("Action recommandée");
    expect(html).toContain("Réduire à 15 min");
    expect(html).toContain("Cible : Préparer la publication");
    expect(html).toContain("Options secondaires");
    expect(html).toContain("Ouvrir Planning");
    expect(html).toContain("Rien n’est appliqué sans validation.");
  });

  it("applicable action shows Préparer la validation", () => {
    const html = renderSheet({
      state: DAY_ANALYSIS_SHEET_STATE.RESULT,
      result: resultFixture(),
    });

    expect(html).toContain("Préparer la validation");
  });

  it("navigation-only action shows the correct primary CTA", () => {
    const planning = action({
      id: "open_planning:2026-04-19",
      type: DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING,
      label: "Ouvrir Planning",
      targetType: DAY_ANALYSIS_TARGET_TYPE.PLANNING,
      targetId: "2026-04-19",
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY,
      confirmationRequired: false,
    });
    const html = renderSheet({
      state: DAY_ANALYSIS_SHEET_STATE.RESULT,
      result: resultFixture({ recommendedAction: planning, alternatives: [] }),
    });

    expect(html).toContain("Ouvrir Planning");
    expect(html).toContain("OUVRIR PLANNING");
  });

  it("no_change result shows calm no-action state", () => {
    const noChange = action({
      id: "no_change:2026-04-19",
      type: DAY_ANALYSIS_ACTION_TYPE.NO_CHANGE,
      label: "Garder la journée validée",
      description: "Aucun ajustement nécessaire pour aujourd’hui.",
      targetType: DAY_ANALYSIS_TARGET_TYPE.DAY,
      targetId: "2026-04-19",
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NO_CHANGE,
      confirmationRequired: false,
    });
    const html = renderSheet({
      state: DAY_ANALYSIS_SHEET_STATE.RESULT,
      result: resultFixture({ recommendedAction: noChange, alternatives: [] }),
    });

    expect(html).toContain("Rien à corriger maintenant");
    expect(html).toContain("Ta journée est assez claire pour continuer.");
    expect(html).toContain("Retour à Home");
  });

  it("confirmation renders exact preview and calls onConfirmApply", () => {
    const onConfirmApply = vi.fn();
    const tree = expandElement(
      <DayAnalysisSheetContent
        state={DAY_ANALYSIS_SHEET_STATE.CONFIRMATION}
        result={resultFixture()}
        selectedActionId="reduce_duration:occ-1"
        onConfirmApply={onConfirmApply}
      />
    );
    const html = renderToStaticMarkup(
      <DayAnalysisSheet
        open
        state={DAY_ANALYSIS_SHEET_STATE.CONFIRMATION}
        result={resultFixture()}
        selectedActionId="reduce_duration:occ-1"
      />
    );
    const applyButton = findAll(
      tree,
      (node) => node.type === "button" && nodeText(node) === "Appliquer"
    )[0];

    expect(html).toContain("Validation finale");
    expect(html).toContain("Durée actuelle : 30 min. Nouvelle durée : 15 min.");
    expect(html).toContain("Préparer la publication");
    applyButton.props.onClick();
    expect(onConfirmApply).toHaveBeenCalledWith(resultFixture().recommendedAction);
  });

  it("success renders applied summary without inventing another change", () => {
    const html = renderSheet({
      state: DAY_ANALYSIS_SHEET_STATE.SUCCESS,
      successSummary: "Bloc réduit à 15 min.",
    });

    expect(html).toContain("Journée ajustée");
    expect(html).toContain("La correction a été appliquée.");
    expect(html).toContain("Bloc réduit à 15 min.");
    expect(html).not.toContain("Bloc déplacé");
  });

  it("timeout, quota, premium and generic errors render safe copy", () => {
    const expectations = [
      ["DAY_ANALYSIS_PROVIDER_TIMEOUT", "Analyse trop longue"],
      ["QUOTA_EXCEEDED", "Analyse limitée pour l’instant"],
      ["PREMIUM_REQUIRED", "Analyse réservée Premium"],
      ["UNKNOWN", "Analyse indisponible"],
    ];

    expectations.forEach(([errorCode, title]) => {
      const html = renderSheet({
        state: DAY_ANALYSIS_SHEET_STATE.ERROR,
        error: { errorCode },
      });

      expect(html).toContain(title);
      expect(html).toContain("Réessayer");
      expect(html).toContain("Aucune modification appliquée.");
      expect(html).not.toContain("provider stack");
    });
  });

  it("generic error renders simplified non-repetitive copy", () => {
    const html = renderSheet({
      state: DAY_ANALYSIS_SHEET_STATE.ERROR,
      error: { errorCode: "UNKNOWN" },
    });

    expect(html).toContain("Analyse indisponible");
    expect(html).toContain("Aucune modification appliquée.");
    expect(html).toContain("Impossible de lancer l’analyse maintenant. Réessaie dans quelques instants.");
    expect((html.match(/Analyse indisponible/g) || []).length).toBe(1);
  });

  it("close and retry callbacks work", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const closeButton = DayAnalysisCloseButton({ onClose });
    const retryTree = expandElement(
      <DayAnalysisSheetContent
        state={DAY_ANALYSIS_SHEET_STATE.ERROR}
        error={{ errorCode: "TIMEOUT" }}
        onRetry={onRetry}
        onClose={onClose}
      />
    );
    const retryButton = findAll(
      retryTree,
      (node) => node.type === "button" && nodeText(node).includes("Réessayer")
    )[0];

    closeButton.props.onClick();
    retryButton.props.onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not call backend request or mutate app state", () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    const setData = vi.fn();
    const result = resultFixture();
    const before = JSON.stringify(result);
    renderToStaticMarkup(
      <DayAnalysisSheet
        open
        state={DAY_ANALYSIS_SHEET_STATE.RESULT}
        result={result}
        setData={setData}
      />
    );
    const card = DayAnalysisActionCard({ action: result.recommendedAction });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(setData).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toBe(before);
    expect(card.props.onClick).toBeUndefined();
  });

  it("does not show validée before success", () => {
    const beforeSuccess = [
      renderSheet(),
      renderSheet({ state: DAY_ANALYSIS_SHEET_STATE.LOADING }),
      renderSheet({ state: DAY_ANALYSIS_SHEET_STATE.RESULT, result: resultFixture() }),
      renderSheet({
        state: DAY_ANALYSIS_SHEET_STATE.CONFIRMATION,
        result: resultFixture(),
        selectedActionId: "reduce_duration:occ-1",
      }),
      renderSheet({ state: DAY_ANALYSIS_SHEET_STATE.ERROR, error: { errorCode: "TIMEOUT" } }),
    ].join("\n");

    expect(beforeSuccess).not.toContain("validée");
  });

  it("keeps the Home AI card background unchanged", () => {
    const html = renderToStaticMarkup(<AIInsightCard />);

    expect(html).toContain("todayAiBackdrop");
    expect(html).not.toContain("day-analysis-sheet-hero-bg.webp");
  });
});
