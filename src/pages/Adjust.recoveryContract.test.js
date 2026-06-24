import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Adjust from "./Adjust";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

const DATE_KEY = "2026-05-28";

function adjustData(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      {
        id: "outcome_main",
        type: "OUTCOME",
        title: "Système",
        categoryId: "cat_work",
      },
      {
        id: "action_focus",
        type: "PROCESS",
        planType: "ACTION",
        title: "Bloc profond",
        categoryId: "cat_work",
        parentId: "outcome_main",
        outcomeId: "outcome_main",
      },
    ],
    occurrences: [
      {
        id: "occ_missed",
        goalId: "action_focus",
        categoryId: "cat_work",
        outcomeId: "outcome_main",
        date: DATE_KEY,
        start: "09:00",
        slotKey: "09:00",
        durationMinutes: 30,
        status: "missed",
      },
    ],
    sessionHistory: [],
    ui: { selectedDateKey: DATE_KEY },
    ...overrides,
  };
}

describe("Adjust recovery integration contract", () => {
  it("opens recovery only before the primary concrete recommendation fallback", () => {
    const adjust = readSrc("pages/Adjust.jsx");
    const handlerStart = adjust.indexOf("const handlePrimaryRecommendationAction = useCallback(() => {");
    const handlerEnd = adjust.indexOf("const systemAnalysisSnapshot = useMemo", handlerStart);
    const handler = adjust.slice(handlerStart, handlerEnd);

    expect(adjust).toContain("resolveAdjustRecoveryRequest");
    expect(adjust).toContain("onOpenRecoverySheet");
    expect(handler).toContain("if (recoveryRequest && typeof onOpenRecoverySheet === \"function\")");
    expect(handler.indexOf("onOpenRecoverySheet(recoveryRequest)")).toBeLessThan(
      handler.indexOf("onAdjustAction?.(recommendation?.actionId")
    );
    expect(handler).toContain("if (opened) return;");
  });

  it("changes only the concrete recovery CTA and preserves general Ajuster routing", () => {
    const adjust = readSrc("pages/Adjust.jsx");
    const presentation = readSrc("features/adjust/adjustPresentationModel.js");

    expect(adjust).toContain('onClick={handlePrimaryRecommendationAction}');
    expect(adjust).toContain("buildAdjustPresentationModel");
    expect(adjust).toContain("adjustPresentation.primaryAction.label");
    expect(presentation).toContain('label: "Réparer ce bloc"');
    expect(presentation).toContain('kind: "recommendation"');
    expect(adjust).toContain("<SystemAnalysisCommandSheet");
    expect(adjust).toContain("AdjustActionsDetail");
    expect(adjust).toContain("onAction={onAdjustAction}");
  });

  it("renders Réparer ce bloc for a concrete recoverable Ajuster recommendation", () => {
    const html = renderToStaticMarkup(React.createElement(Adjust, { data: adjustData() }));

    expect(html).toContain("Réparer ce bloc");
    expect(html).toContain("Tu choisis la réparation avant toute modification.");
  });

  it("keeps the normal Ajuster CTA when no concrete occurrence can be repaired", () => {
    const html = renderToStaticMarkup(
      React.createElement(Adjust, {
        data: adjustData({
          occurrences: [],
        }),
      })
    );

    expect(html).not.toContain("Réparer ce bloc");
  });
});
