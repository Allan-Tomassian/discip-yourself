import { describe, expect, it } from "vitest";
import { applySessionRuntimeTransition, resolveRuntimeAutoFinish } from "./sessionRuntime";

function baseState(overrides = {}) {
  return {
    ui: { activeSession: null, ...(overrides.ui || {}) },
    goals: [{ id: "g1", type: "PROCESS" }, ...(overrides.goals || [])],
    occurrences: [
      { id: "occ1", goalId: "g1", date: "2026-02-20", start: "09:00", status: "planned", durationMinutes: 30 },
      ...(overrides.occurrences || []),
    ],
    sessionHistory: Array.isArray(overrides.sessionHistory) ? overrides.sessionHistory : [],
    ...overrides,
  };
}

describe("sessionRuntime transitions", () => {
  it("start creates canonical runtime session and syncs occurrence in_progress", () => {
    const state = baseState();
    const next = applySessionRuntimeTransition(state, {
      type: "start",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      objectiveId: "out1",
      habitIds: ["g1"],
      now: new Date("2026-02-20T09:00:00.000Z"),
    });
    expect(next.ui.activeSession).toBeTruthy();
    expect(next.ui.activeSession.status).toBe("partial");
    expect(next.ui.activeSession.runtimePhase).toBe("in_progress");
    expect(next.ui.activeSession.occurrenceId).toBe("occ1");
    const occ = next.occurrences.find((item) => item.id === "occ1");
    expect(occ.status).toBe("in_progress");
    expect(next.sessionHistory).toHaveLength(1);
    expect(next.sessionHistory[0].state).toBe("in_progress");
  });

  it("pause and resume keep same active session and track timer", () => {
    const started = applySessionRuntimeTransition(baseState(), {
      type: "start",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      objectiveId: "out1",
      habitIds: ["g1"],
      now: new Date("2026-02-20T09:00:00.000Z"),
    });
    const resumed = applySessionRuntimeTransition(started, {
      type: "resume",
      occurrenceId: "occ1",
      durationSec: 25,
      now: new Date("2026-02-20T09:02:00.000Z"),
    });
    expect(resumed.ui.activeSession.timerRunning).toBe(true);
    expect(resumed.ui.activeSession.runtimePhase).toBe("in_progress");
    const paused = applySessionRuntimeTransition(resumed, {
      type: "pause",
      occurrenceId: "occ1",
      durationSec: 61,
      now: new Date("2026-02-20T09:03:00.000Z"),
    });
    expect(paused.ui.activeSession.timerRunning).toBe(false);
    expect(paused.ui.activeSession.runtimePhase).toBe("paused");
    expect(paused.ui.activeSession.timerAccumulatedSec).toBe(61);
  });

  it("finish marks occurrence done and writes ended history", () => {
    const started = applySessionRuntimeTransition(baseState(), {
      type: "start",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      objectiveId: "out1",
      habitIds: ["g1"],
      now: new Date("2026-02-20T09:00:00.000Z"),
    });
    const done = applySessionRuntimeTransition(started, {
      type: "finish",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      doneHabitIds: ["g1"],
      durationSec: 600,
      now: new Date("2026-02-20T09:10:00.000Z"),
    });
    expect(done.ui.activeSession.status).toBe("done");
    expect(done.ui.activeSession.runtimePhase).toBe("done");
    const occ = done.occurrences.find((item) => item.id === "occ1");
    expect(occ.status).toBe("done");
    expect(done.sessionHistory).toHaveLength(1);
    expect(done.sessionHistory[0].state).toBe("ended");
    expect(done.sessionHistory[0].endedReason).toBe("done");
  });

  it("stores feedback on finish when provided", () => {
    const started = applySessionRuntimeTransition(baseState(), {
      type: "start",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      habitIds: ["g1"],
      now: new Date("2026-02-20T09:00:00.000Z"),
    });
    const finished = applySessionRuntimeTransition(started, {
      type: "finish",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      doneHabitIds: ["g1"],
      durationSec: 600,
      feedbackLevel: "normal",
      feedbackText: "Rythme correct",
      now: new Date("2026-02-20T09:10:00.000Z"),
    });
    expect(finished.sessionHistory[0].feedbackLevel).toBe("normal");
    expect(finished.sessionHistory[0].feedbackText).toBe("Rythme correct");
  });

  it("block keeps the occurrence planifiable and writes a blocked history", () => {
    const running = applySessionRuntimeTransition(
      applySessionRuntimeTransition(baseState(), {
        type: "start",
        occurrenceId: "occ1",
        dateKey: "2026-02-20",
        habitIds: ["g1"],
        now: new Date("2026-02-20T09:00:00.000Z"),
      }),
      {
        type: "resume",
        occurrenceId: "occ1",
        durationSec: 120,
        now: new Date("2026-02-20T09:02:00.000Z"),
      }
    );
    const blocked = applySessionRuntimeTransition(running, {
      type: "block",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      durationSec: 180,
      now: new Date("2026-02-20T09:03:00.000Z"),
    });
    expect(blocked.ui.activeSession.runtimePhase).toBe("blocked");
    expect(blocked.occurrences.find((item) => item.id === "occ1")?.status).toBe("planned");
    expect(blocked.sessionHistory[0].endedReason).toBe("blocked");
  });

  it("report closes the runtime session with a reported reason", () => {
    const running = applySessionRuntimeTransition(
      applySessionRuntimeTransition(baseState(), {
        type: "start",
        occurrenceId: "occ1",
        dateKey: "2026-02-20",
        habitIds: ["g1"],
        now: new Date("2026-02-20T09:00:00.000Z"),
      }),
      {
        type: "resume",
        occurrenceId: "occ1",
        durationSec: 120,
        now: new Date("2026-02-20T09:02:00.000Z"),
      }
    );
    const reported = applySessionRuntimeTransition(running, {
      type: "report",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      durationSec: 180,
      now: new Date("2026-02-20T09:03:00.000Z"),
    });
    expect(reported.ui.activeSession.runtimePhase).toBe("reported");
    expect(reported.sessionHistory[0].endedReason).toBe("reported");
  });

  it("start on same open occurrence does not reset timer progress", () => {
    const started = applySessionRuntimeTransition(baseState(), {
      type: "start",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      objectiveId: "out1",
      habitIds: ["g1"],
      now: new Date("2026-02-20T09:00:00.000Z"),
    });
    const resumed = applySessionRuntimeTransition(started, {
      type: "resume",
      occurrenceId: "occ1",
      durationSec: 120,
      now: new Date("2026-02-20T09:02:00.000Z"),
    });
    const restarted = applySessionRuntimeTransition(resumed, {
      type: "start",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      objectiveId: "out1",
      habitIds: ["g1"],
      now: new Date("2026-02-20T09:05:00.000Z"),
    });
    expect(restarted.ui.activeSession.timerAccumulatedSec).toBe(120);
    expect(restarted.ui.activeSession.runtimePhase).toBe("in_progress");
  });

  it("auto-finish event is resolved from state without Session screen coupling", () => {
    const started = applySessionRuntimeTransition(baseState(), {
      type: "start",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      objectiveId: "out1",
      habitIds: ["g1"],
      now: new Date("2026-02-20T09:00:00.000Z"),
    });
    const running = applySessionRuntimeTransition(started, {
      type: "resume",
      occurrenceId: "occ1",
      durationSec: 0,
      now: new Date("2026-02-20T09:00:00.000Z"),
    });
    const event = resolveRuntimeAutoFinish(running, new Date("2026-02-20T09:31:00.000Z"));
    expect(event).toBeTruthy();
    expect(event.type).toBe("finish");
    expect(event.occurrenceId).toBe("occ1");
    expect(event.durationSec).toBeGreaterThanOrEqual(1800);
  });

  it("does not overwrite terminal occurrence status on start/finish", () => {
    const state = baseState({
      occurrences: [{ id: "occ1", goalId: "g1", date: "2026-02-20", start: "09:00", status: "done", durationMinutes: 30 }],
    });
    const started = applySessionRuntimeTransition(state, {
      type: "start",
      occurrenceId: "occ1",
      dateKey: "2026-02-20",
      habitIds: ["g1"],
      now: new Date("2026-02-20T09:00:00.000Z"),
    });
    expect(started).toBe(state);
  });
});
