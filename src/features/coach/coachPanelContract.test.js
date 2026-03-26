import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("coach panel contract", () => {
  it("mounts the global coach trigger and panel from App", () => {
    const app = readSrc("App.jsx");

    expect(app).toContain("const [coachOpen, setCoachOpen] = useState(false);");
    expect(app).toContain("const coachSurfaceTab = tab === \"coach-chat\" ? lastNonCoachTabRef.current : tab;");
    expect(app).toContain("className={`coachFab${showBottomRail ? \" has-rail\" : \"\"}${coachOpen ? \" is-open\" : \"\"}`}");
    expect(app).toContain("data-testid=\"coach-fab\"");
    expect(app).toContain("<span>Coach</span>");
    expect(app).toContain("<CoachPanel");
    expect(app).toContain("surfaceTab={coachSurfaceTab}");
    expect(app).toContain("sourceTab={coachSurfaceTab}");
  });

  it("keeps the dedicated coach route on the shared conversation surface", () => {
    const coachPage = readSrc("pages/CoachChat.jsx");
    const coachPanel = readSrc("features/coach/CoachPanel.jsx");

    expect(coachPage).toContain("useCoachConversationController");
    expect(coachPage).toContain("<CoachConversationSurface controller={controller} mode=\"page\" />");
    expect(coachPage).toContain("sourceTab = \"today\"");
    expect(coachPanel).toContain("coachConversationRail");
    expect(coachPanel).toContain("setActiveConversationId");
    expect(coachPanel).toContain("Conversations");
  });
});
