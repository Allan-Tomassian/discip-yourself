import { describe, expect, it } from "vitest";
import {
  SYSTEM_INVARIANT_SEVERITY,
  validateCoachProposalInvariants,
  validateGeneratedFirstRunPlans,
  validateSystemInvariants,
} from "./systemInvariants";

const ACTIVATION_DATE = "2026-04-29";

function issueCodes(result) {
  return result.issues.map((issue) => issue.code);
}

function baseState(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      {
        id: "action_focus",
        type: "PROCESS",
        planType: "ACTION",
        title: "Bloc profond",
        categoryId: "cat_work",
        repeat: "daily",
      },
    ],
    scheduleRules: [
      {
        id: "rule_focus",
        actionId: "action_focus",
        sourceKey: "action_focus|daily",
        kind: "recurring",
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        timeType: "fixed",
        startTime: "09:00",
        durationMin: 30,
        isActive: true,
      },
    ],
    occurrences: [
      {
        id: "occ_today",
        goalId: "action_focus",
        date: ACTIVATION_DATE,
        start: "09:00",
        status: "planned",
        durationMinutes: 30,
      },
    ],
    sessionHistory: [],
    ui: {},
    ...overrides,
  };
}

function committedFirstRun(overrides = {}) {
  return {
    status: "done",
    inputHash: "hash_1",
    commitV1: {
      status: "applied",
      appliedAt: `${ACTIVATION_DATE}T08:00:00.000Z`,
      createdActionIds: ["action_focus"],
      ...overrides.commitV1,
    },
    ...overrides,
  };
}

function validCommitDraft(overrides = {}) {
  return {
    version: 1,
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [{ id: "outcome_ship", type: "OUTCOME", title: "Livrer", categoryId: "cat_work" }],
    actions: [
      {
        id: "action_focus",
        type: "PROCESS",
        title: "Bloc profond",
        categoryId: "cat_work",
        parentGoalId: "outcome_ship",
      },
    ],
    occurrences: [
      {
        id: "occ_first",
        actionId: "action_focus",
        date: ACTIVATION_DATE,
        start: "09:00",
        status: "planned",
        durationMinutes: 30,
      },
    ],
    ...overrides,
  };
}

describe("validateSystemInvariants", () => {
  it("reports first-run done with failed or missing commit as blocking", () => {
    const failed = validateSystemInvariants({
      ...baseState(),
      ui: { firstRunV1: committedFirstRun({ commitV1: { status: "failed" } }) },
    });
    const missing = validateSystemInvariants({
      ...baseState(),
      ui: { firstRunV1: { status: "done", inputHash: "legacy_hash" } },
    });

    expect(failed.ok).toBe(false);
    expect(missing.ok).toBe(false);
    expect(issueCodes(failed)).toContain("FIRST_RUN_DONE_WITHOUT_APPLIED_COMMIT");
    expect(issueCodes(missing)).toContain("FIRST_RUN_DONE_WITHOUT_APPLIED_COMMIT");
  });

  it("reports applied first-run commit without activation occurrence as blocking", () => {
    const result = validateSystemInvariants({
      ...baseState({ occurrences: [] }),
      ui: { firstRunV1: committedFirstRun() },
    });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("FIRST_RUN_APPLIED_WITHOUT_INITIAL_TODAY_BLOCK");
  });

  it("passes a valid first-run committed state", () => {
    const result = validateSystemInvariants({
      ...baseState(),
      ui: { firstRunV1: committedFirstRun() },
    });

    expect(result.ok).toBe(true);
    expect(result.issues.filter((issue) => issue.severity === SYSTEM_INVARIANT_SEVERITY.ERROR)).toEqual([]);
  });

  it("fails when a process action references a missing category", () => {
    const result = validateSystemInvariants(
      baseState({
        goals: [{ id: "action_orphan", type: "PROCESS", planType: "ONE_OFF", categoryId: "missing" }],
        occurrences: [],
        scheduleRules: [],
      })
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("PROCESS_ACTION_MISSING_CATEGORY");
  });

  it("fails when a recurring process action has no schedule source", () => {
    const result = validateSystemInvariants(
      baseState({
        goals: [{ id: "action_unscheduled", type: "PROCESS", planType: "ACTION", categoryId: "cat_work" }],
        occurrences: [],
        scheduleRules: [],
      })
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("RECURRING_ACTION_MISSING_SCHEDULE_SOURCE");
  });

  it("fails when an occurrence references a missing process action", () => {
    const result = validateSystemInvariants(
      baseState({
        occurrences: [{ id: "occ_orphan", goalId: "missing_action", date: ACTIVATION_DATE, status: "planned" }],
      })
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("OCCURRENCE_MISSING_PROCESS_ACTION");
  });

  it("fails when an occurrence references an outcome", () => {
    const result = validateSystemInvariants(
      baseState({
        goals: [
          { id: "outcome_ship", type: "OUTCOME", title: "Livrer", categoryId: "cat_work" },
        ],
        occurrences: [{ id: "occ_outcome", goalId: "outcome_ship", date: ACTIVATION_DATE, status: "planned" }],
        scheduleRules: [],
      })
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("OCCURRENCE_REFERENCES_OUTCOME");
  });

  it("fails when done session history points to a non-done occurrence", () => {
    const result = validateSystemInvariants(
      baseState({
        goals: [{ id: "action_focus", type: "PROCESS", planType: "ONE_OFF", categoryId: "cat_work" }],
        scheduleRules: [],
        occurrences: [{ id: "occ_session", goalId: "action_focus", date: ACTIVATION_DATE, status: "planned" }],
        sessionHistory: [
          {
            id: "session_1",
            occurrenceId: "occ_session",
            actionId: "action_focus",
            dateKey: ACTIVATION_DATE,
            state: "ended",
            endedReason: "done",
          },
        ],
      })
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("SESSION_DONE_HISTORY_WITHOUT_DONE_OCCURRENCE");
  });

  it("keeps blocked and reported sessions diagnostically visible", () => {
    const result = validateSystemInvariants(
      baseState({
        goals: [{ id: "action_focus", type: "PROCESS", planType: "ONE_OFF", categoryId: "cat_work" }],
        scheduleRules: [],
        occurrences: [{ id: "occ_session", goalId: "action_focus", date: ACTIVATION_DATE, status: "planned" }],
        sessionHistory: [
          {
            id: "session_blocked",
            occurrenceId: "occ_session",
            actionId: "action_focus",
            dateKey: ACTIVATION_DATE,
            state: "ended",
            endedReason: "blocked",
          },
          {
            id: "session_reported",
            occurrenceId: "occ_session",
            actionId: "action_focus",
            dateKey: ACTIVATION_DATE,
            state: "ended",
            endedReason: "reported",
          },
        ],
      })
    );

    expect(result.ok).toBe(true);
    expect(result.summary.diagnosticSessionCount).toBe(2);
    expect(issueCodes(result)).not.toContain("BLOCK_REPORT_SESSION_LACKS_DIAGNOSTIC_METADATA");
  });

  it("treats a valid rescheduled occurrence as postponed-visible, not invalid", () => {
    const result = validateSystemInvariants(
      baseState({
        goals: [{ id: "action_focus", type: "PROCESS", planType: "ONE_OFF", categoryId: "cat_work" }],
        scheduleRules: [],
        occurrences: [{ id: "occ_postponed", goalId: "action_focus", date: ACTIVATION_DATE, status: "rescheduled" }],
      })
    );

    expect(result.ok).toBe(true);
    expect(result.summary.postponedOccurrenceCount).toBe(1);
    expect(issueCodes(result)).not.toContain("POSTPONED_OCCURRENCE_MISSING_DIAGNOSTIC_DATA");
  });
});

describe("validateGeneratedFirstRunPlans", () => {
  it("fails when a generated first-run plan has missing action refs", () => {
    const result = validateGeneratedFirstRunPlans(
      {
        plans: [
          {
            id: "recommended",
            commitDraft: validCommitDraft({
              occurrences: [{ id: "occ_bad", actionId: "missing_action", date: ACTIVATION_DATE, status: "planned" }],
            }),
          },
        ],
      },
      { todayKey: ACTIVATION_DATE }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("FIRST_RUN_PLAN_INVALID_COMMIT_DRAFT");
  });

  it("passes when a generated first-run plan has a first executable block", () => {
    const result = validateGeneratedFirstRunPlans(
      {
        plans: [{ id: "recommended", commitDraft: validCommitDraft() }],
      },
      { todayKey: ACTIVATION_DATE }
    );

    expect(result.ok).toBe(true);
  });
});

describe("validateCoachProposalInvariants", () => {
  it("blocks coach proposals with unresolved questions", () => {
    const result = validateCoachProposalInvariants({
      kind: "assistant",
      actionDrafts: [{ title: "Bloc profond" }],
      unresolvedQuestions: ["Quel creneau ?"],
    });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("COACH_UNRESOLVED_PROPOSAL_NOT_COMMITTABLE");
  });
});
