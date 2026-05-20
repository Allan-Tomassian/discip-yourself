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
    version: 1,
    period: PERIOD,
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
      userConfirmationRequired: true,
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

test("system analysis prompt includes safety, evidence, and no-mutation requirements", () => {
  const systemPrompt = buildSystemAnalysisSystemPrompt({ locale: "fr-FR" });
  const userPrompt = buildSystemAnalysisUserPrompt({
    context: {
      snapshot: createSnapshot(),
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-05-20",
      requestId: "req-1",
      promptVersion: "system_analysis_v1_0",
    },
  });

  assert.match(systemPrompt, /French|fr-FR|French \(fr-FR\)|French/i);
  assert.match(systemPrompt, /read-only/i);
  assert.match(systemPrompt, /Do not mutate/i);
  assert.match(systemPrompt, /medical/i);
  assert.match(systemPrompt, /guilt/i);
  assert.match(systemPrompt, /evidence/i);
  assert.match(userPrompt, /userConfirmationRequired must be true/i);
  assert.match(userPrompt, /system_analysis_v1_0/);
  assert.match(userPrompt, /sas_test1234/);
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
  assert.equal(resolveSystemAnalysisPromptVersion({ config: {} }), "system_analysis_v1_0");
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
