import { describe, expect, it } from "vitest";
import {
  SESSION_RECOVERY_SOURCE,
  createSessionRecoveryRequest,
  hasCommittedSessionRecoveryOutcome,
} from "./sessionRecoveryQueue";
import { RECOVERY_CONTEXT } from "./recoveryTypes";

describe("session recovery queue", () => {
  it("creates blocked and reported requests with concrete occurrence context", () => {
    expect(
      createSessionRecoveryRequest({
        occurrenceId: "occ-1",
        context: RECOVERY_CONTEXT.BLOCKED,
        selectedDateKey: "2026-05-25",
        queuedAtMs: 10,
      })
    ).toMatchObject({
      id: "session_block:occ-1:10",
      occurrenceId: "occ-1",
      context: RECOVERY_CONTEXT.BLOCKED,
      source: SESSION_RECOVERY_SOURCE.BLOCK,
      selectedDateKey: "2026-05-25",
    });

    expect(
      createSessionRecoveryRequest({
        occurrenceId: "occ-2",
        context: RECOVERY_CONTEXT.REPORTED,
        source: "session_report",
        queuedAtMs: 20,
      })
    ).toMatchObject({
      id: "session_report:occ-2:20",
      context: RECOVERY_CONTEXT.REPORTED,
      source: SESSION_RECOVERY_SOURCE.REPORT,
    });
  });

  it("rejects invalid session recovery requests", () => {
    expect(createSessionRecoveryRequest({ context: RECOVERY_CONTEXT.BLOCKED })).toBeNull();
    expect(createSessionRecoveryRequest({ occurrenceId: "occ-1", context: RECOVERY_CONTEXT.MISSED })).toBeNull();
  });

  it("waits for the matching committed runtime history before opening recovery", () => {
    const request = createSessionRecoveryRequest({
      occurrenceId: "occ-1",
      context: RECOVERY_CONTEXT.REPORTED,
      queuedAtMs: 30,
    });

    expect(hasCommittedSessionRecoveryOutcome({ sessionHistory: [] }, request)).toBe(false);
    expect(
      hasCommittedSessionRecoveryOutcome(
        {
          sessionHistory: [
            { id: "hist-1", occurrenceId: "occ-1", state: "ended", endedReason: "blocked" },
          ],
        },
        request
      )
    ).toBe(false);
    expect(
      hasCommittedSessionRecoveryOutcome(
        {
          sessionHistory: [
            { id: "hist-2", occurrenceId: "occ-1", state: "ended", endedReason: "reported" },
          ],
        },
        request
      )
    ).toBe(true);
  });
});
