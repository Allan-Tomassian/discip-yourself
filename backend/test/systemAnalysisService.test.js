import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSystemAnalysisSystemPrompt,
  buildSystemAnalysisUserPrompt,
  resolveSystemAnalysisModelConfig,
  resolveSystemAnalysisModel,
  resolveSystemAnalysisPromptVersion,
  resolveSystemAnalysisTimeoutMs,
  runSystemAnalysisService,
} from "../src/services/systemAnalysis/systemAnalysisService.js";
import {
  systemAnalysisPublicResponseSchema,
  systemAnalysisRequestSchema,
} from "../src/schemas/systemAnalysis.js";

const PERIOD = { startDateKey: "2026-05-07", endDateKey: "2026-05-20", days: 14 };

function createSnapshot(overrides = {}) {
  return {
    version: 1,
    period: PERIOD,
    generatedAt: "2026-05-20T10:00:00.000Z",
    referenceDateKey: "2026-05-20",
    userWhy: "Construire un système d'exécution fiable.",
    firstRunSummary: { commitStatus: "applied", appliedAt: "2026-05-01" },
    goalsSummary: { totalCount: 2, outcomeCount: 1, processActionCount: 1 },
    actionsSummary: { totalCount: 1, tooManyActions: false },
    executionStats: { expectedCount: 12, outcomeCount: 6, completedCount: 4, frictionCount: 2, activeDayCount: 4 },
    sessionStats: { endedCount: 6, frictionCount: 1 },
    timePatterns: { weakWindows: [] },
    frictionPatterns: { blockedCount: 1, reportedCount: 1, byAction: [] },
    objectiveSignals: { neglectedObjectives: [] },
    planningLoadSignals: { overloadedDays: [] },
    systemSignals: [],
    adjustDiagnosticSummary: { state: "attention" },
    coachThemes: { rawTranscriptIncluded: false, messageCount: 0 },
    profilePreferences: { hasProfile: true },
    dataLimitations: [{ code: "missing_coach_themes", message: "No transcript included." }],
    sourceCounts: { categories: 1, goals: 2, occurrences: 12, sessionHistory: 6 },
    plannedSystem: {
      whyText: "Construire un système d'exécution fiable.",
      primaryObjective: { id: "out-1", title: "Ship" },
      capacity: { dailyMinutes: 60 },
      preferredWindows: [{ id: "morning", daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "11:00" }],
      unavailableWindows: [{ id: "evening", daysOfWeek: [1, 2, 3, 4, 5], startTime: "18:00", endTime: "22:00" }],
      weeklyPlannedLoad: { averageDailyMinutes: 45, maxDailyMinutes: 70 },
      nextBlockCoverage: { missingNextBlock: false, upcomingPlannedCount: 4 },
    },
    behaviorSystem: {
      completedCount: 4,
      missedCount: 1,
      reportedCount: 1,
      blockedCount: 1,
      sessionStarts: 6,
      activeDays: 4,
    },
    comparisonSignals: {
      loadVsCapacityMismatch: { detected: false },
      systemDrift: { detected: false },
    },
    confidenceBySignal: { loadVsCapacityMismatch: "medium" },
    analysisModeRecommendation: "behavioral_analysis",
    snapshotHash: "sas_test1234",
    ...overrides,
  };
}

function createState() {
  return {
    goals: [
      { id: "out-1", type: "OUTCOME", title: "Ship" },
      { id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" },
    ],
    occurrences: [
      { id: "occ-1", goalId: "act-1", date: "2026-05-20", start: "09:00", status: "planned" },
    ],
  };
}

function createValidResult(overrides = {}) {
  return {
    version: 2,
    period: PERIOD,
    analysisMode: "behavioral_analysis",
    diagnosisSummary: {
      primaryFinding: "Le système dépend trop d'un bloc concentré.",
      risk: "Le bloc principal devient fragile quand la charge augmente.",
      opportunity: "Un créneau plus stable peut réduire la friction.",
      evidence: [{
        source: "snapshot",
        dateKey: null,
        occurrenceId: "occ-1",
        historyId: null,
        actionId: "act-1",
        goalId: "out-1",
        objectiveId: "out-1",
        count: 1,
        facts: ["1 bloc principal observé"],
      }],
      confidence: 0.76,
    },
    executiveSummary: "Le système tient mieux quand la charge reste courte et claire.",
    invisibleFriction: [
      {
        title: "Charge concentrée",
        message: "Plusieurs blocs se concentrent sur peu de jours.",
        evidence: [{
          source: "planningLoadSignals",
          dateKey: null,
          occurrenceId: null,
          historyId: null,
          actionId: null,
          goalId: null,
          objectiveId: null,
          count: 2,
          facts: ["2 jours chargés"],
        }],
        confidence: 0.72,
      },
    ],
    systemWeaknesses: [],
    strongestPatterns: [],
    recommendedCorrections: [],
    correctionDraft: {
      version: 2,
      userConfirmationRequired: true,
      correctionItems: [
        {
          id: "ci-move-1",
          type: "occurrence_move",
          targetType: "occurrence",
          targetId: "occ-1",
          action: "move",
          title: "Déplacer le bloc",
          whatChanges: "Déplacer le bloc Deep work vers un créneau plus stable.",
          why: "Le créneau actuel concentre déjà trop d'effort.",
          evidence: [{
            source: "snapshot",
            dateKey: "2026-05-20",
            occurrenceId: "occ-1",
            historyId: null,
            actionId: "act-1",
            goalId: "out-1",
            objectiveId: "out-1",
            count: 1,
            facts: ["Bloc actuel à 09:00"],
          }],
          expectedImpact: "Rendre le bloc plus exécutable.",
          risk: "Risque faible si le créneau reste disponible.",
          confidence: 0.8,
          supportStatus: "applicable",
          destructive: false,
          confirmationLevel: "standard",
          validationRequirements: ["user_confirmation"],
          proposedDateKey: "2026-05-21",
          proposedStart: "10:00",
          proposedDurationMinutes: null,
          proposedLoad: null,
        },
      ],
      correctedLoad: {
        targetBlocksPerDay: 2,
        maxDailyMinutes: 60,
        reason: "Réduire la charge pour protéger l'exécution.",
      },
      occurrenceAdjustments: [
        {
          occurrenceId: "occ-1",
          action: "move",
          proposedDateKey: "2026-05-21",
          proposedStart: "10:00",
          proposedDurationMinutes: null,
          reason: "Déplacer le bloc vers un créneau plus stable.",
          confidence: 0.8,
        },
      ],
      objectiveAdjustments: [{ goalId: "out-1", action: "keep", reason: "Objectif encore cohérent.", confidence: null }],
      actionAdjustments: [{ actionId: "act-1", action: "protect", reason: "Action motrice du système.", confidence: null }],
      next7DaysPlan: [],
      validationRequirements: ["user_confirmation"],
    },
    next7DaysFocus: [],
    coachQuestions: ["Quel créneau reste réellement protégé ?"],
    confidence: 0.74,
    dataLimitations: ["Pas de transcription Coach brute incluse."],
    safetyNotes: ["Aucune correction n'a été appliquée."],
    generatedAt: "2026-05-20T10:01:00.000Z",
    modelMeta: {
      model: "provider-model",
      promptVersion: "provider-version",
      requestId: "provider-request",
      snapshotHash: null,
    },
    ...overrides,
  };
}

function createValidV1Result(overrides = {}) {
  const v2 = createValidResult();
  return {
    version: 1,
    period: PERIOD,
    executiveSummary: v2.executiveSummary,
    invisibleFriction: v2.invisibleFriction,
    systemWeaknesses: v2.systemWeaknesses,
    strongestPatterns: v2.strongestPatterns,
    recommendedCorrections: v2.recommendedCorrections,
    correctionDraft: {
      correctedLoad: v2.correctionDraft.correctedLoad,
      occurrenceAdjustments: v2.correctionDraft.occurrenceAdjustments,
      objectiveAdjustments: v2.correctionDraft.objectiveAdjustments,
      actionAdjustments: v2.correctionDraft.actionAdjustments,
      next7DaysPlan: v2.correctionDraft.next7DaysPlan,
      validationRequirements: v2.correctionDraft.validationRequirements,
      userConfirmationRequired: true,
    },
    next7DaysFocus: v2.next7DaysFocus,
    coachQuestions: v2.coachQuestions,
    confidence: v2.confidence,
    dataLimitations: v2.dataLimitations,
    safetyNotes: v2.safetyNotes,
    generatedAt: v2.generatedAt,
    modelMeta: v2.modelMeta,
    ...overrides,
  };
}

test("system analysis prompt includes safety, evidence, and no-mutation requirements", () => {
  const systemPrompt = buildSystemAnalysisSystemPrompt({ locale: "fr-FR" });
  const userPrompt = buildSystemAnalysisUserPrompt({
    context: {
      snapshot: createSnapshot(),
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-05-20",
      requestId: "req-1",
      promptVersion: "system_analysis_v2_0",
    },
  });

  assert.match(systemPrompt, /French|fr-FR|French \(fr-FR\)|French/i);
  assert.match(systemPrompt, /read-only/i);
  assert.match(systemPrompt, /Do not mutate/i);
  assert.match(systemPrompt, /medical/i);
  assert.match(systemPrompt, /guilt/i);
  assert.match(systemPrompt, /evidence/i);
  assert.match(systemPrompt, /long report|dashboard|analytics table/i);
  assert.match(userPrompt, /version must be 2/i);
  assert.match(userPrompt, /analysisMode/i);
  assert.match(userPrompt, /diagnosisSummary/i);
  assert.match(userPrompt, /correctionItems/i);
  assert.match(userPrompt, /plannedSystem/i);
  assert.match(userPrompt, /behaviorSystem/i);
  assert.match(userPrompt, /initial_analysis/i);
  assert.match(userPrompt, /hybrid_analysis/i);
  assert.match(userPrompt, /behavioral_analysis/i);
  assert.match(userPrompt, /Do not output a long essay/i);
  assert.match(userPrompt, /userConfirmationRequired must be true/i);
  assert.match(userPrompt, /system_analysis_v2_0/);
  assert.match(userPrompt, /sas_test1234/);
});

test("system analysis schemas accept enriched snapshots and preserve v1 response transition", () => {
  const request = systemAnalysisRequestSchema.safeParse({
    version: 1,
    snapshot: createSnapshot(),
    locale: "fr-FR",
    timezone: "Europe/Paris",
    referenceDateKey: "2026-05-20",
  });
  assert.equal(request.success, true);
  assert.equal(request.data.snapshot.plannedSystem.capacity.dailyMinutes, 60);

  assert.equal(systemAnalysisPublicResponseSchema.safeParse(createValidResult()).success, true);
  assert.equal(systemAnalysisPublicResponseSchema.safeParse(createValidV1Result()).success, true);
  assert.equal(systemAnalysisPublicResponseSchema.safeParse(createValidResult({ analysisMode: "unsupported_mode" })).success, false);
  assert.equal(
    systemAnalysisPublicResponseSchema.safeParse(createValidResult({
      correctionDraft: {
        ...createValidResult().correctionDraft,
        correctionItems: [
          {
            ...createValidResult().correctionDraft.correctionItems[0],
            action: "remove",
            destructive: true,
            confirmationLevel: "destructive",
            supportStatus: "applicable",
          },
        ],
      },
    })).success,
    false
  );
});

test("runSystemAnalysisService uses dedicated model, timeout, prompt version, and structured output", async () => {
  let requestedModel = null;
  let requestedTimeout = null;
  let requestedResponseFormat = null;
  let requestedUserPrompt = null;
  const app = {
    config: {
      OPENAI_API_KEY: "test-key",
      SYSTEM_ANALYSIS_MODEL: "gpt-system-analysis",
      SYSTEM_ANALYSIS_TIMEOUT_MS: 88000,
      SYSTEM_ANALYSIS_PROMPT_VERSION: "system_analysis_test_v9",
    },
    openai: {
      chat: {
        completions: {
          parse: async (input, options) => {
            requestedModel = input?.model || null;
            requestedResponseFormat = input?.response_format || null;
            requestedUserPrompt = input?.messages?.[1]?.content || "";
            requestedTimeout = options?.timeout ?? null;
            return {
              choices: [{ message: { parsed: createValidResult() } }],
            };
          },
        },
      },
    },
  };

  const result = await runSystemAnalysisService({
    app,
    context: {
      snapshot: createSnapshot(),
      state: createState(),
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-05-20",
      requestId: "req-service",
    },
  });

  assert.equal(requestedModel, "gpt-system-analysis");
  assert.equal(requestedTimeout, 88000);
  assert.equal(requestedResponseFormat?.type, "json_schema");
  assert.match(requestedUserPrompt, /system_analysis_test_v9/);
  assert.equal(result.response.modelMeta.model, "gpt-system-analysis");
  assert.equal(result.response.modelMeta.promptVersion, "system_analysis_test_v9");
  assert.equal(result.response.modelMeta.requestId, "req-service");
  assert.equal(result.diagnostics.modelClass, "premium_deep_analysis");
});

test("system analysis config helpers apply defaults and timeout cap", () => {
  assert.equal(resolveSystemAnalysisModelConfig({ config: {} }).modelClass, "premium_deep_analysis");
  assert.equal(resolveSystemAnalysisModel({ config: {} }), "gpt-5.4");
  assert.equal(resolveSystemAnalysisPromptVersion({ config: {} }), "system_analysis_v2_0");
  assert.equal(resolveSystemAnalysisTimeoutMs({ config: {} }), 65000);
  assert.equal(resolveSystemAnalysisTimeoutMs({ config: { SYSTEM_ANALYSIS_TIMEOUT_MS: 120000 } }), 90000);
});

test("runSystemAnalysisService keeps guilt language as a warning-level governance issue", async () => {
  const app = {
    config: {
      OPENAI_API_KEY: "test-key",
    },
    openai: {
      chat: {
        completions: {
          parse: async () => ({
            choices: [
              {
                message: {
                  parsed: createValidResult({
                    executiveSummary: "Tu es paresseux, donc le système doit être simplifié.",
                  }),
                },
              },
            ],
          }),
        },
      },
    },
  };

  const result = await runSystemAnalysisService({
    app,
    context: {
      snapshot: createSnapshot(),
      state: createState(),
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-05-20",
      requestId: "req-warning",
    },
  });

  assert.equal(result.response.executiveSummary.includes("paresseux"), true);
  assert.equal(
    result.diagnostics.governanceIssues.some((issue) => issue.code === "GUILT_LANGUAGE_DETECTED" && issue.severity === "warning"),
    true
  );
});

test("runSystemAnalysisService rejects unsafe v2 correction items", async () => {
  const cases = [
    {
      name: "invented target",
      result: createValidResult({
        correctionDraft: {
          ...createValidResult().correctionDraft,
          correctionItems: [
            {
              ...createValidResult().correctionDraft.correctionItems[0],
              targetId: "missing-occ",
            },
          ],
        },
      }),
      expectedCode: "UNKNOWN_OCCURRENCE_REFERENCE",
    },
    {
      name: "unavailable window",
      result: createValidResult({
        correctionDraft: {
          ...createValidResult().correctionDraft,
          correctionItems: [
            {
              ...createValidResult().correctionDraft.correctionItems[0],
              proposedDateKey: "2026-05-21",
              proposedStart: "19:00",
            },
          ],
        },
      }),
      expectedCode: "CORRECTION_TIME_CONFLICTS_WITH_UNAVAILABLE_WINDOW",
    },
    {
      name: "capacity overage",
      result: createValidResult({
        correctionDraft: {
          ...createValidResult().correctionDraft,
          correctionItems: [
            {
              ...createValidResult().correctionDraft.correctionItems[0],
              supportStatus: "needs_review",
              proposedLoad: { dailyMinutes: 90, maxDailyMinutes: 90 },
            },
          ],
        },
      }),
      expectedCode: "CORRECTION_LOAD_EXCEEDS_CAPACITY",
    },
  ];

  for (const testCase of cases) {
    const app = {
      config: { OPENAI_API_KEY: "test-key" },
      openai: {
        chat: {
          completions: {
            parse: async () => ({
              choices: [{ message: { parsed: testCase.result } }],
            }),
          },
        },
      },
    };

    await assert.rejects(
      () =>
        runSystemAnalysisService({
          app,
          context: {
            snapshot: createSnapshot(),
            state: createState(),
            locale: "fr-FR",
            timezone: "Europe/Paris",
            referenceDateKey: "2026-05-20",
            requestId: `req-${testCase.name}`,
          },
        }),
      (error) => {
        assert.equal(error.code, "INVALID_SYSTEM_ANALYSIS_RESPONSE");
        assert.equal(error.details.governanceIssues.some((issue) => issue.code === testCase.expectedCode), true);
        return true;
      }
    );
  }
});
