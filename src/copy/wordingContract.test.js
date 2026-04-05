import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ANALYSIS_COPY, MAIN_PAGE_COPY, MARKETING_COPY, SURFACE_LABELS } from "./productCopy";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("product wording contract", () => {
  it("publishes the canonical visible surface names", () => {
    expect(SURFACE_LABELS.today).toBe("Today");
    expect(SURFACE_LABELS.planning).toBe("Timeline");
    expect(SURFACE_LABELS.library).toBe("Objectives");
    expect(SURFACE_LABELS.pilotage).toBe("Insights");
    expect(SURFACE_LABELS.coach).toBe("Coach");
    expect(SURFACE_LABELS.journal).toBe("Journal");
    expect(MARKETING_COPY.essentialPlan).toBe("Accès essentiel");
    expect(ANALYSIS_COPY.localDiagnostic).toBe("Lecture locale");
    expect(ANALYSIS_COPY.coachAnalysis).toBe("Lecture IA locale");
    expect(MAIN_PAGE_COPY.today.orientation).toBe("Your next useful move, clearly surfaced.");
    expect(MAIN_PAGE_COPY.planning.orientation).toBe("Your roadmap to execution.");
    expect(MAIN_PAGE_COPY.library.orientation).toBe("Outcome-first structure with linked actions underneath.");
    expect(MAIN_PAGE_COPY.pilotage.orientation).toBe("Your trajectory this week.");
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
      "pages/CreateItem.jsx",
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
    expect(readSrc("components/navigation/LovableTabBar.jsx")).toContain('label: "Timeline"');
    expect(readSrc("components/navigation/LovableTabBar.jsx")).toContain('label: "Objectives"');
    expect(readSrc("pages/Timeline.jsx")).toContain('headerTitle="Timeline"');
  });
});
