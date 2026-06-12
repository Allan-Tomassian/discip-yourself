import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("session action protocol contract", () => {
  it("wires the local action protocol into the existing session surface", () => {
    const session = readSrc("pages/Session.jsx");
    const focusView = readSrc("components/session/FocusSessionView.jsx");
    const deck = readSrc("components/session/SessionGuidedDeck.jsx");
    const protocol = readSrc("features/action-protocol/actionProtocol.js");

    expect(session).toContain("deriveActionProtocol({");
    expect(session).toContain("actionProtocol={effectiveActionProtocol}");
    expect(session).toContain("guidedPlan={");
    expect(session).toContain("guidedMode={effectiveLaunchMode === \"guided\" ? guidedMode : \"\"}");
    expect(session).toContain("showTools={");
    expect(focusView).toContain('data-testid="session-action-protocol"');
    expect(focusView).toContain('data-testid="session-guided-preview-actions"');
    expect(deck).toContain('data-testid="session-guided-plan"');
    expect(focusView).toContain('label: "Pourquoi"');
    expect(focusView).toContain('label: "Départ"');
    expect(focusView).toContain('label: "Si blocage"');
    expect(focusView).toContain('label: "Réussi quand"');
    expect(focusView).toContain("sessionDockToolsButton");
    expect(protocol).toContain('return bestScore > 0 ? bestType : "generic"');
  });

  it("keeps the execution chamber to one dominant runtime action per state", () => {
    const focusView = readSrc("components/session/FocusSessionView.jsx");
    const launchView = readSrc("components/session/SessionLaunchView.jsx");
    const styles = readSrc("features/session/session.css");

    expect(launchView).toContain("Protège ce bloc.");
    expect(launchView).toContain("Démarrer le bloc");
    expect(focusView).toContain('label: "Terminer le bloc"');
    expect(focusView).toContain('label: "Reprendre"');
    expect(focusView).toContain("Valider la session");
    expect(focusView).toContain("Retour à Home");
    expect(focusView).not.toContain("Retour à Today");
    expect(focusView).not.toContain("Reporter sans abandonner");
    expect(focusView).toContain("Démarrer le guidage");
    expect(focusView).not.toContain("Lancer en mode guidé");
    expect(focusView).not.toContain("Mode guidé");
    expect(focusView).toContain("sessionDockDangerAction");
    expect(styles).toContain(".sessionRuntimeStack.is-guided");
    expect(styles).toContain("--session-guided");
    expect(styles).toContain("--session-attention");
    expect(styles).toContain(".sessionDockDangerAction");
    expect(styles).toContain(".sessionDockPrimaryAction--attention");
  });
});
