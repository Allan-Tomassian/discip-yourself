import { describe, expect, it } from "vitest";
import {
  EXECUTION_STATUS_ISSUE_CODE,
  EXECUTION_STATUS_SOURCE,
  EXECUTION_SURFACE_STATUS,
  deriveExecutionStatus,
  deriveExecutionStatusForOccurrence,
  getLatestSessionHistoryForOccurrence,
  getSessionFrictionSignalsForDate,
  isExecutableExecutionStatus,
  isFrictionExecutionStatus,
  isTerminalExecutionStatus,
} from "./executionStatus";

const DATE_KEY = "2026-02-20";

function occurrence(overrides = {}) {
  return {
    id: "occ_focus",
    goalId: "action_focus",
    date: DATE_KEY,
    status: "planned",
    durationMinutes: 30,
    ...overrides,
  };
}

function history(endedReason, overrides = {}) {
  return {
    id: `hist_${endedReason}`,
    occurrenceId: "occ_focus",
    dateKey: DATE_KEY,
    state: "ended",
    endedReason,
    startAt: `${DATE_KEY}T09:00:00.000Z`,
    endAt: `${DATE_KEY}T09:10:00.000Z`,
    timerSeconds: 600,
    ...overrides,
  };
}

function activeSession(overrides = {}) {
  return {
    id: "session_focus",
    occurrenceId: "occ_focus",
    dateKey: DATE_KEY,
    status: "partial",
    runtimePhase: "in_progress",
    timerRunning: true,
    ...overrides,
  };
}

describe("deriveExecutionStatus", () => {
  it("derives done from occurrence done", () => {
    const result = deriveExecutionStatus({ occurrence: occurrence({ status: "done" }) });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.DONE);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.OCCURRENCE);
    expect(result.reason).toBe("occurrence_done");
    expect(result.isTerminal).toBe(true);
    expect(result.isExecutable).toBe(false);
    expect(result.isFriction).toBe(false);
  });

  it("derives missed from occurrence missed", () => {
    const result = deriveExecutionStatus({ occurrence: occurrence({ status: "missed" }) });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.MISSED);
    expect(result.isTerminal).toBe(true);
    expect(result.isExecutable).toBe(false);
    expect(result.isFriction).toBe(true);
  });

  it("derives skipped and canceled as terminal occurrence statuses", () => {
    const skipped = deriveExecutionStatus({ occurrence: occurrence({ status: "skipped" }) });
    const canceled = deriveExecutionStatus({ occurrence: occurrence({ status: "canceled" }) });

    expect(skipped.status).toBe(EXECUTION_SURFACE_STATUS.SKIPPED);
    expect(skipped.isTerminal).toBe(true);
    expect(skipped.isExecutable).toBe(false);
    expect(canceled.status).toBe(EXECUTION_SURFACE_STATUS.CANCELED);
    expect(canceled.isTerminal).toBe(true);
    expect(canceled.isExecutable).toBe(false);
  });

  it("maps occurrence rescheduled to postponed", () => {
    const result = deriveExecutionStatus({ occurrence: occurrence({ status: "rescheduled" }) });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.POSTPONED);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.OCCURRENCE);
    expect(result.reason).toBe("occurrence_rescheduled");
    expect(result.isTerminal).toBe(true);
    expect(result.isExecutable).toBe(false);
    expect(result.isFriction).toBe(true);
  });

  it("maps occurrence in_progress to active", () => {
    const result = deriveExecutionStatus({ occurrence: occurrence({ status: "in_progress" }) });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.ACTIVE);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.OCCURRENCE);
    expect(result.reason).toBe("occurrence_in_progress");
    expect(result.isTerminal).toBe(false);
    expect(result.isExecutable).toBe(true);
  });

  it("maps an open activeSession to active", () => {
    const result = deriveExecutionStatus({
      occurrence: occurrence(),
      activeSession: activeSession({ runtimePhase: "paused", timerRunning: false }),
    });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.ACTIVE);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.ACTIVE_SESSION);
    expect(result.reason).toBe("open_active_session");
  });

  it("activeSession wins over older blocked or reported history", () => {
    const result = deriveExecutionStatus({
      occurrence: occurrence(),
      activeSession: activeSession(),
      sessionHistory: [
        history("blocked", { id: "hist_blocked", endAt: `${DATE_KEY}T09:10:00.000Z` }),
        history("reported", { id: "hist_reported", endAt: `${DATE_KEY}T09:20:00.000Z` }),
      ],
    });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.ACTIVE);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.ACTIVE_SESSION);
    expect(result.historyId).toBeNull();
  });

  it("derives blocked from latest blocked history while occurrence remains planned", () => {
    const result = deriveExecutionStatus({
      occurrence: occurrence(),
      sessionHistory: [
        history("reported", { id: "hist_reported", endAt: `${DATE_KEY}T09:10:00.000Z` }),
        history("blocked", { id: "hist_blocked", endAt: `${DATE_KEY}T09:20:00.000Z` }),
      ],
    });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.BLOCKED);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.SESSION_HISTORY);
    expect(result.reason).toBe("history_blocked");
    expect(result.historyId).toBe("hist_blocked");
    expect(result.isTerminal).toBe(false);
    expect(result.isExecutable).toBe(true);
    expect(result.isFriction).toBe(true);
  });

  it("derives reported from latest reported history while occurrence remains planned", () => {
    const result = deriveExecutionStatus({
      occurrence: occurrence(),
      sessionHistory: [history("reported", { id: "hist_reported" })],
    });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.REPORTED);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.SESSION_HISTORY);
    expect(result.reason).toBe("history_reported");
    expect(result.historyId).toBe("hist_reported");
    expect(result.isTerminal).toBe(false);
    expect(result.isExecutable).toBe(true);
    expect(result.isFriction).toBe(true);
  });

  it("derives planned from planned occurrence with no relevant history", () => {
    const result = deriveExecutionStatus({
      occurrence: occurrence(),
      sessionHistory: [history("blocked", { dateKey: "2026-02-19" })],
    });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.PLANNED);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.OCCURRENCE);
    expect(result.reason).toBe("occurrence_planned");
    expect(result.isTerminal).toBe(false);
    expect(result.isExecutable).toBe(true);
    expect(result.isFriction).toBe(false);
  });

  it("does not pretend done when history says done but occurrence is not done", () => {
    const result = deriveExecutionStatus({
      occurrence: occurrence({ status: "planned" }),
      sessionHistory: [history("done", { id: "hist_done" })],
    });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.PLANNED);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.OCCURRENCE);
    expect(result.reason).toBe("history_done_without_done_occurrence");
    expect(result.historyId).toBe("hist_done");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: EXECUTION_STATUS_ISSUE_CODE.DONE_HISTORY_WITHOUT_DONE_OCCURRENCE,
        historyId: "hist_done",
        occurrenceId: "occ_focus",
      }),
    ]);
  });

  it("derives canceled from canceled history without mutating the occurrence", () => {
    const sourceOccurrence = occurrence({ status: "planned" });
    const result = deriveExecutionStatus({
      occurrence: sourceOccurrence,
      sessionHistory: [history("canceled", { id: "hist_canceled" })],
    });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.CANCELED);
    expect(result.source).toBe(EXECUTION_STATUS_SOURCE.SESSION_HISTORY);
    expect(result.reason).toBe("history_canceled");
    expect(sourceOccurrence.status).toBe("planned");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: EXECUTION_STATUS_ISSUE_CODE.CANCELED_HISTORY_WITHOUT_TERMINAL_OCCURRENCE,
      }),
    ]);
  });

  it("supports the occurrence-first helper wrapper", () => {
    const result = deriveExecutionStatusForOccurrence(occurrence(), {
      sessionHistory: [history("blocked")],
    });

    expect(result.status).toBe(EXECUTION_SURFACE_STATUS.BLOCKED);
  });
});

describe("session history helpers", () => {
  it("returns latest relevant session history for an occurrence", () => {
    const latest = getLatestSessionHistoryForOccurrence(
      [
        history("blocked", { id: "older", endAt: `${DATE_KEY}T09:10:00.000Z` }),
        history("reported", { id: "newer", endAt: `${DATE_KEY}T09:20:00.000Z` }),
        history("blocked", { id: "other_occurrence", occurrenceId: "occ_other", endAt: `${DATE_KEY}T09:30:00.000Z` }),
      ],
      "occ_focus",
      { dateKey: DATE_KEY }
    );

    expect(latest?.id).toBe("newer");
  });

  it("finds blocked and reported friction signals for a date", () => {
    const signals = getSessionFrictionSignalsForDate({
      dateKey: DATE_KEY,
      sessionHistory: [
        history("blocked", { id: "hist_blocked" }),
        history("reported", { id: "hist_reported" }),
        history("done", { id: "hist_done" }),
        history("blocked", { id: "hist_other_day", dateKey: "2026-02-21" }),
      ],
    });

    expect(signals).toHaveLength(2);
    expect(signals.map((signal) => signal.status)).toEqual([
      EXECUTION_SURFACE_STATUS.BLOCKED,
      EXECUTION_SURFACE_STATUS.REPORTED,
    ]);
    expect(signals.every((signal) => signal.isFriction)).toBe(true);
  });

  it("can detect reported friction on a source date after an occurrence moved", () => {
    const movedOccurrence = occurrence({ date: "2026-02-21", status: "planned" });
    const sessionHistory = [history("reported", { id: "hist_reported", dateKey: DATE_KEY })];

    const futureStatus = deriveExecutionStatus({ occurrence: movedOccurrence, sessionHistory });
    const sourceDaySignals = getSessionFrictionSignalsForDate({ sessionHistory, dateKey: DATE_KEY });

    expect(futureStatus.status).toBe(EXECUTION_SURFACE_STATUS.PLANNED);
    expect(sourceDaySignals).toEqual([
      expect.objectContaining({
        status: EXECUTION_SURFACE_STATUS.REPORTED,
        occurrenceId: "occ_focus",
        historyId: "hist_reported",
        dateKey: DATE_KEY,
      }),
    ]);
  });
});

describe("execution status predicates", () => {
  it("marks terminal statuses as non-executable", () => {
    const terminalStatuses = [
      EXECUTION_SURFACE_STATUS.DONE,
      EXECUTION_SURFACE_STATUS.MISSED,
      EXECUTION_SURFACE_STATUS.SKIPPED,
      EXECUTION_SURFACE_STATUS.CANCELED,
      EXECUTION_SURFACE_STATUS.POSTPONED,
    ];

    for (const status of terminalStatuses) {
      expect(isTerminalExecutionStatus(status)).toBe(true);
      expect(isExecutableExecutionStatus(status)).toBe(false);
    }
  });

  it("makes blocked and reported explicit restartable friction statuses", () => {
    for (const status of [EXECUTION_SURFACE_STATUS.BLOCKED, EXECUTION_SURFACE_STATUS.REPORTED]) {
      expect(isTerminalExecutionStatus(status)).toBe(false);
      expect(isExecutableExecutionStatus(status)).toBe(true);
      expect(isFrictionExecutionStatus(status)).toBe(true);
    }
  });
});
