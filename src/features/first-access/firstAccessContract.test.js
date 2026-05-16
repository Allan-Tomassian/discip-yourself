import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("first access auth shell contract", () => {
  it("keeps the auth premium shell scoped away from Today modules", () => {
    const files = [
      "features/first-access/FirstAccessShell.jsx",
      "features/first-access/AuthCommandSurface.jsx",
      "features/first-access/firstAccess.css",
      "auth/AuthGate.jsx",
      "auth/Welcome.jsx",
      "auth/Signup.jsx",
      "auth/Login.jsx",
      "auth/ForgotPassword.jsx",
      "auth/ResetPassword.jsx",
      "auth/VerifyEmail.jsx",
    ];

    for (const file of files) {
      const source = readSrc(file);
      expect(source).not.toContain("features/today");
      expect(source).not.toContain("components/today");
      expect(source).not.toContain("todayDataAdapter");
    }
  });

  it("exposes welcome plus the direct auth screens through the premium shell", () => {
    expect(readSrc("auth/authPaths.js")).toContain('AUTH_WELCOME_PATH = "/auth/welcome"');
    expect(readSrc("auth/AuthGate.jsx")).toContain('resolved.screen === "welcome"');
    expect(readSrc("auth/Welcome.jsx")).toContain('data-testid="auth-welcome-screen"');
    expect(readSrc("auth/Signup.jsx")).toContain('data-testid="auth-signup-screen"');
    expect(readSrc("auth/Login.jsx")).toContain('data-testid="auth-login-screen"');
  });
});
