import { describe, it, expect } from "vitest";
import { computeStats, selectOccurrencesInRange } from "./metrics";
import { buildReport, exportReportToCSV } from "./reporting";

describe("reporting", () => {
  const state = {
    categories: [
      { id: "c1", name: "Cat A" },
      { id: "c2", name: "Cat B" },
    ],
    goals: [
      { id: "g1", title: "Action 1", categoryId: "c1" },
      { id: "g2", title: "Action 2", categoryId: "c1" },
      { id: "g3", title: "Action 3", categoryId: "c2" },
    ],
    occurrences: [
      { id: "o1", date: "2026-02-01", goalId: "g1", status: "done" },
      { id: "o2", date: "2026-02-01", goalId: "g2", status: "missed" },
      { id: "o3", date: "2026-02-01", goalId: "g3", status: "planned" },
      { id: "o4", date: "2026-02-02", goalId: "g3", status: "canceled" },
    ],
  };

  it("report totals match metrics", () => {
    const fromKey = "2026-02-01";
    const toKey = "2026-02-02";
    const list = selectOccurrencesInRange(state, fromKey, toKey);
    const stats = computeStats(list);
    const report = buildReport(state, { fromKey, toKey });
    expect(report.totals.expected).toBe(stats.expected);
    expect(report.totals.done).toBe(stats.done);
    expect(report.totals.missed).toBe(stats.missed);
    expect(report.totals.canceled).toBe(stats.canceled);
    expect(report.totals.planned).toBe(stats.planned);
  });

  it("exports CSV with headers and data", () => {
    const report = buildReport(state, { fromKey: "2026-02-01", toKey: "2026-02-02" });
    const { dailyCsv, goalsCsv } = exportReportToCSV(report);
    const dailyLines = dailyCsv.split("\n");
    const goalLines = goalsCsv.split("\n");

    expect(dailyLines[0]).toBe("date,expected,done,missed,canceled,planned,scorePct");
    expect(goalLines[0]).toBe("goalId,title,categoryId,expected,done,missed,canceled,planned,scorePct");
    expect(dailyCsv).toContain("2026-02-01,3,1,1,0,1,33");
    expect(goalsCsv).toContain("g1,Action 1,c1,1,1,0,0,0,100");
  });

  it("filters by categoryId and goalIds", () => {
    const catReport = buildReport(state, { fromKey: "2026-02-01", toKey: "2026-02-02", categoryId: "c1" });
    expect(catReport.totals.expected).toBe(2);
    expect(catReport.totals.done).toBe(1);
    expect(catReport.totals.missed).toBe(1);

    const goalReport = buildReport(state, {
      fromKey: "2026-02-01",
      toKey: "2026-02-02",
      goalIds: ["g3"],
    });
    expect(goalReport.totals.expected).toBe(2);
    expect(goalReport.totals.canceled).toBe(1);
  });
});
