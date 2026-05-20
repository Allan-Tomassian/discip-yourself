import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAiBackendWarmupStateForTests } from "./aiBackendWarmup";
import { requestAiSystemAnalysis } from "./aiSystemAnalysisClient";

const PERIOD = { startDateKey: "2026-05-07", endDateKey: "2026-05-20", days: 14 };

function stateFixture() {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      { id: "out_focus", type: "OUTCOME", title: "Livrer", categoryId: "cat_work" },
      { id: "act_focus", type: "PROCESS", title: "Focus profond", categoryId: "cat_work", parentId: "out_focus" },
    ],
    occurrences: [{ id: "occ_focus", goalId: "act_focus", date: "2026-05-20", start: "09:00", durationMinutes: 45, status: "planned" }],
  };
}

function snapshotFixture() {
  return {
    version: 1,
    period: PERIOD,
    referenceDateKey: "2026-05-20",
    firstRunSummary: {},
    goalsSummary: {},
    actionsSummary: {},
    executionStats: {},
    sessionStats: {},
    timePatterns: {},
    frictionPatterns: {},
    objectiveSignals: {},
    planningLoadSignals: {},
    systemSignals: [],
    adjustDiagnosticSummary: {},
    coachThemes: {},
    profilePreferences: {},
    dataLimitations: [{ code: "compact_snapshot" }],
    sourceCounts: { occurrences: 1 },
    snapshotHash: "snapshot_hash",
  };
}

function finding(title, message = "Signal confirmé par le snapshot.") {
  return {
    title,
    message,
    evidence: [{
      source: "snapshot",
      dateKey: "2026-05-20",
      occurrenceId: "occ_focus",
      historyId: null,
      actionId: "act_focus",
      goalId: "out_focus",
      objectiveId: "out_focus",
      count: 1,
      facts: ["1 bloc observé"],
    }],
    confidence: 0.8,
  };
}

function resultFixture(overrides = {}) {
  return {
    version: 1,
    period: PERIOD,
    executiveSummary: "Ton système est utile mais la charge doit être clarifiée.",
    invisibleFriction: [finding("Charge concentrée")],
    systemWeaknesses: [],
    strongestPatterns: [finding("Matin solide")],
    recommendedCorrections: [finding("Réduire un bloc")],
    correctionDraft: {
      correctedLoad: {
        targetBlocksPerDay: 2,
        maxDailyMinutes: 90,
        reason: "Réduire la charge protège l’exécution.",
      },
      occurrenceAdjustments: [{
        occurrenceId: "occ_focus",
        action: "reduce_duration",
        proposedDateKey: null,
        proposedStart: null,
        proposedDurationMinutes: 30,
        reason: "Version plus courte.",
        confidence: 0.7,
      }],
      objectiveAdjustments: [{ goalId: "out_focus", action: "keep", reason: "Objectif cohérent.", confidence: 0.8 }],
      actionAdjustments: [{ actionId: "act_focus", action: "shorten", reason: "Action trop longue.", confidence: 0.8 }],
      next7DaysPlan: [],
      validationRequirements: ["Confirmer la réduction de durée"],
      userConfirmationRequired: true,
    },
    next7DaysFocus: [finding("Protéger le matin")],
    coachQuestions: ["Quel bloc protège le mieux ton objectif ?"],
    confidence: 0.78,
    dataLimitations: ["Snapshot compact."],
    safetyNotes: ["Aucune modification appliquée."],
    generatedAt: "2026-05-20T10:00:00.000Z",
    modelMeta: {
      model: "gpt-system-analysis",
      promptVersion: "system_analysis_v1_0",
      requestId: "req_analysis",
      snapshotHash: "snapshot_hash",
    },
    ...overrides,
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function baseArgs(overrides = {}) {
  return {
    snapshot: snapshotFixture(),
    state: stateFixture(),
    locale: "fr-FR",
    timezone: "Europe/Paris",
    referenceDateKey: "2026-05-20",
    accessToken: "token_test",
    baseUrl: "https://api.example.test",
    ...overrides,
  };
}

describe("requestAiSystemAnalysis", () => {
  afterEach(() => {
    resetAiBackendWarmupStateForTests();
    vi.unstubAllGlobals();
  });

  it("sends the snapshot, auth token, locale, timezone, and reference date", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(resultFixture()));

    const result = await requestAiSystemAnalysis(baseArgs({ fetchImpl }));

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.test/ai/system-analysis");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer token_test");
    expect(options.headers["x-discip-surface"]).toBe("system_analysis");
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      version: 1,
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-05-20",
    });
    expect(body.snapshot.snapshotHash).toBe("snapshot_hash");
    expect(result.result.executiveSummary).toContain("Ton système");
  });

  it("rejects an invalid successful response through frontend validation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ version: 1, period: PERIOD }));

    const result = await requestAiSystemAnalysis(baseArgs({ fetchImpl }));

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("INVALID_SYSTEM_ANALYSIS_RESPONSE");
    expect(result.validationIssues.length).toBeGreaterThan(0);
  });

  it.each([
    [403, "PREMIUM_REQUIRED", "PREMIUM_REQUIRED"],
    [422, "SYSTEM_ANALYSIS_INELIGIBLE", "SYSTEM_ANALYSIS_INELIGIBLE"],
    [504, "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT", "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT"],
    [502, "INVALID_SYSTEM_ANALYSIS_RESPONSE", "INVALID_SYSTEM_ANALYSIS_RESPONSE"],
    [429, "SYSTEM_ANALYSIS_QUOTA_EXCEEDED", "SYSTEM_ANALYSIS_QUOTA_EXCEEDED"],
    [429, "QUOTA_EXCEEDED", "QUOTA_EXCEEDED"],
    [429, "RATE_LIMITED", "RATE_LIMITED"],
    [503, "SYSTEM_ANALYSIS_BACKEND_UNAVAILABLE", "BACKEND_UNAVAILABLE"],
    [418, "UNEXPECTED", "UNKNOWN"],
  ])("maps backend error %s/%s to %s", async (status, backendCode, expectedCode) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      error: backendCode,
      message: "Backend error.",
      requestId: "req_error",
      missingRequirements: backendCode === "SYSTEM_ANALYSIS_INELIGIBLE"
        ? [{ code: "not_enough_data", label: "Pas assez de blocs" }]
        : undefined,
    }, status));

    const result = await requestAiSystemAnalysis(baseArgs({ fetchImpl }));

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(expectedCode);
    expect(result.requestId).toBe("req_error");
  });

  it("preserves system analysis quota metadata from the backend", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      error: "SYSTEM_ANALYSIS_QUOTA_EXCEEDED",
      message: "System analysis monthly quota exceeded.",
      requestId: "req_quota",
      quota: {
        used: 2,
        limit: 2,
        remaining: 0,
        resetAt: "2026-06-01T00:00:00.000Z",
      },
    }, 429));

    const result = await requestAiSystemAnalysis(baseArgs({ fetchImpl }));

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("SYSTEM_ANALYSIS_QUOTA_EXCEEDED");
    expect(result.errorDetails).toMatchObject({
      quota: {
        used: 2,
        limit: 2,
        remaining: 0,
        resetAt: "2026-06-01T00:00:00.000Z",
      },
    });
  });

  it("supports an external AbortSignal without treating navigation aborts as provider timeouts", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));

    const result = await requestAiSystemAnalysis(baseArgs({ fetchImpl, signal: controller.signal }));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("BACKEND_UNAVAILABLE");
    expect(result.errorDetails).toMatchObject({ aborted: true });
  });
});
