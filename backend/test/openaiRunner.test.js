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
    coachBehavior: {
      mode: "normal",
      overlays: [],
      horizon: "now",
      intensity: "soft",
    },
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
      coachBehavior: {
        mode: "action",
        overlays: ["choice_narrowing"],
        horizon: "today",
        intensity: "standard",
      },
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
  assert.match(userPrompt, /Behavior mode: action/);
  assert.match(userPrompt, /Behavior overlays: choice_narrowing/);
  assert.match(userPrompt, /Behavior horizon: today/);
  assert.match(userPrompt, /Behavior intensity: standard/);
  assert.match(userPrompt, /latestUserMessage is the primary source of truth\./);
  assert.match(userPrompt, /recentMessages are only for light disambiguation\./);
  assert.ok(userPrompt.includes('"latestUserMessage":"Que dois-je faire maintenant ?"'));
  assert.ok(userPrompt.includes('"recentMessages":['));
  assert.ok(userPrompt.indexOf('"latestUserMessage"') < userPrompt.indexOf('"recentMessages"'));
});

test("runOpenAiCoach ignores recentMessages for a simple greeting and suppresses CTA", async () => {
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
                      message: "Bonjour, je suis là.",
                      primaryAction: {
                        label: "Voir Today",
                        intent: "open_today",
                        categoryId: "cat-1",
                        actionId: null,
                        occurrenceId: null,
                        dateKey: "2026-03-06",
                      },
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
      message: "Bonjour",
      recentMessages: [
        { role: "assistant", content: "Hier on parlait de ton budget." },
        { role: "user", content: "Je veux avancer sur mes finances." },
      ],
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.equal(payload.primaryAction, null);
  assert.match(userPrompt, /This is a simple greeting\./);
  assert.match(userPrompt, /Ignore recentMessages for the response\./);
  assert.match(userPrompt, /If latestUserMessage is only a greeting, answer briefly, do not reuse recentMessages, and return primaryAction as null\./);
  assert.ok(userPrompt.includes('"recentMessages":[]'));
  assert.equal(userPrompt.includes("Hier on parlait de ton budget"), false);
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
      coachBehavior: {
        mode: "clarity",
        overlays: ["plan_builder", "honest_audit"],
        horizon: "short_plan",
        intensity: "direct",
      },
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
  assert.match(userPrompt, /Behavior mode: clarity/);
  assert.match(userPrompt, /Behavior overlays: plan_builder, honest_audit|Behavior overlays: honest_audit, plan_builder/);
  assert.match(userPrompt, /Behavior horizon: short_plan/);
  assert.match(userPrompt, /Behavior intensity: direct/);
  assert.match(userPrompt, /If honest_audit is active, tell the useful truth clearly and tactfully\./);
  assert.match(userPrompt, /If plan_builder is active, you may structure up to 3 small blocks in the proposal\./);
  assert.ok(userPrompt.includes('"latestUserMessage":"Aide-moi à structurer le prochain pas sans repartir de zéro."'));
  assert.ok(userPrompt.includes('"recentMessages":['));
  assert.ok(userPrompt.indexOf('"latestUserMessage"') < userPrompt.indexOf('"recentMessages"'));
});

test("runOpenAiCoach keeps action mode focused on immediate execution without reset advice by default", async () => {
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
                      message: "Lance un bloc de 10 minutes tout de suite.",
                      primaryAction: {
                        label: "Voir Today",
                        intent: "open_today",
                        categoryId: "cat-1",
                        actionId: null,
                        occurrenceId: null,
                        dateKey: "2026-03-06",
                      },
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
      coachBehavior: {
        mode: "action",
        overlays: [],
        horizon: "now",
        intensity: "standard",
      },
      message: "J’ai du mal à démarrer, aide-moi à m’y mettre maintenant.",
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.match(userPrompt, /Action mode is not reset mode\./);
  assert.match(
    userPrompt,
    /Prioritize immediate execution with one low-friction start, one short block, and one clear next step\./,
  );
  assert.match(
    userPrompt,
    /Do not suggest meditation, breathing, walking, pausing, body reset, or relaxation here\./,
  );
  assert.match(userPrompt, /Orient the answer toward doing something now, not toward regulating yourself first\./);
});

test("runOpenAiCoach prevents plan_builder from inventing a domain and asks for neutral clarification", async () => {
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
                      message: "Avant de cadrer ça, il me manque juste le domaine visé.",
                      primaryAction: null,
                      secondaryAction: null,
                      proposal: {
                        kind: "guided",
                        categoryDraft: {
                          mode: "unresolved",
                          id: null,
                          label: null,
                        },
                        outcomeDraft: null,
                        actionDrafts: [],
                        unresolvedQuestions: ["Dans quelle catégorie veux-tu avancer ?"],
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
      coachBehavior: {
        mode: "clarity",
        overlays: ["plan_builder"],
        horizon: "short_plan",
        intensity: "standard",
      },
      message: "Aide-moi à organiser mes deux prochains jours",
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "plan");
  assert.match(userPrompt, /Do not assume a domain the user did not explicitly mention\./);
  assert.match(
    userPrompt,
    /Never invent a health, sport, food, sleep, or similar goal unless the user named it\./,
  );
  assert.match(
    userPrompt,
    /The domain is still unclear in latestUserMessage\./,
  );
  assert.match(
    userPrompt,
    /Do not name work, health, sport, sleep, admin, or any other domain in the answer or proposal\./,
  );
  assert.match(
    userPrompt,
    /Either give a very generic structure or ask one neutral clarification question\./,
  );
  assert.equal(userPrompt.includes("deep work"), false);
  assert.equal(userPrompt.includes("rythme de travail stable"), false);
});

test("runOpenAiCoach suppresses CTA in free plan_builder chat when the domain is still unclear", async () => {
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
                      message: "On peut cadrer ça en deux temps, mais il me manque encore le domaine.",
                      primaryAction: {
                        label: "Structurer",
                        intent: "open_pilotage",
                        categoryId: "cat-1",
                        actionId: null,
                        occurrenceId: null,
                        dateKey: "2026-03-06",
                      },
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
      coachBehavior: {
        mode: "clarity",
        overlays: ["plan_builder"],
        horizon: "short_plan",
        intensity: "standard",
      },
      message: "Aide-moi à organiser mes deux prochains jours",
      recentMessages: [],
      activeCategoryLabel: null,
      category: null,
      availableCategories: [],
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.equal(payload.primaryAction, null);
  assert.match(userPrompt, /In free mode, do not use primaryAction for plan_builder while the domain is still unclear\./);
});

test("runOpenAiCoach keeps honest_audit hypothetical when evidence is weak and suppresses CTA in free chat", async () => {
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
                      message: "Le problème semble être un cadre qui se disperse vite.",
                      primaryAction: {
                        label: "Voir Today",
                        intent: "open_today",
                        categoryId: "cat-1",
                        actionId: null,
                        occurrenceId: null,
                        dateKey: "2026-03-06",
                      },
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
      coachBehavior: {
        mode: "clarity",
        overlays: ["honest_audit"],
        horizon: "pattern",
        intensity: "direct",
      },
      message: "Dis-moi franchement ce qui ne va pas.",
      recentMessages: [],
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.equal(payload.primaryAction, null);
  assert.match(
    userPrompt,
    /If evidence is weak, frame the audit as a hypothesis such as 'Le problème semble être\.\.\.' or 'J’ai l’impression que\.\.\.' instead of a categorical diagnosis\./,
  );
  assert.match(userPrompt, /Base the audit on latestUserMessage and explicit context only\./);
});

test("runOpenAiCoach keeps choice_narrowing to 2 options max and asks for a clear recommendation", async () => {
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
                      message: "Je te recommande la première option car elle est plus simple à tenir.",
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
                          title: "Choisir une piste simple",
                          categoryId: "cat-1",
                          priority: "prioritaire",
                          startDate: "2026-03-06",
                          deadline: null,
                          measureType: null,
                          targetValue: null,
                          notes: null,
                        },
                        actionDrafts: [
                          { title: "Option 1", categoryId: "cat-1" },
                          { title: "Option 2", categoryId: "cat-1" },
                          { title: "Option 3", categoryId: "cat-1" },
                        ],
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
      coachBehavior: {
        mode: "clarity",
        overlays: ["choice_narrowing"],
        horizon: "now",
        intensity: "standard",
      },
      message: "Je ne sais pas laquelle choisir.",
      recentMessages: [],
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "plan");
  assert.equal(payload.proposal.actionDrafts.length, 2);
  assert.match(userPrompt, /If choice_narrowing is active, reduce to 2 options maximum and recommend 1\./);
  assert.match(userPrompt, /State the recommendation explicitly, for example: Je te recommande l'option 1\./);
  assert.match(userPrompt, /Explain briefly why the recommended option is the better pick\./);
  assert.match(userPrompt, /Do not stay vague and do not end with only an open question\./);
});

test("runOpenAiCoach suppresses CTA in free choice_narrowing chat while the choice is still unstable", async () => {
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
                      message: "Je te recommande l’option 1, plus simple à lancer aujourd’hui.",
                      primaryAction: {
                        label: "Voir Today",
                        intent: "open_today",
                        categoryId: "cat-1",
                        actionId: null,
                        occurrenceId: null,
                        dateKey: "2026-03-06",
                      },
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
      coachBehavior: {
        mode: "clarity",
        overlays: ["choice_narrowing"],
        horizon: "now",
        intensity: "standard",
      },
      message: "Je veux faire une activité mais je ne sais pas laquelle.",
      recentMessages: [],
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.equal(payload.primaryAction, null);
  assert.match(userPrompt, /In free mode, do not return primaryAction while the choice is still being narrowed\./);
  assert.match(userPrompt, /In free mode, do not use primaryAction for choice_narrowing while the choice is still unstable\./);
});

test("runOpenAiCoach clamps plan proposal drafts to 1 without plan_builder and forces secondaryAction to null", async () => {
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async () => ({
            choices: [
              {
                message: {
                  parsed: {
                    kind: "conversation",
                    mode: "plan",
                    message: "On garde une seule piste claire.",
                    primaryAction: null,
                    secondaryAction: {
                      label: "Voir Today",
                      intent: "open_today",
                      categoryId: "cat-1",
                      actionId: null,
                      occurrenceId: null,
                      dateKey: "2026-03-06",
                    },
                    proposal: {
                      kind: "guided",
                      categoryDraft: {
                        mode: "existing",
                        id: "cat-1",
                        label: "Focus",
                      },
                      outcomeDraft: {
                        title: "Retrouver un cadre simple",
                        categoryId: "cat-1",
                        priority: "prioritaire",
                        startDate: "2026-03-06",
                        deadline: null,
                        measureType: null,
                        targetValue: null,
                        notes: null,
                      },
                      actionDrafts: [
                        { title: "Bloc 1", categoryId: "cat-1" },
                        { title: "Bloc 2", categoryId: "cat-1" },
                        { title: "Bloc 3", categoryId: "cat-1" },
                      ],
                      unresolvedQuestions: [],
                      requiresValidation: true,
                    },
                  },
                },
              },
            ],
          }),
        },
      },
    },
  };

  const payload = await runOpenAiCoach({
    app,
    kind: "chat",
    context: createChatContext({
      chatMode: "plan",
      coachBehavior: {
        mode: "clarity",
        overlays: [],
        horizon: "short_plan",
        intensity: "standard",
      },
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "plan");
  assert.equal(payload.secondaryAction, null);
  assert.equal(payload.proposal.actionDrafts.length, 1);
});

test("runOpenAiCoach allows up to 3 plan proposal drafts with plan_builder and forces secondaryAction to null", async () => {
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async () => ({
            choices: [
              {
                message: {
                  parsed: {
                    kind: "conversation",
                    mode: "plan",
                    message: "On garde trois blocs maximum.",
                    primaryAction: null,
                    secondaryAction: {
                      label: "Voir Today",
                      intent: "open_today",
                      categoryId: "cat-1",
                      actionId: null,
                      occurrenceId: null,
                      dateKey: "2026-03-06",
                    },
                    proposal: {
                      kind: "guided",
                      categoryDraft: {
                        mode: "existing",
                        id: "cat-1",
                        label: "Focus",
                      },
                      outcomeDraft: {
                        title: "Cadre 3 jours",
                        categoryId: "cat-1",
                        priority: "prioritaire",
                        startDate: "2026-03-06",
                        deadline: null,
                        measureType: null,
                        targetValue: null,
                        notes: null,
                      },
                      actionDrafts: [
                        { title: "Bloc 1", categoryId: "cat-1" },
                        { title: "Bloc 2", categoryId: "cat-1" },
                        { title: "Bloc 3", categoryId: "cat-1" },
                        { title: "Bloc 4", categoryId: "cat-1" },
                      ],
                      unresolvedQuestions: [],
                      requiresValidation: true,
                    },
                  },
                },
              },
            ],
          }),
        },
      },
    },
  };

  const payload = await runOpenAiCoach({
    app,
    kind: "chat",
    context: createChatContext({
      chatMode: "plan",
      coachBehavior: {
        mode: "clarity",
        overlays: ["plan_builder"],
        horizon: "short_plan",
        intensity: "standard",
      },
    }),
  });

  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "plan");
  assert.equal(payload.secondaryAction, null);
  assert.equal(payload.proposal.actionDrafts.length, 3);
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
