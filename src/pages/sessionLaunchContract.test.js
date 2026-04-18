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
    expect(app).toContain("onOpenPaywall={openPaywall}");
    expect(app).toContain("isPremiumPlan={isPremiumPlan}");
    expect(app).toContain("ensureResolvedEntitlement={ensureResolved}");
    expect(app).toContain("entitlementAccess={entitlementAccess}");
    expect(app).not.toContain("setSessionLaunchState((current) => (current ? null : current))");
    expect(home).toContain("onOpenSession({");
    expect(timeline).toContain("onOpenSession");
    expect(coach).toContain("onOpenSession,");
    expect(controller).toContain("onOpenSession");
    expect(insights).toContain("onOpenSession");
  });

  it("wires ready, preparing, and guided spatial preview states into the existing session shell", () => {
    const session = readSrc("pages/Session.jsx");
    const launchView = readSrc("components/session/SessionLaunchView.jsx");
    const adjustSheet = readSrc("components/session/SessionAdjustSheet.jsx");
    const toolsSheet = readSrc("components/session/SessionToolsSheet.jsx");
    const runbook = readSrc("features/session/sessionRunbook.js");
    const tools = readSrc("features/session/sessionTools.js");

    expect(session).toContain('launchPhase === "ready"');
    expect(session).toContain('launchPhase === "checking_access"');
    expect(session).toContain('launchPhase === "preparing"');
    expect(session).toContain('launchPhase === "guided_locked"');
    expect(session).toContain('launchPhase === "guided_degraded"');
    expect(session).toContain('launchPhase === "access_error"');
    expect(session).toContain('phase: "guided_preview"');
    expect(session).toContain('phase: "guided_active"');
    expect(session).toContain("const isPrelaunchPhase = shouldShowLaunchSurface;");
    expect(session).toContain("headerTitle={null}");
    expect(session).toContain("headerSubtitle={null}");
    expect(session).toContain('data-testid="session-top-chrome"');
    expect(session).toContain("sessionScreen--immersive");
    expect(session).toContain("<SessionLaunchView");
    expect(session).toContain("buildSessionRunbookV1({");
    expect(session).toContain("requestAiSessionGuidance({");
    expect(session).toContain("SessionAdjustSheet");
    expect(session).toContain("SessionToolsSheet");
    expect(session).toContain("sessionToolPlan");
    expect(session).toContain("sessionToolState");
    expect(session).toContain("guidedSpatialState");
    expect(session).toContain("readSessionPremiumPrepareCacheEntry({");
    expect(session).toContain("sessionPremiumPrepareCacheV1");
    expect(launchView).toContain('data-testid="session-launch-ready"');
    expect(launchView).toContain('phase === "checking_access" ? "session-launch-checking" : "session-launch-preparing"');
    expect(launchView).toContain('data-testid="session-launch-locked"');
    expect(launchView).toContain('data-testid="session-launch-degraded"');
    expect(launchView).toContain('data-testid="session-launch-access-error"');
    expect(launchView).toContain("Séance prête");
    expect(launchView).toContain("Vérification en cours");
    expect(launchView).toContain("Préparation en cours");
    expect(launchView).toContain("Réessayer");
    expect(launchView).toContain("Découvrir Premium");
    expect(launchView).toContain("Passer en standard");
    expect(launchView).not.toContain("Plan prêt");
    expect(launchView).toContain("Session standard");
    expect(launchView).toContain("CoachAssistIcon");
    expect(launchView).not.toContain("Runbook prêt");
    expect(adjustSheet).toContain('placement="bottom"');
    expect(toolsSheet).toContain('data-testid="session-tools-sheet"');
    expect(tools).toContain("buildSessionToolPlan");
    expect(adjustSheet).not.toContain("ChoiceCard");
    expect(runbook).toContain('source: "deterministic_fallback"');
  });

  it("replaces standard action protocol with a compact guided block when launch mode is guided", () => {
    const session = readSrc("pages/Session.jsx");
    const focusView = readSrc("components/session/FocusSessionView.jsx");
    const deck = readSrc("components/session/SessionGuidedDeck.jsx");

    expect(session).toContain('phase: "guided_active"');
    expect(session).toContain("guidedMode={effectiveLaunchMode === \"guided\" ? guidedMode : \"\"}");
    expect(focusView).toContain('data-testid="session-guided-preview-actions"');
    expect(deck).toContain('data-testid="session-guided-plan"');
    expect(deck).toContain("Plan du bloc");
    expect(focusView).toContain("Réajuster");
    expect(focusView).toContain("Outils");
    expect(deck).toContain('data-testid="session-guided-active-step-notice"');
  });
});
