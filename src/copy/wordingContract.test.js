import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ANALYSIS_COPY,
  MAIN_PAGE_COPY,
  MARKETING_COPY,
  SURFACE_LABELS,
  TAB_COPY,
} from "./productCopy";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("product wording contract", () => {
  it("publishes the canonical visible surface names", () => {
    expect(SURFACE_LABELS.today).toBe("Aujourd'hui");
    expect(SURFACE_LABELS.planning).toBe("Planning");
    expect(SURFACE_LABELS.library).toBe("Objectifs");
    expect(SURFACE_LABELS.pilotage).toBe("Analyses");
    expect(SURFACE_LABELS.coach).toBe("Coach");
    expect(SURFACE_LABELS.journal).toBe("Journal");
    expect(MARKETING_COPY.essentialPlan).toBe("Accès essentiel");
    expect(ANALYSIS_COPY.localDiagnostic).toBe("Lecture locale");
    expect(ANALYSIS_COPY.coachAnalysis).toBe("Lecture du coach");
    expect(MAIN_PAGE_COPY.today.orientation).toBe("Ton prochain pas utile, clairement mis en avant.");
    expect(MAIN_PAGE_COPY.planning.orientation).toBe("Ta feuille de route d'exécution.");
    expect(MAIN_PAGE_COPY.library.orientation).toBe("Une structure par objectifs avec les actions liées en dessous.");
    expect(MAIN_PAGE_COPY.pilotage.orientation).toBe("Ta trajectoire cette semaine.");
    expect(TAB_COPY.timeline).toBe("Planning");
    expect(TAB_COPY.insights).toBe("Analyses");
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
    expect(readSrc("components/navigation/LovableTabBar.jsx")).toContain("label: TAB_COPY.timeline");
    expect(readSrc("components/navigation/LovableTabBar.jsx")).toContain("label: TAB_COPY.objectives");
    expect(readSrc("pages/Timeline.jsx")).toContain("headerTitle={TIMELINE_SCREEN_COPY.title}");
  });
});
