import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildAdjustSystemSignalPreview } from "../features/adjust/adjustSystemSignalPreviewModel";
import Adjust from "./Adjust";

const ACTIVE_DATE = "2026-05-20";

function data(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [{ id: "goal_focus", type: "PROCESS", title: "Focus profond", categoryId: "cat_work", durationMinutes: 45 }],
    occurrences: [],
    ui: { selectedDateKey: ACTIVE_DATE },
    ...overrides,
  };
}

describe("Adjust system signal preview", () => {
  it("promotes the primary attention signal into the decision card", () => {
    const html = renderToStaticMarkup(
      <Adjust
        data={data({
          occurrences: [
            { id: "occ_blocked", goalId: "goal_focus", date: ACTIVE_DATE, start: "09:00", status: "planned" },
          ],
          sessionHistory: [
            {
              id: "history_blocked",
              occurrenceId: "occ_blocked",
              dateKey: ACTIVE_DATE,
              state: "ended",
              endedReason: "blocked",
            },
          ],
        })}
      />
    );

    expect(html).toContain("adjust-primary-decision");
    expect(html).toContain("CE QUI BLOQUE");
    expect(html).toContain("Bloc bloqué");
    expect(html).toContain("1 bloc bloqué aujourd’hui.");
    expect(html).toContain("Réparer ce bloc");
    expect(html).not.toContain("SIGNAL SYSTÈME");
    expect(html).not.toContain("adjust-system-signal-preview");
  });

  it("does not render a fake preview when no signal is available", () => {
    const html = renderToStaticMarkup(<Adjust data={data()} />);

    expect(html).not.toContain("adjust-system-signal-preview");
    expect(html).not.toContain("SIGNAL SYSTÈME");
  });

  it("shows only attention or critical previews", () => {
    expect(buildAdjustSystemSignalPreview({ severity: "info", title: "Info" })).toBeNull();
    expect(buildAdjustSystemSignalPreview({ severity: "critical", title: "Critique", message: "Agir court." }))
      .toMatchObject({
        tone: "critical",
        title: "Critique",
      });
  });
});
