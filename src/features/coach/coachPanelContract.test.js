import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("coach panel contract", () => {
  it("mounts the global coach trigger and keeps the panel as the only active coach surface", () => {
    const app = readSrc("App.jsx");

    expect(app).toContain("const [coachState, setCoachState] = useState({");
    expect(app).toContain("showCoachEntry && !hasCoachBlockingOverlay ? (");
    expect(app).toContain(
      "className={`coachFab${showBottomRail ? \" has-rail\" : \"\"}${coachOpen ? \" is-open\" : \"\"}${coachEntryMode === \"reduced\" ? \" is-reduced\" : \"\"}`}"
    );
    expect(app).toContain("data-testid=\"coach-fab\"");
    expect(app).toContain("<span>Coach</span>");
    expect(app).toContain("aria-label=\"Coach\"");
    expect(app).toContain("onPointerDown={handleCoachFabPointerDown}");
    expect(app).toContain("<CoachPanel");
    expect(app).toContain("surfaceTab={tab}");
    expect(app).toContain("requestedMode={coachState.mode}");
    expect(app).not.toContain("<CoachChat");
    expect(app).not.toContain('tab === "coach-chat"');
  });

  it("keeps a single shared coach conversation surface without panel/page divergence", () => {
    const coachPanel = readSrc("features/coach/CoachPanel.jsx");

    expect(coachPanel).toContain("conversationMode");
    expect(coachPanel).toContain("onOpenAssistantCreate");
    expect(coachPanel).toContain("onOpenCreatedView");
    expect(coachPanel).toContain("mode: conversationMode === \"plan\" ? \"plan\" : \"free\"");
    expect(coachPanel).toContain("coachConversationRail");
    expect(coachPanel).toContain("setActiveConversationId");
    expect(coachPanel).toContain("archiveConversation");
    expect(coachPanel).toContain("Discuter librement, puis passer en mode Plan quand tu veux construire.");
    expect(coachPanel).toContain("toggleCoachPlanMode");
    expect(coachPanel).toContain("coachModeBadge");
    expect(coachPanel).toContain("Objectif ·");
    expect(coachPanel).not.toContain("Direction ·");
    expect(coachPanel).toContain('sourceSurface: "coach"');
    expect(coachPanel).not.toContain("Appliquer le brouillon");
    expect(coachPanel).not.toContain("Brouillon proposé");
    expect(coachPanel).not.toContain("onOpenStructuring");
    expect(coachPanel).not.toContain("Ouvrir le Coach");
    expect(coachPanel).not.toContain('setTab?.("coach-chat")');
    expect(coachPanel).not.toContain("Coach prêt");
    expect(coachPanel).not.toContain(">Conversations<");
  });
});
