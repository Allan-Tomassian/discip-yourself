import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("Ajuster route contract", () => {
  it("renders the full Adjust diagnostic page from the adjust tab", () => {
    const app = readSrc("App.jsx");

    expect(app).toContain('import Adjust from "./pages/Adjust";');
    expect(app).toContain('tab === "adjust"');
    expect(app).toContain("<Adjust");
    expect(app).toContain("onAdjustAction={handleAdjustAction}");
    expect(app).toContain("onOpenRecoverySheet={openRecoverySheet}");
    expect(app).toContain('new Set(["today", "objectives", "timeline", "adjust", "coach"])');
  });

  it("does not use TodayAdjustmentSheet as the bottom-nav Ajuster destination", () => {
    const app = readSrc("App.jsx");
    const sheet = readSrc("components/today/TodayAdjustmentSheet.jsx");

    expect(sheet).toContain("export default function TodayAdjustmentSheet");
    expect(app).not.toContain('import TodayAdjustmentSheet from "./components/today/TodayAdjustmentSheet";');
    expect(app).not.toContain("adjustmentSheetOpen");
    expect(app).not.toContain("<TodayAdjustmentSheet");
  });

  it("keeps quick actions on safe destinations without direct schedule mutations", () => {
    const app = readSrc("App.jsx");
    const adjust = readSrc("pages/Adjust.jsx");

    expect(app).toContain('setTab("timeline")');
    expect(app).toContain("Simplifie ma journée en gardant seulement le prochain bloc utile.");
    expect(app).toContain("Réduis la charge de ma journée sans perdre l’action critique.");
    expect(app).toContain("Aide-moi à ajuster ma journée.");
    expect(adjust).toContain("Ces actions ouvrent Coach IA ou Planning. Elles ne modifient rien automatiquement.");
  });

  it("prioritizes the recommendation before secondary diagnostics", () => {
    const adjust = readSrc("pages/Adjust.jsx");
    const recommendationIndex = adjust.indexOf("adjustRecommendationCard adjustRecommendationCard--primary");
    const frictionIndex = adjust.indexOf('id="adjust-friction-title"');
    const trendIndex = adjust.indexOf("<TrendSnapshot trendSnapshot={trendSnapshot} />");

    expect(adjust).toContain("frictionSignals.slice(0, 2)");
    expect(adjust).toContain("adjustFrictionCard--preview");
    expect(recommendationIndex).toBeGreaterThan(-1);
    expect(frictionIndex).toBeGreaterThan(-1);
    expect(trendIndex).toBeGreaterThan(-1);
    expect(recommendationIndex).toBeLessThan(frictionIndex);
    expect(frictionIndex).toBeLessThan(trendIndex);
  });
});
