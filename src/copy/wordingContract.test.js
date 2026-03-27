import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ANALYSIS_COPY, MARKETING_COPY, SURFACE_LABELS } from "./productCopy";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("product wording contract", () => {
  it("publishes the canonical visible surface names", () => {
    expect(SURFACE_LABELS.today).toBe("Today");
    expect(SURFACE_LABELS.planning).toBe("Planification");
    expect(SURFACE_LABELS.library).toBe("Bibliothèque");
    expect(SURFACE_LABELS.pilotage).toBe("Pilotage");
    expect(SURFACE_LABELS.coach).toBe("Coach");
    expect(SURFACE_LABELS.journal).toBe("Journal");
    expect(MARKETING_COPY.essentialPlan).toBe("Accès essentiel");
    expect(ANALYSIS_COPY.coachAnalysis).toBe("Analyse du Coach");
  });

  it("removes legacy wording from critical user-facing surfaces", () => {
    const files = [
      "components/navigation/MainDrawer.jsx",
      "components/TopNav.jsx",
      "pages/Journal.jsx",
      "pages/Account.jsx",
      "pages/Subscription.jsx",
      "components/PaywallModal.jsx",
      "auth/Login.jsx",
      "auth/Signup.jsx",
      "auth/ForgotPassword.jsx",
      "auth/ResetPassword.jsx",
      "auth/VerifyEmail.jsx",
      "components/today/TodayHero.jsx",
      "pages/Home.jsx",
      "features/manualAi/displayState.js",
      "components/planning/PlanningCoachCard.jsx",
      "ui/create/CreateFlowModal.jsx",
      "pages/CreateV2Outcome.jsx",
      "pages/CreateV2LinkOutcome.jsx",
      "components/PlusExpander.jsx",
    ];
    const legacyPatterns = [
      /Coach IA/,
      /Analyse IA/,
      /Note du jour/,
      /\bUsername\b/,
      /Passer Premium/,
      /Version gratuite/,
      /objectif avancé/i,
      /\bCreer\b/,
      /reinitialisation/,
      /Mot de passe oublie/,
    ];

    const offenders = files.flatMap((file) => {
      const source = readSrc(file);
      return legacyPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${file}:${pattern}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps navigation and planning copy aligned with the canon", () => {
    expect(readSrc("components/navigation/MainDrawer.jsx")).toContain("SURFACE_LABELS.journal");
    expect(readSrc("components/TopNav.jsx")).toContain("SURFACE_LABELS.planning");
    expect(readSrc("pages/Planning.jsx")).toContain("headerTitle={SURFACE_LABELS.planning}");
  });
});
