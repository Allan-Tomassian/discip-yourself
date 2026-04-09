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
    const protocol = readSrc("features/action-protocol/actionProtocol.js");

    expect(session).toContain("deriveActionProtocol({");
    expect(session).toContain("actionProtocol={actionProtocol}");
    expect(focusView).toContain('data-testid="session-action-protocol"');
    expect(focusView).toContain('label: "Pourquoi"');
    expect(focusView).toContain('label: "Départ"');
    expect(focusView).toContain('label: "Si blocage"');
    expect(focusView).toContain('label: "Réussi quand"');
    expect(protocol).toContain('return bestScore > 0 ? bestType : "generic"');
  });
});
