import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAiBackendWarmupStateForTests } from "./aiBackendWarmup";
import { requestAiDayAnalysis } from "./aiDayAnalysisClient";

function deterministicAction(overrides = {}) {
  return {
    id: "recover_block:late:occ-1",
    type: "recover_block",
    label: "Récupérer ce bloc",
    description: "Ouvre les options de récupération.",
    targetType: "occurrence",
    targetId: "occ-1",
    supportStatus: "recovery_sheet",
    deterministicAction: {
      kind: "recovery",
      occurrenceId: "occ-1",
      context: "late",
    },
    confirmationRequired: true,
    preview: { summary: "Ce bloc est en retard." },
    ...overrides,
  };
}

function snapshotFixture(overrides = {}) {
  return {
    version: 1,
    dayKey: "2026-04-19",
    nowIso: "2026-04-19T10:00:00.000Z",
    timezone: "Europe/Paris",
    activeCategoryId: null,
    primaryGoal: { id: "obj-1", title: "Publier l’app", categoryId: "work", type: "OUTCOME" },
    whyText: "Publier l’app.",
    firstRun: null,
    primaryAction: null,
    occurrences: [],
    sessionHistory: [],
    activeSession: null,
    systemSignals: [],
    deterministicActions: [deterministicAction()],
    dataLimitations: [],
    ...overrides,
  };
}

function responseFixture(overrides = {}) {
  const action = deterministicAction();
  return {
    version: 1,
    dayKey: "2026-04-19",
    diagnosis: {
      title: "Un bloc est à récupérer",
      explanation: "Le bloc prévu ce matin est encore récupérable.",
      evidence: ["Bloc prévu à 08:30"],
      confidence: 0.82,
    },
    recommendedAction: action,
    alternatives: [],
    dataLimitations: [],
    userConfirmationRequired: true,
    modelMeta: {
      requestId: "req_day",
      model: "gpt-reasoning-medium",
      modelClass: "reasoning_medium",
      promptVersion: "day_analysis_v1_0",
      decisionSource: "ai",
    },
    quota: {
      featureId: "today_ai_insight",
      planTier: "premium",
      remaining: 9,
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
    snapshotHash: "dah_test_hash",
    clientRequestId: "client_req_1",
    accessToken: "token_test",
    baseUrl: "https://api.example.test",
    ...overrides,
  };
}

describe("requestAiDayAnalysis", () => {
  afterEach(() => {
    resetAiBackendWarmupStateForTests();
    vi.unstubAllGlobals();
  });

  it("sends snapshot, snapshotHash, auth token, and client request id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(responseFixture()));

    const result = await requestAiDayAnalysis(baseArgs({ fetchImpl }));

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.test/ai/day-analysis");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer token_test");
    expect(options.headers["x-discip-surface"]).toBe("day_analysis");
    const body = JSON.parse(options.body);
    expect(body.snapshot.dayKey).toBe("2026-04-19");
    expect(body.snapshotHash).toBe("dah_test_hash");
    expect(body.clientRequestId).toBe("client_req_1");
    expect(result.result.recommendedAction.deterministicAction).toMatchObject({
      kind: "recovery",
      occurrenceId: "occ-1",
    });
    expect(result.result.quota).toMatchObject({
      featureId: "today_ai_insight",
      remaining: 9,
    });
  });

  it("rejects a successful backend body that references an unknown candidate", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        responseFixture({
          recommendedAction: {
            ...deterministicAction(),
            id: "unknown-candidate",
          },
        }),
      ),
    );

    const result = await requestAiDayAnalysis(baseArgs({ fetchImpl }));

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("INVALID_DAY_ANALYSIS_RESPONSE");
    expect(result.validationIssues.length).toBeGreaterThan(0);
  });

  it.each([
    [400, "DAY_ANALYSIS_SNAPSHOT_INVALID", "SNAPSHOT_INVALID"],
    [429, "QUOTA_EXCEEDED", "QUOTA_EXCEEDED"],
    [429, "RATE_LIMITED", "RATE_LIMITED"],
    [504, "DAY_ANALYSIS_PROVIDER_TIMEOUT", "DAY_ANALYSIS_PROVIDER_TIMEOUT"],
    [502, "INVALID_DAY_ANALYSIS_RESPONSE", "INVALID_DAY_ANALYSIS_RESPONSE"],
    [503, "DAY_ANALYSIS_BACKEND_UNAVAILABLE", "BACKEND_UNAVAILABLE"],
    [418, "UNEXPECTED", "UNKNOWN"],
  ])("maps backend error %s/%s to %s", async (status, backendCode, expectedCode) => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: backendCode,
          message: "Backend error.",
          requestId: "req_error",
        },
        status,
      ),
    );

    const result = await requestAiDayAnalysis(baseArgs({ fetchImpl }));

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(expectedCode);
    expect(result.requestId).toBe("req_error");
  });

  it("fails locally when the snapshot is missing a valid hash", async () => {
    const fetchImpl = vi.fn();

    const result = await requestAiDayAnalysis(
      baseArgs({
        fetchImpl,
        snapshotHash: "",
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("SNAPSHOT_INVALID");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns AUTH_MISSING before calling the backend", async () => {
    const fetchImpl = vi.fn();

    const result = await requestAiDayAnalysis(baseArgs({ fetchImpl, accessToken: "" }));

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("AUTH_MISSING");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
