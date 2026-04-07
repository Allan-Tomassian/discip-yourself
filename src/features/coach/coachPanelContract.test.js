import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("coach panel contract", () => {
  it("mounts coach as a dedicated primary tab surface and removes the legacy global trigger", () => {
    const app = readSrc("App.jsx");

    expect(app).toContain("const [coachState, setCoachState] = useState({");
    expect(app).toContain('tab === "coach" ? (');
    expect(app).toContain("<CoachPage");
    expect(app).toContain("requestedMode={coachState.mode}");
    expect(app).toContain("requestedConversationId={coachState.conversationId}");
    expect(app).not.toContain("data-testid=\"coach-fab\"");
    expect(app).not.toContain("<CoachPanel");
    expect(app).not.toContain("<CoachChat");
    expect(app).not.toContain('tab === "coach-chat"');
  });

  it("keeps a single shared coach conversation surface without panel/page divergence", () => {
    const coachPage = readSrc("pages/Coach.jsx");
    const coachController = readSrc("features/coach/coachPanelController.js");
    const workTray = readSrc("features/coach/CoachWorkTray.jsx");
    const composerMenu = readSrc("features/coach/CoachComposerMenu.jsx");
    const copy = readSrc("copy/productCopy.js");

    expect(coachPage).toContain("coachSurfaceTopbar");
    expect(coachPage).toContain("coachSurfaceModeToggle");
    expect(coachPage).toContain("<CoachWorkTray");
    expect(coachPage).toContain("<CoachComposerMenu");
    expect(coachPage).toContain("coachSurfaceDock");
    expect(coachPage).toContain("coachSurfaceComposerPlus");
    expect(coachPage).not.toContain('setTab("create-item")');
    expect(workTray).toContain("workTrayViewDraft");
    expect(workTray).toContain("workTrayReenter");
    expect(workTray).toContain("workTrayDismiss");
    expect(composerMenu).toContain("composerMenuAriaLabel");
    expect(composerMenu).toContain("structuringMenuDescription");
    expect(composerMenu).toContain("quickCreateMenuDescription");
    expect(copy).toContain('chatModeLabel: "Chat"');
    expect(copy).toContain('structuringModeLabel: "Structurer"');
    expect(copy).toContain('quickCreateLabel: "Créer vite"');

    expect(coachController).toContain("conversationUseCase");
    expect(coachController).toContain("const effectiveMode = conversationMode === \"plan\" ? \"plan\" : \"free\";");
    expect(coachController).toContain('locale: "fr-FR"');
    expect(coachController).toContain("useCase: effectiveUseCase");
    expect(coachController).toContain("life_plan");
    expect(coachController).toContain('sourceSurface: "coach"');
    expect(coachController).toContain("activeWorkIntent");
    expect(coachController).toContain("startStructuringIntent");
    expect(coachController).toContain("startQuickCreateIntent");
    expect(coachController).toContain("dismissWorkIntent");
    expect(coachController).not.toContain('setTab?.("coach-chat")');
  });
});
