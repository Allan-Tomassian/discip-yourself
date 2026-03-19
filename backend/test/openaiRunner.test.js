import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyCoachPayloadIssue,
  isOpenAiModelOutputError,
  MODEL_OUTPUT_ISSUE_CODE,
  normalizeCoachPayloadCandidate,
  runOpenAiCoach,
} from "../src/services/coach/openaiRunner.js";
import { coachPayloadSchema } from "../src/schemas/coach.js";

function createRunnerApp(message) {
  return {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async () => ({
            choices: [{ message }],
          }),
        },
      },
    },
  };
}

function createNowContext() {
  return {
    activeDate: "2026-03-06",
    isToday: true,
    activeCategoryId: "cat-1",
    activeSessionForActiveDate: null,
    openSessionOutsideActiveDate: null,
    futureSessions: [],
    focusOccurrenceForActiveDate: {
      id: "occ-1",
      goalId: "goal-1",
      date: "2026-03-06",
    },
    doneToday: 0,
    missedToday: 0,
    remainingToday: 1,
    categoryStatus: null,
    quotaRemaining: 5,
    recentHistory: [],
  };
}

function createValidCandidate() {
  return {
    kind: "now",
    headline: "Lance ta session de concentration maintenant",
    reason: "C'est ton meilleur créneau disponible aujourd'hui.",
    primaryAction: {
      label: "Commencer maintenant",
      intent: "start_occurrence",
      categoryId: "cat-1",
      actionId: "goal-1",
      occurrenceId: "occ-1",
      dateKey: "2026-03-06",
    },
    secondaryAction: null,
    suggestedDurationMin: 25,
    confidence: 0.91,
    urgency: "high",
    uiTone: "direct",
    toolIntent: "suggest_start_occurrence",
    rewardSuggestion: {
      kind: "none",
      label: null,
    },
  };
}

test("normalizeCoachPayloadCandidate fills safe nullable defaults and truncates text", () => {
  const longHeadline = "H".repeat(90);
  const longReason = "R".repeat(190);
  const longLabel = "L".repeat(40);
  const normalized = normalizeCoachPayloadCandidate({
    ...createValidCandidate(),
    headline: longHeadline,
    reason: longReason,
    primaryAction: {
      label: longLabel,
      intent: "start_occurrence",
    },
    secondaryAction: undefined,
    suggestedDurationMin: undefined,
    rewardSuggestion: undefined,
  });

  assert.equal(normalized.headline.length, 72);
  assert.equal(normalized.reason.length, 160);
  assert.equal(normalized.primaryAction.label.length, 32);
  assert.equal(normalized.primaryAction.categoryId, null);
  assert.equal(normalized.primaryAction.actionId, null);
  assert.equal(normalized.primaryAction.occurrenceId, null);
  assert.equal(normalized.primaryAction.dateKey, null);
  assert.equal(normalized.secondaryAction, null);
  assert.equal(normalized.suggestedDurationMin, null);
  assert.deepEqual(normalized.rewardSuggestion, { kind: "none", label: null });
});

test("runOpenAiCoach repairs raw JSON content with safe omissions and returns valid payload", async () => {
  const rawCandidate = {
    ...createValidCandidate(),
    headline: "H".repeat(90),
    primaryAction: {
      label: "L".repeat(40),
      intent: "start_occurrence",
      occurrenceId: "occ-1",
      dateKey: "2026-03-06",
    },
  };
  delete rawCandidate.secondaryAction;
  delete rawCandidate.rewardSuggestion;

  const app = createRunnerApp({
    parsed: null,
    content: JSON.stringify(rawCandidate),
  });

  const payload = await runOpenAiCoach({
    app,
    kind: "now",
    context: createNowContext(),
  });

  assert.equal(payload.headline.length, 72);
  assert.equal(payload.primaryAction.label.length, 32);
  assert.equal(payload.secondaryAction, null);
  assert.deepEqual(payload.rewardSuggestion, { kind: "none", label: null });
  assert.equal(payload.primaryAction.categoryId, null);
  assert.equal(payload.primaryAction.actionId, null);
});

test("runOpenAiCoach exposes stable issueCode for model refusal", async () => {
  const app = createRunnerApp({
    refusal: "cannot comply",
  });

  await assert.rejects(
    () =>
      runOpenAiCoach({
        app,
        kind: "now",
        context: createNowContext(),
      }),
    (error) => {
      assert.equal(isOpenAiModelOutputError(error), true);
      assert.equal(error.issueCode, MODEL_OUTPUT_ISSUE_CODE.MODEL_REFUSAL);
      return true;
    },
  );
});

test("runOpenAiCoach exposes stable issueCode for missing parsed payload", async () => {
  const app = createRunnerApp({
    parsed: null,
  });

  await assert.rejects(
    () =>
      runOpenAiCoach({
        app,
        kind: "now",
        context: createNowContext(),
      }),
    (error) => {
      assert.equal(isOpenAiModelOutputError(error), true);
      assert.equal(error.issueCode, MODEL_OUTPUT_ISSUE_CODE.MISSING_PARSED_PAYLOAD);
      return true;
    },
  );
});

test("runOpenAiCoach exposes stable issueCode for empty message", async () => {
  const app = createRunnerApp(null);

  await assert.rejects(
    () =>
      runOpenAiCoach({
        app,
        kind: "now",
        context: createNowContext(),
      }),
    (error) => {
      assert.equal(isOpenAiModelOutputError(error), true);
      assert.equal(error.issueCode, MODEL_OUTPUT_ISSUE_CODE.EMPTY_MESSAGE);
      return true;
    },
  );
});

test("classifyCoachPayloadIssue reports invalid_primary_action for invalid primaryAction.intent", () => {
  const invalidPayload = normalizeCoachPayloadCandidate({
    ...createValidCandidate(),
    primaryAction: {
      ...createValidCandidate().primaryAction,
      intent: "pause_session",
    },
  });

  const parsedResult = coachPayloadSchema.safeParse(invalidPayload);
  assert.equal(classifyCoachPayloadIssue(parsedResult.error), MODEL_OUTPUT_ISSUE_CODE.INVALID_PRIMARY_ACTION);
});

test("classifyCoachPayloadIssue reports missing_required_field when primaryAction is absent", () => {
  const invalidPayload = normalizeCoachPayloadCandidate({
    ...createValidCandidate(),
    primaryAction: undefined,
  });

  const parsedResult = coachPayloadSchema.safeParse(invalidPayload);
  assert.equal(classifyCoachPayloadIssue(parsedResult.error), MODEL_OUTPUT_ISSUE_CODE.MISSING_REQUIRED_FIELD);
});

test("classifyCoachPayloadIssue reports invalid_enum_value for invalid toolIntent", () => {
  const invalidPayload = normalizeCoachPayloadCandidate({
    ...createValidCandidate(),
    toolIntent: "suggest_unknown_tool",
  });

  const parsedResult = coachPayloadSchema.safeParse(invalidPayload);
  assert.equal(classifyCoachPayloadIssue(parsedResult.error), MODEL_OUTPUT_ISSUE_CODE.INVALID_ENUM_VALUE);
});

test("classifyCoachPayloadIssue reports invalid_reward_suggestion for invalid rewardSuggestion.kind", () => {
  const invalidPayload = normalizeCoachPayloadCandidate({
    ...createValidCandidate(),
    rewardSuggestion: {
      kind: "bonus_mode",
      label: "Petit bonus",
    },
  });

  const parsedResult = coachPayloadSchema.safeParse(invalidPayload);
  assert.equal(classifyCoachPayloadIssue(parsedResult.error), MODEL_OUTPUT_ISSUE_CODE.INVALID_REWARD_SUGGESTION);
});
