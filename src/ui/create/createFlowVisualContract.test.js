import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("create flow visual contract", () => {
  it("keeps the canonical create host on AppUI form sections instead of the modal host", () => {
    const pageSource = readSrc("pages/CreateItem.jsx");
    const screenSource = readSrc("features/create-item/CreateItemScreens.jsx");
    const menuSource = readSrc("components/navigation/LovableCreateMenu.jsx");
    const copySource = readSrc("copy/productCopy.js");
    const onboardingSource = readSrc("pages/Onboarding.jsx");
    const firstRunFlowSource = readSrc("features/first-run/FirstRunFlow.jsx");
    const firstRunStepScreenSource = readSrc("features/first-run/FirstRunStepScreen.jsx");
    const firstRunIntroSource = readSrc("features/first-run/FirstRunIntroScreen.jsx");
    const firstRunWhySource = readSrc("features/first-run/FirstRunWhyScreen.jsx");
    const firstRunSignalsSource = readSrc("features/first-run/FirstRunSignalsScreen.jsx");

    expect(pageSource).toContain('pageId="create-item"');
    expect(pageSource).toContain("normalizeCreateItemDraft");
    expect(screenSource).toContain("ActionManualCreateScreen");
    expect(screenSource).toContain("OutcomeManualCreateScreen");
    expect(screenSource).toContain("GuidedCreateScreen");
    expect(screenSource).toContain("Validation simple");
    expect(screenSource).toContain("Options avancées");
    expect(screenSource).toContain("AppFormSection");
    expect(screenSource).toContain("AppStickyFooter");
    expect(screenSource).toContain("AppInlineMetaCard");
    expect(menuSource).toContain("CREATE_MENU_COPY.promptTitle");
    expect(menuSource).toContain("CREATE_MENU_COPY.inputPlaceholder");
    expect(menuSource).toContain("CREATE_MENU_COPY.submitLabel");
    expect(menuSource).toContain("CREATE_MENU_COPY.previewActionLabel");
    expect(menuSource).toContain("CREATE_MENU_COPY.previewGoalLabel");
    expect(menuSource).toContain("CREATE_MENU_COPY.previewAdjustLabel");
    expect(menuSource).toContain("CREATE_MENU_COPY.previewCreateLabel");
    expect(menuSource).not.toContain("onChooseObjective");
    expect(menuSource).not.toContain("onChooseAction");
    expect(menuSource).not.toContain("onChoosePlan");
    expect(copySource).toContain('promptTitle: "Qu’est-ce que tu veux faire avancer ?"');
    expect(copySource).toContain('submitLabel: "Continuer"');
    expect(copySource).toContain('previewActionLabel: "Action"');
    expect(copySource).toContain('previewGoalLabel: "Objectif"');
    expect(copySource).toContain('previewAdjustLabel: "Ajuster"');
    expect(copySource).toContain('previewCreateLabel: "Créer"');
    expect(copySource).not.toContain('actionLabel: "Créer une action"');
    expect(copySource).not.toContain('objectiveLabel: "Créer un objectif"');
    expect(copySource).not.toContain('planLabel: "Passer en mode Plan"');
    expect(copySource).not.toContain('microLabel:');
    expect(onboardingSource).toContain("FirstRunFlow");
    expect(firstRunFlowSource).toContain("ChoiceCard");
    expect(firstRunFlowSource).toContain("AppStickyFooter");
    expect(firstRunStepScreenSource).toContain("firstRunShell");
    expect(firstRunStepScreenSource).toContain("firstRunFooterSurface");
    expect(firstRunStepScreenSource).toContain('eyebrow = "Premiers pas"');
    expect(firstRunStepScreenSource).not.toContain("createFlowScope");
    expect(firstRunStepScreenSource).not.toContain("createFlowHeader");
    expect(firstRunIntroSource).toContain('badge="1/5"');
    expect(firstRunWhySource).toContain('badge="2/5"');
    expect(firstRunSignalsSource).toContain('badge="3/5"');
    expect(onboardingSource).not.toContain("CreateChoiceCard");
    expect(onboardingSource).not.toContain("CreateButton");
    expect(pageSource).not.toContain("CreateFlowModal");
  });

  it("removes the legacy modal host and duplicate create primitives from the repo", () => {
    const legacyPaths = [
      "components/CategoryGateModal.jsx",
      "ui/create/CreateFlowModal.jsx",
      "ui/create/CreateFormPrimitives.jsx",
      "ui/create/FlowShell.jsx",
      "ui/create/CreateSection.jsx",
      "creation/creationDraft.js",
      "creation/createFlowController.js",
      "pages/CreateV2Outcome.jsx",
      "pages/CreateV2OutcomeNextAction.jsx",
      "pages/CreateV2HabitType.jsx",
      "pages/CreateV2LinkOutcome.jsx",
      "pages/CreateV2PickCategory.jsx",
      "pages/CreateV2Habits.jsx",
      "pages/CreateV2HabitOneOff.jsx",
      "pages/CreateV2HabitRecurring.jsx",
      "pages/CreateV2HabitAnytime.jsx",
    ];

    for (const relPath of legacyPaths) {
      expect(fs.existsSync(path.join(SRC_ROOT, relPath))).toBe(false);
    }

    expect(readSrc("pages/CreateItem.jsx")).not.toContain("../components/UI");
    expect(readSrc("pages/Onboarding.jsx")).not.toContain("../components/UI");
    expect(readSrc("pages/Onboarding.jsx")).not.toContain("../ui/create/CreateFormPrimitives");
  });
});
