import { describe, expect, it } from "vitest";
import { EXECUTION_SURFACE_STATUS } from "../logic/executionStatus";
import {
  buildTimelineDateStrip,
  getTimelineDisplayTime,
  getTimelineStatusLabel,
  isTimelineNextFocusCandidate,
  resolveTimelineExecutionStatus,
  resolveTimelineTone,
} from "./timelineDisplayModel";

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

  it("labels and tones execution statuses honestly", () => {
    expect(getTimelineStatusLabel(EXECUTION_SURFACE_STATUS.ACTIVE)).toBe("En cours");
    expect(getTimelineStatusLabel(EXECUTION_SURFACE_STATUS.MISSED)).toBe("Manquée");
    expect(getTimelineStatusLabel("late")).toBe("En retard");
    expect(getTimelineStatusLabel(EXECUTION_SURFACE_STATUS.POSTPONED)).toBe("Reportée");
    expect(getTimelineStatusLabel(EXECUTION_SURFACE_STATUS.BLOCKED)).toBe("Bloquée");
    expect(getTimelineStatusLabel(EXECUTION_SURFACE_STATUS.REPORTED)).toBe("Signalée");

    expect(resolveTimelineTone(EXECUTION_SURFACE_STATUS.DONE)).toBe("execution");
    expect(resolveTimelineTone(EXECUTION_SURFACE_STATUS.ACTIVE)).toBe("execution");
    expect(resolveTimelineTone("late")).toBe("attention");
    expect(resolveTimelineTone(EXECUTION_SURFACE_STATUS.BLOCKED)).toBe("attention");
    expect(resolveTimelineTone(EXECUTION_SURFACE_STATUS.REPORTED)).toBe("attention");
    expect(resolveTimelineTone(EXECUTION_SURFACE_STATUS.POSTPONED)).toBe("attention");
    expect(resolveTimelineTone(EXECUTION_SURFACE_STATUS.MISSED)).toBe("attention");
    expect(resolveTimelineTone(EXECUTION_SURFACE_STATUS.PLANNED)).toBe("neutral");
  });

  it("derives blocked and reported planning status from session history", () => {
    const blocked = resolveTimelineExecutionStatus({
      occurrence: { id: "occ_blocked", date: "2026-05-20", status: "planned" },
      sessionHistory: [
        {
          id: "history_blocked",
          occurrenceId: "occ_blocked",
          dateKey: "2026-05-20",
          state: "ended",
          endedReason: "blocked",
        },
      ],
    });
    const reported = resolveTimelineExecutionStatus({
      occurrence: { id: "occ_reported", date: "2026-05-20", status: "planned" },
      sessionHistory: [
        {
          id: "history_reported",
          occurrenceId: "occ_reported",
          dateKey: "2026-05-20",
          state: "ended",
          endedReason: "reported",
        },
      ],
    });

    expect(blocked).toBe(EXECUTION_SURFACE_STATUS.BLOCKED);
    expect(reported).toBe(EXECUTION_SURFACE_STATUS.REPORTED);
  });

  it("derives late planning status for overdue planned occurrences", () => {
    expect(
      resolveTimelineExecutionStatus({
        occurrence: {
          id: "occ_late",
          date: "2026-05-28",
          status: "planned",
          start: "09:00",
          durationMinutes: 30,
        },
        dateKey: "2026-05-28",
        now: new Date("2026-05-28T12:00:00"),
      })
    ).toBe("late");

    expect(
      resolveTimelineExecutionStatus({
        occurrence: {
          id: "occ_ready",
          date: "2026-05-28",
          status: "planned",
          start: "15:00",
          durationMinutes: 30,
        },
        dateKey: "2026-05-28",
        now: new Date("2026-05-28T12:00:00"),
      })
    ).toBe(EXECUTION_SURFACE_STATUS.PLANNED);
  });

  it("keeps next focus on executable or recovery statuses only", () => {
    expect(isTimelineNextFocusCandidate(EXECUTION_SURFACE_STATUS.PLANNED)).toBe(true);
    expect(isTimelineNextFocusCandidate(EXECUTION_SURFACE_STATUS.BLOCKED)).toBe(true);
    expect(isTimelineNextFocusCandidate(EXECUTION_SURFACE_STATUS.REPORTED)).toBe(true);
    expect(isTimelineNextFocusCandidate(EXECUTION_SURFACE_STATUS.DONE)).toBe(false);
    expect(isTimelineNextFocusCandidate(EXECUTION_SURFACE_STATUS.MISSED)).toBe(false);
    expect(isTimelineNextFocusCandidate("late")).toBe(false);
    expect(isTimelineNextFocusCandidate(EXECUTION_SURFACE_STATUS.POSTPONED)).toBe(false);
  });
});
