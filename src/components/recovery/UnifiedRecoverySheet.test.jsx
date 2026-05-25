import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  RECOVERY_OPTION_TYPE,
  RECOVERY_CONTEXT,
} from "../../features/recovery/recoveryTypes";
import {
  RECOVERY_SHEET_STATE,
  buildRecoverySheetViewModel,
} from "../../features/recovery/recoverySheetViewModel";
import UnifiedRecoverySheet, {
  RecoveryOptionButton,
  RecoverySheetCloseButton,
  RecoverySheetContent,
} from "./UnifiedRecoverySheet";

const OPTION_COPY = Object.freeze({
  [RECOVERY_OPTION_TYPE.REDUCE_DURATION]: ["Réduire à 15 min", "Crée une version de 15 min à 18:00."],
  [RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY]: ["Reporter ce soir", "Déplace ce bloc aujourd’hui à 18:00."],
  [RECOVERY_OPTION_TYPE.MOVE_TOMORROW]: ["Déplacer demain", "Déplace ce bloc demain à 09:00."],
  [RECOVERY_OPTION_TYPE.CHOOSE_TIME]: ["Choisir une heure", "Sélectionner un créneau précis avant de déplacer ce bloc."],
  [RECOVERY_OPTION_TYPE.SKIP_ONCE]: ["Passer cette fois", "Marque seulement ce bloc comme passé. Rien n’est supprimé."],
  [RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP]: ["Demander au Coach IA", "Obtenir de l’aide sans appliquer de changement automatique."],
  [RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL]: ["Ouvrir Planning", "Voir le bloc dans le planning avant de changer l’horaire."],
});

function recoveryOption(type, overrides = {}) {
  const [label, description] = OPTION_COPY[type] || ["Option", "Changement explicite."];
  return {
    id: `${type}:occ_source`,
    type,
    label,
    description,
    confirmationRequired:
      type === RECOVERY_OPTION_TYPE.SKIP_ONCE ||
      type === RECOVERY_OPTION_TYPE.CHOOSE_TIME ||
      type === RECOVERY_OPTION_TYPE.REDUCE_DURATION,
    destructive: type === RECOVERY_OPTION_TYPE.SKIP_ONCE,
    disabled: false,
    reason: `reason_${type}`,
    preview: {
      occurrenceId: "occ_source",
      summary: description,
    },
    ...overrides,
  };
}

function renderSheet(props = {}) {
  return renderToStaticMarkup(
    <UnifiedRecoverySheet
      open
      recoveryContext={RECOVERY_CONTEXT.MISSED}
      options={[
        recoveryOption(RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY),
        recoveryOption(RECOVERY_OPTION_TYPE.MOVE_TOMORROW),
      ]}
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

function expandedContent(viewModel, callbacks = {}) {
  return expandElement(
    <RecoverySheetContent
      viewModel={viewModel}
      onSelectOption={callbacks.onSelectOption}
      onConfirmOption={callbacks.onConfirmOption}
      onOpenCoach={callbacks.onOpenCoach}
      onOpenPlanning={callbacks.onOpenPlanning}
      onRequestConfirmation={callbacks.onRequestConfirmation}
      onCancelConfirmation={callbacks.onCancelConfirmation}
      onClose={callbacks.onClose}
    />
  );
}

function readyViewModel(options) {
  return buildRecoverySheetViewModel({
    open: true,
    recoveryContext: RECOVERY_CONTEXT.MISSED,
    options,
  });
}

describe("UnifiedRecoverySheet", () => {
  it("renders nothing when closed", () => {
    const html = renderToStaticMarkup(
      <UnifiedRecoverySheet
        open={false}
        recoveryContext={RECOVERY_CONTEXT.MISSED}
        options={[recoveryOption(RECOVERY_OPTION_TYPE.MOVE_TOMORROW)]}
      />
    );

    expect(html).toBe("");
  });

  it("renders problem copy for missed, late, blocked, and reported contexts", () => {
    const expectations = [
      [RECOVERY_CONTEXT.MISSED, "Ce bloc n’a pas été lancé.", "Tu peux le récupérer sans refaire toute la journée."],
      [RECOVERY_CONTEXT.LATE, "Ce bloc est en retard.", "Il est encore récupérable en version simple."],
      [RECOVERY_CONTEXT.BLOCKED, "Ce bloc t’a bloqué.", "Réduis-le ou déplace-le pour reprendre."],
      [RECOVERY_CONTEXT.REPORTED, "Ce bloc a été signalé.", "Choisis un créneau plus réaliste."],
    ];

    expectations.forEach(([context, title, description]) => {
      const html = renderSheet({
        recoveryContext: context,
        options: [recoveryOption(RECOVERY_OPTION_TYPE.MOVE_TOMORROW)],
      });

      expect(html).toContain(title);
      expect(html).toContain(description);
    });
  });

  it("renders visible options capped to four items", () => {
    const html = renderSheet({
      options: [
        recoveryOption(RECOVERY_OPTION_TYPE.REDUCE_DURATION),
        recoveryOption(RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY),
        recoveryOption(RECOVERY_OPTION_TYPE.MOVE_TOMORROW),
        recoveryOption(RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL),
        recoveryOption(RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP),
      ],
    });

    expect(html.match(/data-recovery-option-type=/g)).toHaveLength(4);
    expect(html).toContain("Réduire à 15 min");
    expect(html).toContain("Ouvrir Planning");
    expect(html).not.toContain("Demander au Coach IA");
  });

  it("opens confirmation flow for confirmationRequired options", () => {
    const option = recoveryOption(RECOVERY_OPTION_TYPE.SKIP_ONCE);
    const onRequestConfirmation = vi.fn();
    const tree = expandedContent(readyViewModel([option]), { onRequestConfirmation });
    const button = findAll(
      tree,
      (node) => node.type === "button" && node.props["data-recovery-option-type"] === RECOVERY_OPTION_TYPE.SKIP_ONCE
    )[0];

    button.props.onClick();

    expect(onRequestConfirmation).toHaveBeenCalledWith(option);
  });

  it("confirmation calls onConfirmOption with the selected option", () => {
    const option = recoveryOption(RECOVERY_OPTION_TYPE.SKIP_ONCE);
    const onConfirmOption = vi.fn();
    const viewModel = buildRecoverySheetViewModel({
      open: true,
      recoveryContext: RECOVERY_CONTEXT.MISSED,
      options: [option],
      confirmingOptionId: option.id,
    });
    const tree = expandedContent(viewModel, { onConfirmOption });
    const confirmButton = findAll(
      tree,
      (node) => node.type === "button" && /^Confirmer/.test(node.props["aria-label"] || "")
    )[0];

    confirmButton.props.onClick();

    expect(onConfirmOption).toHaveBeenCalledWith(option);
  });

  it("cancel confirmation returns control to the option list", () => {
    const option = recoveryOption(RECOVERY_OPTION_TYPE.SKIP_ONCE);
    const onCancelConfirmation = vi.fn();
    const confirmationViewModel = buildRecoverySheetViewModel({
      open: true,
      recoveryContext: RECOVERY_CONTEXT.MISSED,
      options: [option],
      confirmingOptionId: option.id,
    });
    const confirmationTree = expandedContent(confirmationViewModel, { onCancelConfirmation });
    const cancelButton = findAll(
      confirmationTree,
      (node) => node.type === "button" && nodeText(node) === "Annuler"
    )[0];
    const readyHtml = renderToStaticMarkup(
      <RecoverySheetContent viewModel={readyViewModel([option])} />
    );

    cancelButton.props.onClick();

    expect(onCancelConfirmation).toHaveBeenCalledTimes(1);
    expect(readyHtml).toContain("Passer cette fois");
  });

  it("routes non-mutating Coach and Planning options without selecting a repair", () => {
    const coach = recoveryOption(RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP);
    const planning = recoveryOption(RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL);
    const callbacks = {
      onOpenCoach: vi.fn(),
      onOpenPlanning: vi.fn(),
      onSelectOption: vi.fn(),
    };
    const tree = expandedContent(readyViewModel([coach, planning]), callbacks);
    const coachButton = findAll(
      tree,
      (node) => node.type === "button" && node.props["data-recovery-option-type"] === RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP
    )[0];
    const planningButton = findAll(
      tree,
      (node) => node.type === "button" && node.props["data-recovery-option-type"] === RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL
    )[0];

    coachButton.props.onClick();
    planningButton.props.onClick();

    expect(callbacks.onOpenCoach).toHaveBeenCalledWith(coach);
    expect(callbacks.onOpenPlanning).toHaveBeenCalledWith(planning);
    expect(callbacks.onSelectOption).not.toHaveBeenCalled();
  });

  it("applying state disables actions and renders loading copy", () => {
    const html = renderSheet({ pending: true });
    const pendingButton = RecoveryOptionButton({
      option: recoveryOption(RECOVERY_OPTION_TYPE.MOVE_TOMORROW),
      pending: true,
    });

    expect(html).toContain("Application de l’ajustement");
    expect(html).toContain("disabled");
    expect(pendingButton.props.disabled).toBe(true);
  });

  it("success state renders the applied summary", () => {
    const html = renderSheet({
      result: {
        ok: true,
        summary: "Déplace ce bloc demain à 09:00.",
      },
    });

    expect(html).toContain("Bloc ajusté");
    expect(html).toContain("Déplace ce bloc demain à 09:00.");
    expect(html).toContain("Retour à Home");
  });

  it("error state renders safe non-mutating copy", () => {
    const html = renderSheet({
      result: {
        ok: false,
        errorCode: "repair_failed",
      },
    });

    expect(html).toContain("La récupération n’a pas pu être appliquée.");
    expect(html).toContain("Aucun changement n’a été appliqué.");
    expect(html).toContain("repair_failed");
  });

  it("does not render vague forbidden copy", () => {
    const option = recoveryOption(RECOVERY_OPTION_TYPE.SKIP_ONCE);
    const confirmation = buildRecoverySheetViewModel({
      open: true,
      recoveryContext: RECOVERY_CONTEXT.MISSED,
      options: [option],
      confirmingOptionId: option.id,
    });
    const html = [
      renderSheet(),
      renderToStaticMarkup(<RecoverySheetContent viewModel={confirmation} />),
      renderSheet({ result: { ok: true, summary: "Bloc récupéré." } }),
      renderSheet({ result: { ok: false, errorCode: "repair_failed" } }),
    ].join(" ");

    expect(html).not.toMatch(new RegExp("fric" + "tion", "i"));
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    const button = RecoverySheetCloseButton({ onClose });

    button.props.onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders accessibility labels and status roles", () => {
    const readyHtml = renderSheet();
    const successHtml = renderSheet({ result: { ok: true, summary: "Bloc récupéré." } });
    const errorHtml = renderSheet({ result: { ok: false, errorCode: "repair_failed" } });

    expect(readyHtml).toContain('role="dialog"');
    expect(readyHtml).toContain('aria-modal="true"');
    expect(readyHtml).toContain('aria-label="Fermer la récupération"');
    expect(readyHtml).toContain('aria-label="Reporter ce soir. Déplace ce bloc aujourd’hui à 18:00."');
    expect(successHtml).toContain('role="status"');
    expect(errorHtml).toContain('role="alert"');
  });

  it("builds confirmation view state from the view model", () => {
    const option = recoveryOption(RECOVERY_OPTION_TYPE.SKIP_ONCE);
    const viewModel = buildRecoverySheetViewModel({
      open: true,
      recoveryContext: RECOVERY_CONTEXT.MISSED,
      options: [option],
      confirmingOptionId: option.id,
    });

    expect(viewModel.state).toBe(RECOVERY_SHEET_STATE.CONFIRMATION);
    expect(renderToStaticMarkup(<RecoverySheetContent viewModel={viewModel} />)).toContain("Confirmer cet ajustement");
  });
});
