import { describe, expect, it } from "vitest";
import {
  CANCELED_OCCURRENCE_STATUSES,
  CANONICAL_OCCURRENCE_STATUSES,
  EXPECTED_OCCURRENCE_STATUSES,
  FINAL_OCCURRENCE_STATUSES,
  OCCURRENCE_STATUS,
  getOccurrenceStatusRank,
  isCompletedOccurrenceStatus,
  isExcludedFromExpectedOccurrenceStatus,
  isExpectedOccurrenceStatus,
  isMissedOccurrenceStatus,
  isPlannedOccurrenceStatus,
  isTerminalOccurrenceStatus,
  normalizeOccurrenceStatus,
} from "./occurrenceStatus";

describe("occurrenceStatus canonical semantics", () => {
  it("keeps canonical set stable", () => {
    expect(CANONICAL_OCCURRENCE_STATUSES).toEqual(
      new Set([
        OCCURRENCE_STATUS.PLANNED,
        OCCURRENCE_STATUS.IN_PROGRESS,
        OCCURRENCE_STATUS.DONE,
        OCCURRENCE_STATUS.MISSED,
        OCCURRENCE_STATUS.SKIPPED,
        OCCURRENCE_STATUS.CANCELED,
        OCCURRENCE_STATUS.RESCHEDULED,
      ])
    );
  });

  it("normalizes legacy aliases and unknown values", () => {
    expect(normalizeOccurrenceStatus("cancelled")).toBe(OCCURRENCE_STATUS.CANCELED);
    expect(normalizeOccurrenceStatus("unknown-status")).toBe(OCCURRENCE_STATUS.PLANNED);
  });

  it("applies expected/excluded/terminal semantics consistently", () => {
    expect(isExpectedOccurrenceStatus(OCCURRENCE_STATUS.PLANNED)).toBe(true);
    expect(isExpectedOccurrenceStatus(OCCURRENCE_STATUS.DONE)).toBe(true);
    expect(isExpectedOccurrenceStatus(OCCURRENCE_STATUS.MISSED)).toBe(true);
    expect(isExpectedOccurrenceStatus(OCCURRENCE_STATUS.IN_PROGRESS)).toBe(true);
    expect(isExpectedOccurrenceStatus(OCCURRENCE_STATUS.RESCHEDULED)).toBe(true);
    expect(isExpectedOccurrenceStatus(OCCURRENCE_STATUS.CANCELED)).toBe(false);
    expect(isExpectedOccurrenceStatus(OCCURRENCE_STATUS.SKIPPED)).toBe(false);

    expect(isExcludedFromExpectedOccurrenceStatus(OCCURRENCE_STATUS.CANCELED)).toBe(true);
    expect(isExcludedFromExpectedOccurrenceStatus(OCCURRENCE_STATUS.SKIPPED)).toBe(true);
    expect(isExcludedFromExpectedOccurrenceStatus(OCCURRENCE_STATUS.PLANNED)).toBe(false);

    expect(isTerminalOccurrenceStatus(OCCURRENCE_STATUS.DONE)).toBe(true);
    expect(isTerminalOccurrenceStatus(OCCURRENCE_STATUS.MISSED)).toBe(true);
    expect(isTerminalOccurrenceStatus(OCCURRENCE_STATUS.CANCELED)).toBe(true);
    expect(isTerminalOccurrenceStatus(OCCURRENCE_STATUS.SKIPPED)).toBe(true);
    expect(isTerminalOccurrenceStatus(OCCURRENCE_STATUS.RESCHEDULED)).toBe(true);
    expect(isTerminalOccurrenceStatus(OCCURRENCE_STATUS.PLANNED)).toBe(false);
    expect(isTerminalOccurrenceStatus(OCCURRENCE_STATUS.IN_PROGRESS)).toBe(false);
  });

  it("exposes role helpers and ranking", () => {
    expect(isCompletedOccurrenceStatus(OCCURRENCE_STATUS.DONE)).toBe(true);
    expect(isMissedOccurrenceStatus(OCCURRENCE_STATUS.MISSED)).toBe(true);
    expect(isPlannedOccurrenceStatus(OCCURRENCE_STATUS.PLANNED)).toBe(true);
    expect(getOccurrenceStatusRank(OCCURRENCE_STATUS.DONE)).toBeGreaterThan(
      getOccurrenceStatusRank(OCCURRENCE_STATUS.PLANNED)
    );
    expect(getOccurrenceStatusRank(OCCURRENCE_STATUS.SKIPPED)).toBeGreaterThanOrEqual(
      getOccurrenceStatusRank(OCCURRENCE_STATUS.PLANNED)
    );
  });

  it("keeps exported semantic sets aligned", () => {
    expect(FINAL_OCCURRENCE_STATUSES).toEqual(
      new Set([
        OCCURRENCE_STATUS.DONE,
        OCCURRENCE_STATUS.SKIPPED,
        OCCURRENCE_STATUS.CANCELED,
        OCCURRENCE_STATUS.MISSED,
        OCCURRENCE_STATUS.RESCHEDULED,
      ])
    );
    expect(CANCELED_OCCURRENCE_STATUSES).toEqual(
      new Set([OCCURRENCE_STATUS.SKIPPED, OCCURRENCE_STATUS.CANCELED])
    );
    expect(EXPECTED_OCCURRENCE_STATUSES).toEqual(
      new Set([
        OCCURRENCE_STATUS.PLANNED,
        OCCURRENCE_STATUS.IN_PROGRESS,
        OCCURRENCE_STATUS.DONE,
        OCCURRENCE_STATUS.MISSED,
        OCCURRENCE_STATUS.RESCHEDULED,
      ])
    );
  });
});
