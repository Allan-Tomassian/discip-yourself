import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyCoachPayloadIssue,
  isOpenAiModelOutputError,
  MODEL_OUTPUT_ISSUE_CODE,
  normalizeCoachPayloadCandidate,
  runOpenAiCoach,
} from "../src/services/coach/openaiRunner.js";
import { coachConversationResponseSchema, coachPayloadSchema } from "../src/schemas/coach.js";

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

function createChatContext(overrides = {}) {
  return {
    activeDate: "2026-03-06",
    activeCategoryId: "cat-1",
    chatMode: "free",
    locale: "fr-FR",
    useCase: "general",
    recentMessages: [
      { role: "assistant", content: "On repart sur quelque chose de simple." },
      { role: "user", content: "Je veux éviter de me disperser." },
    ],
    message: "Que dois-je faire maintenant ?",
    planningSummary: null,
    pilotageSummary: null,
    quotaRemaining: 3,
    category: null,
    activeCategoryProfileSummary: null,
    relatedCategoryProfileSummaries: [],
    userAiProfile: null,
    availableCategories: [],
    actionSummaries: [],
    activeCategoryLabel: "Focus",
    ...overrides,
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

test("runOpenAiCoach forwards chat locale to the system prompt", async () => {
  let parseArgs = null;
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async (args) => {
            parseArgs = args;
            return {
              choices: [{
                message: {
                  parsed: {
                    kind: "conversation",
                    mode: "free",
                    message: "On peut repartir avec un seul pas clair aujourd’hui.",
                    primaryAction: null,
                    secondaryAction: null,
                    proposal: null,
                  },
                },
              }],
            };
          },
        },
      },
    },
  };

  const payload = await runOpenAiCoach({
    app,
    kind: "chat",
    context: createChatContext({
      chatMode: "free",
      locale: "fr-CA",
      recentMessages: [],
      message: "Bonjour",
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.match(parseArgs.messages[0].content, /French \(fr-CA\)/);
});

test("runOpenAiCoach uses an object root schema for free chat response_format", async () => {
  let parseArgs = null;
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async (args) => {
            parseArgs = args;
            return {
              choices: [{
                message: {
                  parsed: {
                    kind: "conversation",
                    mode: "free",
                    message: "On repart avec un pas concret.",
                    primaryAction: null,
                    secondaryAction: null,
                    proposal: null,
                  },
                },
              }],
            };
          },
        },
      },
    },
  };

  const payload = await runOpenAiCoach({
    app,
    kind: "chat",
    context: createChatContext({
      chatMode: "free",
      message: "Bonjour",
      recentMessages: [],
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.equal(parseArgs.response_format.json_schema.name, "coach_conversation_free_payload");
  assert.equal(parseArgs.response_format.json_schema.schema.type, "object");
});

test("runOpenAiCoach uses an object root schema for plan chat response_format", async () => {
  let parseArgs = null;
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async (args) => {
            parseArgs = args;
            return {
              choices: [{
                message: {
                  parsed: {
                    kind: "conversation",
                    mode: "plan",
                    message: "Je te propose une structure courte et tenable.",
                    primaryAction: null,
                    secondaryAction: null,
                    proposal: {
                      kind: "guided",
                      categoryDraft: {
                        mode: "existing",
                        id: "cat-1",
                        label: "Focus",
                      },
                      outcomeDraft: {
                        title: "Clarifier le prochain pas",
                        categoryId: "cat-1",
                        priority: "prioritaire",
                        startDate: "2026-03-06",
                        deadline: null,
                        measureType: null,
                        targetValue: null,
                        notes: null,
                      },
                      actionDrafts: [],
                      unresolvedQuestions: [],
                      requiresValidation: true,
                    },
                  },
                },
              }],
            };
          },
        },
      },
    },
  };

  const payload = await runOpenAiCoach({
    app,
    kind: "chat",
    context: createChatContext({
      chatMode: "plan",
      message: "Aide-moi à structurer ça.",
      recentMessages: [],
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "plan");
  assert.equal(parseArgs.response_format.json_schema.name, "coach_conversation_plan_payload");
  assert.equal(parseArgs.response_format.json_schema.schema.type, "object");
});

test("runOpenAiCoach prioritizes latestUserMessage in the free conversation prompt", async () => {
  let userPrompt = "";
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async (args) => {
            userPrompt = args.messages[1].content;
            return {
              choices: [
                {
                  message: {
                    parsed: {
                      kind: "conversation",
                      mode: "free",
                      message: "Réponds d’abord à ta question, puis garde un seul prochain pas.",
                      primaryAction: null,
                      secondaryAction: null,
                      proposal: null,
                    },
                  },
                },
              ],
            };
          },
        },
      },
    },
  };

  const payload = await runOpenAiCoach({
    app,
    kind: "chat",
    context: createChatContext({
      chatMode: "free",
      message: "Que dois-je faire maintenant ?",
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.match(userPrompt, /Respond first and directly to latestUserMessage\./);
  assert.match(userPrompt, /If latestUserMessage asks a question, answer that question before suggesting anything else\./);
  assert.match(userPrompt, /Use recentMessages only for continuity and relevant references\./);
  assert.match(
    userPrompt,
    /Do not mechanically repeat, summarize, or paraphrase the previous assistant reply unless the user explicitly asks for that\./,
  );
  assert.ok(userPrompt.includes('"latestUserMessage":"Que dois-je faire maintenant ?"'));
  assert.ok(userPrompt.includes('"recentMessages":['));
  assert.ok(userPrompt.indexOf('"latestUserMessage"') < userPrompt.indexOf('"recentMessages"'));
});

test("runOpenAiCoach prioritizes latestUserMessage in the plan conversation prompt", async () => {
  let userPrompt = "";
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async (args) => {
            userPrompt = args.messages[1].content;
            return {
              choices: [
                {
                  message: {
                    parsed: {
                      kind: "conversation",
                      mode: "plan",
                      message: "On peut cadrer une proposition légère à partir de ton besoin immédiat.",
                      primaryAction: null,
                      secondaryAction: null,
                      proposal: {
                        kind: "guided",
                        categoryDraft: {
                          mode: "existing",
                          id: "cat-1",
                          label: "Focus",
                        },
                        outcomeDraft: {
                          title: "Stabiliser un prochain pas",
                          categoryId: "cat-1",
                          priority: "prioritaire",
                          startDate: "2026-03-06",
                          deadline: null,
                          measureType: null,
                          targetValue: null,
                          notes: null,
                        },
                        actionDrafts: [],
                        unresolvedQuestions: [],
                        requiresValidation: true,
                      },
                    },
                  },
                },
              ],
            };
          },
        },
      },
    },
  };

  const payload = await runOpenAiCoach({
    app,
    kind: "chat",
    context: createChatContext({
      chatMode: "plan",
      message: "Aide-moi à structurer le prochain pas sans repartir de zéro.",
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "plan");
  assert.match(userPrompt, /Respond first and directly to latestUserMessage, then converge to a small actionable proposal\./);
  assert.match(userPrompt, /If latestUserMessage asks a question, answer it before expanding the proposal\./);
  assert.match(userPrompt, /Use recentMessages only for continuity and relevant references\./);
  assert.match(
    userPrompt,
    /Do not restart from or mechanically paraphrase the previous assistant reply unless the user explicitly asks for it\./,
  );
  assert.ok(userPrompt.includes('"latestUserMessage":"Aide-moi à structurer le prochain pas sans repartir de zéro."'));
  assert.ok(userPrompt.includes('"recentMessages":['));
  assert.ok(userPrompt.indexOf('"latestUserMessage"') < userPrompt.indexOf('"recentMessages"'));
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

test("coach conversation schema rejects a free reply carrying a proposal", () => {
  const parsedResult = coachConversationResponseSchema.safeParse({
    kind: "conversation",
    mode: "free",
    decisionSource: "rules",
    message: "On peut clarifier sans créer tout de suite.",
    primaryAction: null,
    secondaryAction: null,
    proposal: {
      kind: "guided",
      categoryDraft: null,
      outcomeDraft: null,
      actionDrafts: [],
      unresolvedQuestions: [],
      requiresValidation: true,
    },
    meta: {
      coachVersion: "v1",
      requestId: "req_free_invalid",
      selectedDateKey: "2026-03-06",
      activeCategoryId: null,
      quotaRemaining: 3,
      fallbackReason: "none",
      messagePreview: "Clarifie ma situation",
    },
  });

  assert.equal(parsedResult.success, false);
});
