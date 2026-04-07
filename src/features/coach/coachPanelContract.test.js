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
    const coachPanel = readSrc("features/coach/CoachPanel.jsx");
    const coachController = readSrc("features/coach/coachPanelController.js");

    expect(coachPanel).toContain("conversationMode");
    expect(coachPanel).toContain("onOpenAssistantCreate");
    expect(coachPanel).toContain("onOpenCreatedView");
    expect(coachPanel).toContain("coachConversationRail");
    expect(coachPanel).toContain("setActiveConversationId");
    expect(coachPanel).toContain("archiveConversation");
    expect(coachPanel).toContain("Discuter librement, puis passer en mode Plan quand tu veux construire.");
    expect(coachPanel).toContain("toggleCoachPlanMode");
    expect(coachPanel).toContain("coachModeBadge");
    expect(coachPanel).not.toContain("Direction ·");
    expect(coachPanel).not.toContain("Appliquer le brouillon");
    expect(coachPanel).not.toContain("Brouillon proposé");
    expect(coachPanel).not.toContain("onOpenStructuring");
    expect(coachPanel).not.toContain("Ouvrir le Coach");
    expect(coachPanel).not.toContain('setTab?.("coach-chat")');
    expect(coachPanel).not.toContain("Coach prêt");
    expect(coachPanel).not.toContain(">Conversations<");

    expect(coachController).toContain("conversationUseCase");
    expect(coachController).toContain("const effectiveMode = conversationMode === \"plan\" ? \"plan\" : \"free\";");
    expect(coachController).toContain('locale: "fr-FR"');
    expect(coachController).toContain("useCase: effectiveUseCase");
    expect(coachController).toContain("life_plan");
    expect(coachController).toContain('sourceSurface: "coach"');
  });
});
