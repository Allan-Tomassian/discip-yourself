import { describe, expect, it } from "vitest";
import { buildTimelineDateStrip, getTimelineDisplayTime } from "./timelineDisplayModel";

describe("timeline display model", () => {
  it("labels missing and anytime occurrences as unscheduled", () => {
    expect(getTimelineDisplayTime()).toBe("À planifier");
    expect(getTimelineDisplayTime({ startTime: "", occurrence: { noTime: true } })).toBe("À planifier");
    expect(
      getTimelineDisplayTime({
        startTime: "00:00",
        occurrence: { start: "00:00", slotKey: "00:00", noTime: true },
        goal: { timeMode: "FIXED", startTime: "00:00" },
      })
    ).toBe("À planifier");
    expect(
      getTimelineDisplayTime({
        occurrence: { start: "00:00", slotKey: "00:00" },
        goal: { timeMode: "NONE", startTime: "" },
      })
    ).toBe("À planifier");
  });

  it("keeps explicit fixed midnight as 00:00", () => {
    expect(
      getTimelineDisplayTime({
        occurrence: { start: "00:00", slotKey: "00:00" },
        goal: { timeMode: "FIXED", startTime: "00:00" },
      })
    ).toBe("00:00");
    expect(
      getTimelineDisplayTime({
        startTime: "00:00",
        occurrence: { start: "00:00", slotKey: "00:00" },
        goal: { schedule: { timeMode: "FIXED", timeSlots: ["00:00"] } },
      })
    ).toBe("00:00");
  });

  it("builds a compact seven day strip around the selected date", () => {
    const days = buildTimelineDateStrip("2026-05-18", "2026-05-18");

    expect(days).toHaveLength(7);
    expect(days.map((day) => day.dateKey)).toEqual([
      "2026-05-15",
      "2026-05-16",
      "2026-05-17",
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
      "2026-05-21",
    ]);
    expect(days.filter((day) => day.isSelected)).toHaveLength(1);
    expect(days.find((day) => day.isSelected)?.dayNumber).toBe("18");
    expect(days.filter((day) => day.isToday)).toHaveLength(1);
  });
});
