import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("session launch contract", () => {
  it("centralizes session opening through app-level launch handoff", () => {
    const app = readSrc("App.jsx");
    const home = readSrc("pages/Home.jsx");
    const timeline = readSrc("pages/Timeline.jsx");
    const coach = readSrc("pages/Coach.jsx");
    const controller = readSrc("features/coach/coachPanelController.js");
    const insights = readSrc("pages/Insights.jsx");

    expect(app).toContain("const openSessionSurface = useCallback(");
    expect(app).toContain('sourceSurface: "today"');
    expect(app).toContain('sourceSurface: "timeline"');
    expect(app).toContain('sourceSurface: "coach"');
    expect(app).toContain('sourceSurface: "insights"');
    expect(app).toContain("sessionLaunchState={sessionLaunchState}");
    expect(app).not.toContain("setSessionLaunchState((current) => (current ? null : current))");
    expect(home).toContain("onOpenSession({");
    expect(timeline).toContain("onOpenSession");
    expect(coach).toContain("onOpenSession,");
    expect(controller).toContain("onOpenSession");
    expect(insights).toContain("onOpenSession");
  });

  it("wires ready, preparing, and plan ready states into the existing session shell", () => {
    const session = readSrc("pages/Session.jsx");
    const launchView = readSrc("components/session/SessionLaunchView.jsx");
    const adjustSheet = readSrc("components/session/SessionAdjustSheet.jsx");
    const runbook = readSrc("features/session/sessionRunbook.js");

    expect(session).toContain('launchPhase === "ready"');
    expect(session).toContain('launchPhase === "preparing"');
    expect(session).toContain('launchPhase === "plan_ready"');
    expect(session).toContain("const isPrelaunchPhase = shouldShowLaunchSurface;");
    expect(session).toContain("headerTitle={null}");
    expect(session).toContain("headerSubtitle={null}");
    expect(session).toContain('data-testid="session-top-chrome"');
    expect(session).toContain("sessionScreen--immersive");
    expect(session).toContain("<SessionLaunchView");
    expect(session).toContain("buildSessionRunbookV1({");
    expect(session).toContain("requestAiSessionGuidance({");
    expect(session).toContain("SessionAdjustSheet");
    expect(launchView).toContain('data-testid="session-launch-ready"');
    expect(launchView).toContain('data-testid="session-launch-preparing"');
    expect(launchView).toContain('data-testid="session-launch-plan-ready"');
    expect(launchView).toContain("Séance prête");
    expect(launchView).toContain("Préparation en cours");
    expect(launchView).toContain("Plan prêt");
    expect(launchView).toContain("Session standard");
    expect(launchView).toContain("CoachAssistIcon");
    expect(launchView).not.toContain("Runbook prêt");
    expect(adjustSheet).toContain('placement="bottom"');
    expect(adjustSheet).not.toContain("ChoiceCard");
    expect(runbook).toContain('source: "deterministic_fallback"');
  });

  it("replaces standard action protocol with a compact guided block when launch mode is guided", () => {
    const session = readSrc("pages/Session.jsx");
    const focusView = readSrc("components/session/FocusSessionView.jsx");

    expect(session).toContain('currentLaunchState?.phase === "launched_guided"');
    expect(focusView).toContain('data-testid="session-guided-plan"');
    expect(focusView).toContain("Plan du bloc");
    expect(focusView).toContain("Réajuster");
  });
});
