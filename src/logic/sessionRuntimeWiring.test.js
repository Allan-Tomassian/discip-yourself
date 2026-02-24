import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("session runtime wiring (SSoT)", () => {
  it("routes runtime session tab to Session screen", () => {
    const app = readSrc("App.jsx");
    expect(app).toContain('import Session from "./pages/Session";');
    expect(app).not.toContain('import SessionMVP from "./pages/SessionMVP";');
    expect(app).toContain('tab === "session" ? (');
    expect(app).toContain("<Session");
  });

  it("keeps SessionMVP as a thin compatibility wrapper", () => {
    const wrapper = readSrc("pages/SessionMVP.jsx");
    expect(wrapper).toContain('import Session from "./Session";');
    expect(wrapper).toContain("return <Session {...props} />;");
    expect(wrapper).not.toContain("setOccurrenceStatusById");
  });

  it("uses activeSession/sessionHistory model and avoids legacy activeSessionId/sessions writes", () => {
    const session = readSrc("pages/Session.jsx");
    expect(session).toContain("function startTimer()");
    expect(session).toContain("function pauseTimer()");
    expect(session).toContain("function resumeTimer()");
    expect(session).toContain("function endSession()");
    expect(session).toContain("function cancelSession()");
    expect(session).toContain("activeSession");
    expect(session).toContain("sessionHistory");
    expect(session).not.toContain("activeSessionId");
    expect(session).not.toContain("sessions:");
  });
});
