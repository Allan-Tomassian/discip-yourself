import { loadUserSnapshot } from "../lib/supabase.js";
import { buildSchemaErrorReply, isSupabaseSchemaError } from "../lib/supabaseErrors.js";
import {
  chatRequestSchema,
  coachLocalAnalysisResponseSchema,
  coachChatResponseSchema,
  coachResponseSchema,
  localAnalysisRequestSchema,
  nowRequestSchema,
  recoveryRequestSchema,
  sessionGuidanceRequestSchema,
  sessionGuidanceResponseSchema,
} from "../schemas/coach.js";
import {
  firstRunPlanRequestSchema,
  firstRunPlanResponseSchema,
  firstRunStarterHintsRequestSchema,
  firstRunStarterHintsResponseSchema,
  firstRunWhyClarificationRequestSchema,
  firstRunWhyClarificationResponseSchema,
} from "../schemas/firstRun.js";
import {
  systemAnalysisPublicResponseSchema,
  systemAnalysisRequestSchema,
} from "../schemas/systemAnalysis.js";
import { insertAiRequestLog, hashValue } from "../services/logging.js";
import { resolveQuotaState, enforceMemoryRateLimit } from "../services/quotas.js";
import { buildNowContext } from "../services/context/nowContext.js";
import { buildChatContext } from "../services/context/chatContext.js";
import { buildRecoveryContext } from "../services/context/recoveryContext.js";
import { sanitizeUserDataForAiContext } from "../services/context/shared.js";
import { runNowCoach } from "../services/coach/nowCoach.js";
import { runChatCoach } from "../services/coach/chatCoach.js";
import { runLocalAnalysisCoach } from "../services/coach/localAnalysisCoach.js";
import { runRecoveryCoach } from "../services/coach/recoveryCoach.js";
import { runSessionGuidanceCoach } from "../services/coach/sessionGuidanceCoach.js";
import { runFirstRunPlanService } from "../services/firstRun/firstRunPlanService.js";
import { runFirstRunStarterHintsService } from "../services/firstRun/firstRunStarterHintsService.js";
import { runFirstRunWhyClarificationService } from "../services/firstRun/firstRunWhyClarificationService.js";
import {
  resolveSystemAnalysisPromptVersion,
  runSystemAnalysisService,
} from "../services/systemAnalysis/systemAnalysisService.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeLowerString(value) {
  return String(value || "").trim().toLowerCase();
}

function hasFounderEntitlementOverride(user) {
  const appMetadata = isPlainObject(user?.app_metadata) ? user.app_metadata : {};
  const entitlementOverride = normalizeLowerString(appMetadata.entitlement_override);
  if (entitlementOverride === "founder") return true;
  const role = normalizeLowerString(appMetadata.role || user?.role);
  return role === "founder" || role === "admin";
}

function resolveSessionGuidanceEntitlement({ user, entitlement }) {
  if (hasFounderEntitlementOverride(user)) {
    return {
      ...(isPlainObject(entitlement) ? entitlement : {}),
      plan_tier: "premium",
    };
  }
  return entitlement;
}

function resolveSessionGuidanceDecisionSource(user) {
  return hasFounderEntitlementOverride(user) ? "auth_override" : null;
}

function getClientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0]?.trim();
  return forwarded || request.ip || "";
}

function describeActiveSessionPayload(data) {
  const activeSession =
    isPlainObject(data?.ui) && isPlainObject(data.ui.activeSession) ? data.ui.activeSession : null;
  const activeSessionKeys = activeSession ? Object.keys(activeSession) : [];
  return {
    hasActiveSession: Boolean(activeSession),
    hasGuidedRuntimeExtras: Boolean(activeSession?.guidedRuntimeV1) || activeSession?.experienceMode === "guided",
    activeSessionKeyCount: activeSessionKeys.length,
    activeSessionExtraKeys: activeSessionKeys
      .filter((key) => key === "guidedRuntimeV1" || key === "experienceMode")
      .slice(0, 6),
  };
}

function shouldLogAiErrorDiagnostics(app) {
  const appEnv = String(app?.config?.APP_ENV || "").trim().toLowerCase();
  return appEnv === "local";
}

function describeContextShape(context) {
  const safeContext = isPlainObject(context) ? context : {};
  return {
    aiIntent: typeof safeContext.aiIntent === "string" ? safeContext.aiIntent : null,
    mode: typeof safeContext.mode === "string" ? safeContext.mode : null,
    protocolType: typeof safeContext.protocolType === "string" ? safeContext.protocolType : null,
    contextKeyCount: Object.keys(safeContext).length,
    hasMessage: typeof safeContext.message === "string" && safeContext.message.length > 0,
    hasRecentMessages: Array.isArray(safeContext.recentMessages) && safeContext.recentMessages.length > 0,
    hasCategorySnapshot: Boolean(safeContext.categorySnapshot),
    hasPlanningSummary: Boolean(safeContext.planningSummary),
    hasPilotageSummary: Boolean(safeContext.pilotageSummary),
  };
}

function describeSessionGuidanceErrorDetails(details) {
  const safeDetails = isPlainObject(details) ? details : {};
  return {
    providerStatus: typeof safeDetails.providerStatus === "string" ? safeDetails.providerStatus : null,
    rejectionStage: typeof safeDetails.rejectionStage === "string" ? safeDetails.rejectionStage : null,
    rejectionReason: typeof safeDetails.rejectionReason === "string" ? safeDetails.rejectionReason : null,
    validationPassed:
      typeof safeDetails.validationPassed === "boolean" ? safeDetails.validationPassed : null,
    richnessPassed: typeof safeDetails.richnessPassed === "boolean" ? safeDetails.richnessPassed : null,
    stepCount: Number.isFinite(safeDetails.stepCount) ? Math.round(safeDetails.stepCount) : null,
    itemCount: Number.isFinite(safeDetails.itemCount) ? Math.round(safeDetails.itemCount) : null,
    zodIssuePaths:
      Array.isArray(safeDetails.zodIssuePaths) && safeDetails.zodIssuePaths.length
        ? safeDetails.zodIssuePaths.slice(0, 12)
        : null,
  };
}

function normalizeDiagnosticNumberArray(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.round(value));
  return normalized.length ? normalized : null;
}

function buildFirstRunPlanLogMetrics({ diagnostics = null, errorDetails = null } = {}) {
  if (isPlainObject(diagnostics)) {
    return {
      providerMs: Number.isFinite(diagnostics.providerMs) ? Math.round(diagnostics.providerMs) : null,
      repairedOccurrenceCount:
        Number.isFinite(diagnostics.repairedOccurrenceCount) ? Math.round(diagnostics.repairedOccurrenceCount) : null,
      repairedMinutesDelta:
        Number.isFinite(diagnostics.repairedMinutesDelta) ? Math.round(diagnostics.repairedMinutesDelta) : null,
      activeDays: normalizeDiagnosticNumberArray(diagnostics.activeDays),
      lightDays: normalizeDiagnosticNumberArray(diagnostics.lightDays),
      denseDays: normalizeDiagnosticNumberArray(diagnostics.denseDays),
    };
  }

  const safeDetails = isPlainObject(errorDetails) ? errorDetails : {};
  const tenableDiagnostics = isPlainObject(safeDetails.tenableDiagnostics) ? safeDetails.tenableDiagnostics : null;
  const ambitiousDiagnostics = isPlainObject(safeDetails.ambitiousDiagnostics) ? safeDetails.ambitiousDiagnostics : null;
  const readPlanArray = (key) => {
    if (Number.isFinite(safeDetails[key])) return [Math.round(safeDetails[key])];
    const values = [tenableDiagnostics?.[key], ambitiousDiagnostics?.[key]]
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.round(value));
    return values.length ? values : null;
  };

  return {
    providerMs: Number.isFinite(safeDetails.providerMs) ? Math.round(safeDetails.providerMs) : null,
    repairedOccurrenceCount:
      Number.isFinite(safeDetails.repairedOccurrenceCount) ? Math.round(safeDetails.repairedOccurrenceCount) : null,
    repairedMinutesDelta:
      Number.isFinite(safeDetails.repairedMinutesDelta) ? Math.round(safeDetails.repairedMinutesDelta) : null,
    activeDays: readPlanArray("activeDays"),
    lightDays: readPlanArray("lightDays"),
    denseDays: readPlanArray("denseDays"),
  };
}

function normalizeDateKey(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function diffDateKeysInDays(fromKey, toKey) {
  const from = normalizeDateKey(fromKey);
  const to = normalizeDateKey(toKey);
  if (!from || !to) return null;
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
  return Math.max(0, Math.round((toTime - fromTime) / 86400000));
}

function resolveSystemAnalysisActivationDateKey(snapshot, serverState) {
  const fromSnapshot = normalizeDateKey(snapshot?.firstRunSummary?.appliedAt);
  if (fromSnapshot) return fromSnapshot;
  const fromServerCommit = normalizeDateKey(serverState?.ui?.firstRunV1?.commitV1?.appliedAt);
  if (fromServerCommit) return fromServerCommit;
  const occurrenceDates = Array.isArray(serverState?.occurrences)
    ? serverState.occurrences.map((occurrence) => normalizeDateKey(occurrence?.date || occurrence?.dateKey)).filter(Boolean)
    : [];
  const historyDates = Array.isArray(serverState?.sessionHistory)
    ? serverState.sessionHistory
        .map((history) => normalizeDateKey(history?.dateKey || history?.date || history?.endAt || history?.startAt))
        .filter(Boolean)
    : [];
  return [...occurrenceDates, ...historyDates].sort()[0] || "";
}

function buildSystemAnalysisThinDataCheck(snapshot, serverState) {
  const activationDateKey = resolveSystemAnalysisActivationDateKey(snapshot, serverState);
  const referenceDateKey = normalizeDateKey(snapshot?.referenceDateKey || snapshot?.period?.endDateKey);
  const daysSinceActivation = diffDateKeysInDays(activationDateKey, referenceDateKey);
  const plannedBlocks = Number(snapshot?.executionStats?.expectedCount || 0);
  const executionOutcomes = Number(snapshot?.executionStats?.outcomeCount || 0);
  const activeDays = Number(snapshot?.executionStats?.activeDayCount || 0);
  const completionOrFrictionSignals =
    Number(snapshot?.executionStats?.completedCount || 0) +
    Number(snapshot?.executionStats?.frictionCount || 0) +
    Number(snapshot?.sessionStats?.frictionCount || 0);
  const missingRequirements = [];
  const addMissing = (code, current, target) => {
    missingRequirements.push({
      code,
      current: Number.isFinite(current) ? current : 0,
      target,
      remaining: Math.max(0, target - (Number.isFinite(current) ? current : 0)),
    });
  };
  if (!activationDateKey) addMissing("activation_date_missing", 0, 1);
  if (!Number.isFinite(daysSinceActivation) || daysSinceActivation < 7) {
    addMissing("activation_too_recent", daysSinceActivation || 0, 7);
  }
  if (plannedBlocks < 10) addMissing("not_enough_planned_blocks", plannedBlocks, 10);
  if (executionOutcomes < 5) addMissing("not_enough_execution_outcomes", executionOutcomes, 5);
  if (activeDays < 3) addMissing("not_enough_active_days", activeDays, 3);
  if (completionOrFrictionSignals < 1) {
    addMissing("not_enough_completion_or_friction", completionOrFrictionSignals, 1);
  }
  return {
    eligible: missingRequirements.length === 0,
    missingRequirements,
    activationDateKey: activationDateKey || null,
    daysSinceActivation: Number.isFinite(daysSinceActivation) ? daysSinceActivation : 0,
  };
}

function buildSystemAnalysisRequestHash({ snapshot, promptVersion }) {
  return hashValue(
    JSON.stringify({
      route: "system-analysis",
      snapshotHash: snapshot?.snapshotHash || "",
      period: snapshot?.period || null,
      promptVersion,
    })
  );
}

function logAiStageError({
  app,
  request,
  route,
  stage,
  status,
  errorCode,
  requestedAiIntent = null,
  err = null,
  activeSessionDiagnostics = null,
  context = null,
}) {
  if (!shouldLogAiErrorDiagnostics(app)) return;
  request.log.error(
    {
      err: err || undefined,
      requestId: request.requestId,
      route,
      stage,
      status,
      errorCode,
      requestedAiIntent: typeof requestedAiIntent === "string" ? requestedAiIntent : null,
      surface: String(request.headers["x-discip-surface"] || "").trim() || null,
      ...(activeSessionDiagnostics || {}),
      ...describeContextShape(context),
      ...describeSessionGuidanceErrorDetails(err?.details || null),
    },
    "ai route failed"
  );
}

function sendAiStageError(reply, requestId, { status = 503, errorCode, message, details = null }) {
  return reply.code(status).send({
    error: errorCode,
    message,
    requestId,
    ...(isPlainObject(details) ? { details } : {}),
  });
}

export async function aiRoutes(app) {
  app.post("/now", { preHandler: [app.authenticate] }, async (request, reply) => {
    return handleCoachRoute({
      app,
      request,
      reply,
      coachKind: "now",
      bodySchema: nowRequestSchema,
      responseSchema: coachResponseSchema,
      contextBuilder: buildNowContext,
      runner: runNowCoach,
    });
  });

  app.post("/recovery", { preHandler: [app.authenticate] }, async (request, reply) => {
    return handleCoachRoute({
      app,
      request,
      reply,
      coachKind: "recovery",
      bodySchema: recoveryRequestSchema,
      responseSchema: coachResponseSchema,
      contextBuilder: buildRecoveryContext,
      runner: runRecoveryCoach,
    });
  });

  app.post("/chat", { preHandler: [app.authenticate] }, async (request, reply) => {
    return handleCoachRoute({
      app,
      request,
      reply,
      coachKind: "chat",
      bodySchema: chatRequestSchema,
      responseSchema: coachChatResponseSchema,
      contextBuilder: buildChatContext,
      runner: runChatCoach,
    });
  });

  app.post("/local-analysis", { preHandler: [app.authenticate] }, async (request, reply) => {
    return handleCoachRoute({
      app,
      request,
      reply,
      coachKind: "local-analysis",
      bodySchema: localAnalysisRequestSchema,
      responseSchema: coachLocalAnalysisResponseSchema,
      contextBuilder: ({ body, ...rest }) =>
        buildChatContext({
          ...rest,
          body: {
            ...body,
            mode: "card",
          },
        }),
      runner: runLocalAnalysisCoach,
    });
  });

  app.post("/session-guidance", { preHandler: [app.authenticate] }, async (request, reply) => {
    return handleSessionGuidanceRoute({ app, request, reply });
  });

  app.post(
    "/system-analysis",
    { preHandler: [app.authenticate], bodyLimit: 64 * 1024 },
    async (request, reply) => {
      return handleSystemAnalysisRoute({ app, request, reply });
    }
  );

  app.post("/first-run-plan", { preHandler: [app.authenticate] }, async (request, reply) => {
    return handleFirstRunPlanRoute({ app, request, reply });
  });

  app.post("/first-run-starter-hints", { preHandler: [app.authenticate] }, async (request, reply) => {
    return handleFirstRunStarterHintsRoute({ app, request, reply });
  });

  app.post("/first-run-why-clarification", { preHandler: [app.authenticate] }, async (request, reply) => {
    return handleFirstRunWhyClarificationRoute({ app, request, reply });
  });
}

async function handleCoachRoute({
  app,
  request,
  reply,
  coachKind,
  bodySchema,
  responseSchema,
  contextBuilder,
  runner,
}) {
  const startedAt = Date.now();
  const route = `/ai/${coachKind}`;
  const parsedBody = bodySchema.safeParse(request.body);
  if (!parsedBody.success) {
    return reply.code(400).send({
      error: "INVALID_BODY",
      message: "Request body is invalid.",
      issues: parsedBody.error.issues,
      requestId: request.requestId,
    });
  }

  const rateLimited =
    enforceMemoryRateLimit({
      key: `user:${request.user.id}`,
      limit: 5,
      windowMs: 60 * 1000,
    }) ||
    enforceMemoryRateLimit({
      key: `ip:${getClientIp(request)}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
  if (rateLimited) {
    return reply.code(429).send({
      error: "RATE_LIMITED",
      message: "Rate limit exceeded.",
      requestId: request.requestId,
    });
  }

  let snapshot;
  try {
    snapshot = await loadUserSnapshot(app.supabase, request.user.id);
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "snapshot_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "SNAPSHOT_LOAD_FAILED",
      err: error,
      requestedAiIntent: parsedBody.data?.aiIntent || null,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "SNAPSHOT_LOAD_FAILED",
      message: "Unable to load user context.",
    });
  }

  const requestHash = hashValue(JSON.stringify({ route: coachKind, body: parsedBody.data }));
  let quotaState;
  const sessionGuidanceEntitlement = resolveSessionGuidanceEntitlement({
    user: request.user,
    entitlement: snapshot.entitlement,
  });
  const sessionGuidanceDecisionSource = resolveSessionGuidanceDecisionSource(request.user);
  try {
    quotaState = await resolveQuotaState(app.supabase, {
      userId: request.user.id,
      entitlement: sessionGuidanceEntitlement,
      quotaMode: app.config.AI_QUOTA_MODE,
    });
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "quota_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "QUOTA_LOAD_FAILED",
      err: error,
      activeSessionDiagnostics: describeActiveSessionPayload(snapshot?.userData),
      requestedAiIntent: parsedBody.data?.aiIntent || null,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "QUOTA_LOAD_FAILED",
      message: "Unable to resolve AI quota.",
    });
  }
  if (quotaState.exceeded) {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind,
      route: `/ai/${coachKind}`,
      planTier: quotaState.planTier,
      decisionSource: "rules",
      statusCode: 429,
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "quota",
    });
    return reply.code(429).send({
      error: "QUOTA_EXCEEDED",
      message: "AI quota exceeded.",
      requestId: request.requestId,
      quotaRemaining: quotaState.remaining,
    });
  }

  const contextData = sanitizeUserDataForAiContext(snapshot.userData);
  const activeSessionDiagnostics = describeActiveSessionPayload(snapshot.userData);
  try {
    const context = contextBuilder({
      data: contextData,
      selectedDateKey: parsedBody.data.selectedDateKey,
      activeCategoryId: parsedBody.data.activeCategoryId,
      quotaState,
      requestId: request.requestId,
      trigger: parsedBody.data.trigger,
      body: parsedBody.data,
    });

    let runnerResult;
    try {
      runnerResult = await runner({ app, context, snapshot, quotaState });
    } catch (error) {
      logAiStageError({
        app,
        request,
        route,
        stage: "runner",
        status: 503,
        errorCode: "PROVIDER_FAILED",
        err: error,
        activeSessionDiagnostics,
        requestedAiIntent: parsedBody.data?.aiIntent || null,
        context,
      });
      return sendAiStageError(reply, request.requestId, {
        status: 503,
        errorCode: "PROVIDER_FAILED",
        message: "Unable to resolve AI response.",
      });
    }

    let response;
    try {
      response = responseSchema.parse(runnerResult);
    } catch (error) {
      logAiStageError({
        app,
        request,
        route,
        stage: "response_parse",
        status: 503,
        errorCode: "INVALID_RESPONSE",
        err: error,
        activeSessionDiagnostics,
        requestedAiIntent: parsedBody.data?.aiIntent || null,
        context,
      });
      return sendAiStageError(reply, request.requestId, {
        status: 503,
        errorCode: "INVALID_RESPONSE",
        message: "Unable to validate AI response.",
      });
    }

    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind,
      route,
      planTier: quotaState.planTier,
      decisionSource: response.decisionSource,
      statusCode: 200,
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
    });
    return reply.code(200).send(response);
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "context_build",
      status: 503,
      errorCode: "CONTEXT_BUILD_FAILED",
      err: error,
      activeSessionDiagnostics,
      requestedAiIntent: parsedBody.data?.aiIntent || null,
    });
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "CONTEXT_BUILD_FAILED",
      message: "Unable to build AI context.",
    });
  }
}

async function handleSystemAnalysisRoute({ app, request, reply }) {
  const startedAt = Date.now();
  const route = "/ai/system-analysis";
  const parsedBody = systemAnalysisRequestSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return reply.code(400).send({
      error: "INVALID_SYSTEM_ANALYSIS_SNAPSHOT",
      message: "System analysis request body is invalid.",
      issues: parsedBody.error.issues,
      requestId: request.requestId,
    });
  }

  const body = parsedBody.data;
  const promptVersion = resolveSystemAnalysisPromptVersion(app);
  const requestHash = buildSystemAnalysisRequestHash({
    snapshot: body.snapshot,
    promptVersion,
  });

  const rateLimited =
    enforceMemoryRateLimit({
      key: `system-analysis:user:${request.user.id}`,
      limit: 2,
      windowMs: 60 * 1000,
    }) ||
    enforceMemoryRateLimit({
      key: `system-analysis:ip:${getClientIp(request)}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
  if (rateLimited) {
    return reply.code(429).send({
      error: "RATE_LIMITED",
      message: "Rate limit exceeded.",
      requestId: request.requestId,
    });
  }

  let snapshot;
  try {
    snapshot = await loadUserSnapshot(app.supabase, request.user.id);
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "snapshot_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "SNAPSHOT_LOAD_FAILED",
      err: error,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "SNAPSHOT_LOAD_FAILED",
      message: "Unable to load user context.",
    });
  }

  let quotaState;
  try {
    quotaState = await resolveQuotaState(app.supabase, {
      userId: request.user.id,
      entitlement: snapshot.entitlement,
      quotaMode: app.config.AI_QUOTA_MODE,
    });
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "quota_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "QUOTA_LOAD_FAILED",
      err: error,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "QUOTA_LOAD_FAILED",
      message: "Unable to verify AI quota.",
    });
  }

  if (quotaState.planTier !== "premium") {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "system-analysis",
      route,
      planTier: quotaState.planTier,
      decisionSource: "rules",
      statusCode: 403,
      mode: "system_analysis",
      protocolType: promptVersion,
      providerStatus: "blocked",
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "PREMIUM_REQUIRED",
    });
    return reply.code(403).send({
      error: "PREMIUM_REQUIRED",
      message: "Premium analysis is required for this feature.",
      requestId: request.requestId,
    });
  }

  if (quotaState.exceeded) {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "system-analysis",
      route,
      planTier: quotaState.planTier,
      decisionSource: "rules",
      statusCode: 429,
      mode: "system_analysis",
      protocolType: promptVersion,
      providerStatus: "blocked",
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "QUOTA_EXCEEDED",
    });
    return reply.code(429).send({
      error: "QUOTA_EXCEEDED",
      message: "AI quota exceeded.",
      requestId: request.requestId,
      quotaRemaining: quotaState.remaining,
    });
  }

  const thinDataCheck = buildSystemAnalysisThinDataCheck(body.snapshot, snapshot.userData);
  const allowThinDataForTest = app?.config?.APP_ENV === "test" && body.allowThinDataForTest === true;
  if (!thinDataCheck.eligible && !allowThinDataForTest) {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "system-analysis",
      route,
      planTier: quotaState.planTier,
      decisionSource: "rules",
      statusCode: 422,
      mode: "system_analysis",
      protocolType: promptVersion,
      providerStatus: "blocked",
      validationPassed: false,
      zodIssuePaths: thinDataCheck.missingRequirements.map((requirement) => requirement.code),
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "SYSTEM_ANALYSIS_INELIGIBLE",
    });
    return reply.code(422).send({
      error: "SYSTEM_ANALYSIS_INELIGIBLE",
      message: "System analysis needs more real usage data.",
      requestId: request.requestId,
      missingRequirements: thinDataCheck.missingRequirements,
    });
  }

  let serviceResult;
  try {
    serviceResult = await runSystemAnalysisService({
      app,
      context: {
        ...body,
        requestId: request.requestId,
        promptVersion,
        quotaRemaining: quotaState.remaining,
        state: snapshot.userData,
      },
    });
  } catch (error) {
    const rawErrorCode = String(error?.code || "").trim().toUpperCase() || "UNKNOWN_BACKEND_ERROR";
    const errorDetails = isPlainObject(error?.details) ? error.details : null;
    const status =
      rawErrorCode === "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT" ? 504
      : rawErrorCode === "INVALID_SYSTEM_ANALYSIS_RESPONSE" ? 502
      : 503;
    const responseErrorCode =
      rawErrorCode === "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT" ? "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT"
      : rawErrorCode === "INVALID_SYSTEM_ANALYSIS_RESPONSE" ? "INVALID_SYSTEM_ANALYSIS_RESPONSE"
      : "SYSTEM_ANALYSIS_BACKEND_UNAVAILABLE";
    logAiStageError({
      app,
      request,
      route,
      stage: "provider",
      status,
      errorCode: responseErrorCode,
      err: error,
      context: {
        aiIntent: "system_analysis",
        mode: "system_analysis",
        requestId: request.requestId,
      },
    });
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "system-analysis",
      route,
      planTier: quotaState.planTier,
      decisionSource: "ai",
      statusCode: status,
      mode: "system_analysis",
      protocolType: promptVersion,
      providerStatus:
        errorDetails?.providerStatus ||
        (responseErrorCode === "INVALID_SYSTEM_ANALYSIS_RESPONSE" ? "invalid_response" : "error"),
      providerMs: Number.isFinite(errorDetails?.providerMs) ? Math.round(errorDetails.providerMs) : null,
      rejectionStage: errorDetails?.rejectionStage || null,
      rejectionReason: errorDetails?.rejectionReason || null,
      validationPassed:
        typeof errorDetails?.validationPassed === "boolean" ? errorDetails.validationPassed : false,
      zodIssuePaths:
        Array.isArray(errorDetails?.zodIssuePaths) && errorDetails.zodIssuePaths.length
          ? errorDetails.zodIssuePaths
          : Array.isArray(errorDetails?.governanceIssues)
            ? errorDetails.governanceIssues.map((issue) => issue.path || issue.code).filter(Boolean).slice(0, 24)
            : null,
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Number.isFinite(errorDetails?.totalMs) ? Math.round(errorDetails.totalMs) : Date.now() - startedAt,
      errorCode: responseErrorCode,
    });
    return reply.code(status).send({
      error: responseErrorCode,
      message:
        responseErrorCode === "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT"
          ? "System analysis provider timed out."
          : responseErrorCode === "INVALID_SYSTEM_ANALYSIS_RESPONSE"
            ? "System analysis response is invalid."
            : "System analysis backend unavailable.",
      requestId: request.requestId,
      ...(errorDetails ? { details: errorDetails } : {}),
    });
  }

  const parsedResponse = systemAnalysisPublicResponseSchema.safeParse(serviceResult.response);
  if (!parsedResponse.success) {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "system-analysis",
      route,
      planTier: quotaState.planTier,
      decisionSource: "ai",
      statusCode: 502,
      mode: "system_analysis",
      protocolType: promptVersion,
      providerStatus: "invalid_response",
      rejectionStage: "response_schema",
      rejectionReason: "provider_parse_failed",
      validationPassed: false,
      zodIssuePaths: parsedResponse.error.issues.map((issue) => issue.path.join(".")).filter(Boolean).slice(0, 24),
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "INVALID_SYSTEM_ANALYSIS_RESPONSE",
    });
    return reply.code(502).send({
      error: "INVALID_SYSTEM_ANALYSIS_RESPONSE",
      message: "System analysis response is invalid.",
      requestId: request.requestId,
    });
  }

  request.log.info(
    {
      requestId: request.requestId,
      route,
      snapshotHash: body.snapshot.snapshotHash,
      period: body.snapshot.period,
      promptVersion,
      model: serviceResult.diagnostics?.model || null,
      status: "ok",
      providerMs: serviceResult.diagnostics?.providerMs || null,
    },
    "system analysis completed"
  );
  await insertAiRequestLog(app.supabase, {
    requestId: request.requestId,
    userId: request.user.id,
    coachKind: "system-analysis",
    route,
    planTier: quotaState.planTier,
    decisionSource: "ai",
    statusCode: 200,
    mode: "system_analysis",
    protocolType: promptVersion,
    providerStatus: "ok",
    providerMs: Number.isFinite(serviceResult.diagnostics?.providerMs)
      ? Math.round(serviceResult.diagnostics.providerMs)
      : null,
    rejectionStage: null,
    rejectionReason: null,
    validationPassed: true,
    richnessPassed: true,
    stepCount: parsedResponse.data.recommendedCorrections.length,
    itemCount:
      parsedResponse.data.invisibleFriction.length +
      parsedResponse.data.systemWeaknesses.length +
      parsedResponse.data.strongestPatterns.length +
      parsedResponse.data.recommendedCorrections.length,
    requestHash,
    ipHash: hashValue(getClientIp(request)),
    userAgent: request.headers["user-agent"] || "",
    latencyMs: Number.isFinite(serviceResult.diagnostics?.totalMs)
      ? Math.round(serviceResult.diagnostics.totalMs)
      : Date.now() - startedAt,
  });
  return reply.code(200).send(parsedResponse.data);
}

async function handleSessionGuidanceRoute({ app, request, reply }) {
  const startedAt = Date.now();
  const route = "/ai/session-guidance";
  const parsedBody = sessionGuidanceRequestSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return reply.code(400).send({
      error: "INVALID_BODY",
      message: "Request body is invalid.",
      issues: parsedBody.error.issues,
      requestId: request.requestId,
    });
  }

  const rateLimited =
    enforceMemoryRateLimit({
      key: `user:${request.user.id}`,
      limit: 5,
      windowMs: 60 * 1000,
    }) ||
    enforceMemoryRateLimit({
      key: `ip:${getClientIp(request)}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
  if (rateLimited) {
    return reply.code(429).send({
      error: "RATE_LIMITED",
      message: "Rate limit exceeded.",
      requestId: request.requestId,
    });
  }

  const requestHash = hashValue(JSON.stringify({ route: "session-guidance", body: parsedBody.data }));
  let snapshot;
  try {
    snapshot = await loadUserSnapshot(app.supabase, request.user.id);
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "snapshot_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "SNAPSHOT_LOAD_FAILED",
      err: error,
      requestedAiIntent: parsedBody.data?.aiIntent || null,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "SNAPSHOT_LOAD_FAILED",
      message: "Unable to load user context.",
    });
  }

  let quotaState;
  const sessionGuidanceEntitlement = resolveSessionGuidanceEntitlement({
    user: request.user,
    entitlement: snapshot.entitlement,
  });
  const sessionGuidanceDecisionSource = resolveSessionGuidanceDecisionSource(request.user);
  try {
    quotaState = await resolveQuotaState(app.supabase, {
      userId: request.user.id,
      entitlement: sessionGuidanceEntitlement,
      quotaMode: app.config.AI_QUOTA_MODE,
    });
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "quota_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "QUOTA_LOAD_FAILED",
      err: error,
      requestedAiIntent: parsedBody.data?.aiIntent || null,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "QUOTA_LOAD_FAILED",
      message: "Unable to verify AI quota.",
    });
  }

  if (quotaState.planTier !== "premium") {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "session-guidance",
      route,
      planTier: quotaState.planTier,
      decisionSource: sessionGuidanceDecisionSource,
      statusCode: 403,
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "PREMIUM_REQUIRED",
    });
    return reply.code(403).send({
      error: "PREMIUM_REQUIRED",
      message: "Premium guidance is required for this feature.",
      requestId: request.requestId,
    });
  }

  if (quotaState.exceeded) {
    return reply.code(429).send({
      error: "QUOTA_EXCEEDED",
      message: "AI quota exceeded.",
      requestId: request.requestId,
      quotaRemaining: quotaState.remaining,
    });
  }

  const context = {
    ...parsedBody.data,
    requestId: request.requestId,
    quotaRemaining: quotaState.remaining,
  };

  let response;
  try {
    response = await runSessionGuidanceCoach({ app, context });
  } catch (error) {
    const errorCode = String(error?.code || "").trim().toUpperCase() || "UNKNOWN_BACKEND_ERROR";
    const errorDetails = isPlainObject(error?.details) ? error.details : null;
    const status =
      errorCode === "SESSION_GUIDANCE_BACKEND_UNAVAILABLE" ? 503
      : errorCode === "SESSION_GUIDANCE_PROVIDER_TIMEOUT" ? 504
      : errorCode === "INVALID_SESSION_GUIDANCE_RESPONSE" ? 502
      : 503;
    logAiStageError({
      app,
      request,
      route,
      stage: "provider",
      status,
      errorCode,
      err: error,
      requestedAiIntent: parsedBody.data?.aiIntent || null,
      context,
    });
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "session-guidance",
      route,
      planTier: quotaState.planTier,
      decisionSource: sessionGuidanceDecisionSource || "ai",
      statusCode: status,
      mode: parsedBody.data.mode,
      protocolType: parsedBody.data.protocolType,
      providerStatus: errorDetails?.providerStatus || (errorCode === "INVALID_SESSION_GUIDANCE_RESPONSE" ? "invalid_response" : "error"),
      rejectionStage: errorDetails?.rejectionStage || null,
      rejectionReason: errorDetails?.rejectionReason || null,
      validationPassed:
        typeof errorDetails?.validationPassed === "boolean" ? errorDetails.validationPassed : null,
      richnessPassed: typeof errorDetails?.richnessPassed === "boolean" ? errorDetails.richnessPassed : null,
      stepCount: Number.isFinite(errorDetails?.stepCount) ? errorDetails.stepCount : null,
      itemCount: Number.isFinite(errorDetails?.itemCount) ? errorDetails.itemCount : null,
      zodIssuePaths: Array.isArray(errorDetails?.zodIssuePaths) ? errorDetails.zodIssuePaths : null,
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode,
    });
    return reply.code(status).send({
      error: errorCode,
      message:
        errorCode === "SESSION_GUIDANCE_BACKEND_UNAVAILABLE"
          ? "Session guidance backend unavailable."
          : errorCode === "SESSION_GUIDANCE_PROVIDER_TIMEOUT"
            ? "Session guidance provider timed out."
          : "Unable to prepare premium session guidance.",
      requestId: request.requestId,
      ...(errorDetails ? { details: errorDetails } : {}),
    });
  }

  const parsedResponse = sessionGuidanceResponseSchema.safeParse(response);
  if (!parsedResponse.success) {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "session-guidance",
      route,
      planTier: quotaState.planTier,
      decisionSource: sessionGuidanceDecisionSource || "ai",
      statusCode: 502,
      mode: parsedBody.data.mode,
      protocolType: parsedBody.data.protocolType,
      providerStatus: "invalid_response",
      rejectionStage: "response_schema",
      rejectionReason: "provider_parse_failed",
      validationPassed: false,
      richnessPassed: false,
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "INVALID_SESSION_GUIDANCE_RESPONSE",
    });
    return reply.code(502).send({
      error: "INVALID_SESSION_GUIDANCE_RESPONSE",
      message: "Session guidance response is invalid.",
      requestId: request.requestId,
    });
  }

  const prepareQuality =
    parsedResponse.data.mode === "prepare" && isPlainObject(parsedResponse.data.payload?.quality)
      ? parsedResponse.data.payload.quality
      : null;
  await insertAiRequestLog(app.supabase, {
    requestId: request.requestId,
    userId: request.user.id,
    coachKind: "session-guidance",
    route,
    planTier: quotaState.planTier,
    decisionSource: sessionGuidanceDecisionSource || "ai",
    statusCode: 200,
    mode: parsedBody.data.mode,
    protocolType: parsedBody.data.protocolType,
    providerStatus: "ok",
    rejectionStage: prepareQuality?.rejectionStage || null,
    rejectionReason: prepareQuality?.rejectionReason || null,
    validationPassed:
      typeof prepareQuality?.validationPassed === "boolean" ? prepareQuality.validationPassed : null,
    richnessPassed:
      typeof prepareQuality?.richnessPassed === "boolean" ? prepareQuality.richnessPassed : null,
    stepCount: Number.isFinite(prepareQuality?.stepCount) ? prepareQuality.stepCount : null,
    itemCount: Number.isFinite(prepareQuality?.itemCount) ? prepareQuality.itemCount : null,
    zodIssuePaths: Array.isArray(prepareQuality?.issuePaths) ? prepareQuality.issuePaths : null,
    requestHash,
    ipHash: hashValue(getClientIp(request)),
    userAgent: request.headers["user-agent"] || "",
    latencyMs: Date.now() - startedAt,
  });
  return reply.code(200).send(parsedResponse.data);
}

async function handleFirstRunWhyClarificationRoute({ app, request, reply }) {
  const startedAt = Date.now();
  const route = "/ai/first-run-why-clarification";
  const parsedBody = firstRunWhyClarificationRequestSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return reply.code(400).send({
      error: "INVALID_BODY",
      message: "Request body is invalid.",
      issues: parsedBody.error.issues,
      requestId: request.requestId,
    });
  }

  const rateLimited =
    enforceMemoryRateLimit({
      key: `why-clarification:user:${request.user.id}`,
      limit: 10,
      windowMs: 60 * 1000,
    }) ||
    enforceMemoryRateLimit({
      key: `why-clarification:ip:${getClientIp(request)}`,
      limit: 40,
      windowMs: 15 * 60 * 1000,
    });
  if (rateLimited) {
    return reply.code(429).send({
      error: "RATE_LIMITED",
      message: "Rate limit exceeded.",
      requestId: request.requestId,
    });
  }

  const requestHash = hashValue(JSON.stringify({ route: "first-run-why-clarification", body: parsedBody.data }));
  let snapshot;
  try {
    snapshot = await loadUserSnapshot(app.supabase, request.user.id);
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "snapshot_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "SNAPSHOT_LOAD_FAILED",
      err: error,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "SNAPSHOT_LOAD_FAILED",
      message: "Unable to load user context.",
    });
  }

  let quotaState;
  try {
    quotaState = await resolveQuotaState(app.supabase, {
      userId: request.user.id,
      entitlement: snapshot.entitlement,
      quotaMode: app.config.AI_QUOTA_MODE,
    });
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "quota_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "QUOTA_LOAD_FAILED",
      err: error,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "QUOTA_LOAD_FAILED",
      message: "Unable to verify AI quota.",
    });
  }

  if (quotaState.exceeded) {
    return reply.code(429).send({
      error: "QUOTA_EXCEEDED",
      message: "AI quota exceeded.",
      requestId: request.requestId,
      quotaRemaining: quotaState.remaining,
    });
  }

  const context = {
    ...parsedBody.data,
    requestId: request.requestId,
    quotaRemaining: quotaState.remaining,
  };

  let response;
  let serviceDiagnostics = null;
  try {
    const serviceResult = await runFirstRunWhyClarificationService({ app, context });
    response = serviceResult.response;
    serviceDiagnostics = serviceResult.diagnostics;
  } catch (error) {
    const errorCode = String(error?.code || "").trim().toUpperCase() || "UNKNOWN_BACKEND_ERROR";
    const errorDetails = isPlainObject(error?.details) ? error.details : null;
    const status =
      errorCode === "FIRST_RUN_WHY_CLARIFICATION_BACKEND_UNAVAILABLE" ? 503
      : errorCode === "FIRST_RUN_WHY_CLARIFICATION_PROVIDER_TIMEOUT" ? 504
      : errorCode === "INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE" ? 502
      : 503;
    logAiStageError({
      app,
      request,
      route,
      stage: "provider",
      status,
      errorCode,
      err: error,
      context,
    });
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "first-run-why-clarification",
      route,
      planTier: quotaState.planTier,
      decisionSource: "ai",
      statusCode: status,
      mode: "why_clarification",
      providerStatus:
        errorDetails?.providerStatus ||
        (errorCode === "INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE" ? "invalid_response" : "error"),
      providerMs: Number.isFinite(errorDetails?.providerMs) ? Math.round(errorDetails.providerMs) : null,
      rejectionStage: errorDetails?.rejectionStage || null,
      rejectionReason: errorDetails?.rejectionReason || null,
      validationPassed:
        typeof errorDetails?.validationPassed === "boolean" ? errorDetails.validationPassed : null,
      richnessPassed: typeof errorDetails?.richnessPassed === "boolean" ? errorDetails.richnessPassed : null,
      zodIssuePaths: Array.isArray(errorDetails?.zodIssuePaths) ? errorDetails.zodIssuePaths : null,
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Number.isFinite(errorDetails?.totalMs) ? Math.round(errorDetails.totalMs) : Date.now() - startedAt,
      errorCode,
    });
    return reply.code(status).send({
      error: errorCode,
      message:
        errorCode === "FIRST_RUN_WHY_CLARIFICATION_BACKEND_UNAVAILABLE"
          ? "First run why clarification backend unavailable."
          : errorCode === "FIRST_RUN_WHY_CLARIFICATION_PROVIDER_TIMEOUT"
            ? "First run why clarification provider timed out."
            : "Unable to clarify first run why.",
      requestId: request.requestId,
      ...(errorDetails ? { details: errorDetails } : {}),
    });
  }

  const parsedResponse = firstRunWhyClarificationResponseSchema.safeParse(response);
  if (!parsedResponse.success) {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "first-run-why-clarification",
      route,
      planTier: quotaState.planTier,
      decisionSource: "ai",
      statusCode: 502,
      mode: "why_clarification",
      providerStatus: "invalid_response",
      rejectionStage: "response_schema",
      rejectionReason: "provider_parse_failed",
      validationPassed: false,
      richnessPassed: false,
      zodIssuePaths: parsedResponse.error.issues.map((issue) => issue.path.join(".")).filter(Boolean).slice(0, 16),
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE",
    });
    return reply.code(502).send({
      error: "INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE",
      message: "First run why clarification response is invalid.",
      requestId: request.requestId,
    });
  }

  await insertAiRequestLog(app.supabase, {
    requestId: request.requestId,
    userId: request.user.id,
    coachKind: "first-run-why-clarification",
    route,
    planTier: quotaState.planTier,
    decisionSource: "ai",
    statusCode: 200,
    mode: "why_clarification",
    providerStatus: "ok",
    providerMs: Number.isFinite(serviceDiagnostics?.providerMs) ? Math.round(serviceDiagnostics.providerMs) : null,
    rejectionStage: null,
    rejectionReason: null,
    validationPassed: true,
    richnessPassed: true,
    stepCount: parsedResponse.data.drafts.length,
    itemCount: parsedResponse.data.inspirationAxes.length + parsedResponse.data.drafts.length,
    requestHash,
    ipHash: hashValue(getClientIp(request)),
    userAgent: request.headers["user-agent"] || "",
    latencyMs: Number.isFinite(serviceDiagnostics?.totalMs) ? Math.round(serviceDiagnostics.totalMs) : Date.now() - startedAt,
  });
  return reply.code(200).send(parsedResponse.data);
}

async function handleFirstRunPlanRoute({ app, request, reply }) {
  const startedAt = Date.now();
  const route = "/ai/first-run-plan";
  const parsedBody = firstRunPlanRequestSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return reply.code(400).send({
      error: "INVALID_BODY",
      message: "Request body is invalid.",
      issues: parsedBody.error.issues,
      requestId: request.requestId,
    });
  }

  const rateLimited =
    enforceMemoryRateLimit({
      key: `user:${request.user.id}`,
      limit: 5,
      windowMs: 60 * 1000,
    }) ||
    enforceMemoryRateLimit({
      key: `ip:${getClientIp(request)}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
  if (rateLimited) {
    return reply.code(429).send({
      error: "RATE_LIMITED",
      message: "Rate limit exceeded.",
      requestId: request.requestId,
    });
  }

  const requestHash = hashValue(JSON.stringify({ route: "first-run-plan", body: parsedBody.data }));
  let snapshot;
  try {
    snapshot = await loadUserSnapshot(app.supabase, request.user.id);
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "snapshot_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "SNAPSHOT_LOAD_FAILED",
      err: error,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "SNAPSHOT_LOAD_FAILED",
      message: "Unable to load user context.",
    });
  }

  let quotaState;
  try {
    quotaState = await resolveQuotaState(app.supabase, {
      userId: request.user.id,
      entitlement: snapshot.entitlement,
      quotaMode: app.config.AI_QUOTA_MODE,
    });
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "quota_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "QUOTA_LOAD_FAILED",
      err: error,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "QUOTA_LOAD_FAILED",
      message: "Unable to verify AI quota.",
    });
  }

  if (quotaState.exceeded) {
    return reply.code(429).send({
      error: "QUOTA_EXCEEDED",
      message: "AI quota exceeded.",
      requestId: request.requestId,
      quotaRemaining: quotaState.remaining,
    });
  }

  const context = {
    ...parsedBody.data,
    requestId: request.requestId,
    quotaRemaining: quotaState.remaining,
  };

  let response;
  let serviceDiagnostics = null;
  try {
    const serviceResult = await runFirstRunPlanService({ app, context });
    response = serviceResult.response;
    serviceDiagnostics = serviceResult.diagnostics;
  } catch (error) {
    const errorCode = String(error?.code || "").trim().toUpperCase() || "UNKNOWN_BACKEND_ERROR";
    const errorDetails = isPlainObject(error?.details) ? error.details : null;
    const logMetrics = buildFirstRunPlanLogMetrics({ errorDetails });
    const status =
      errorCode === "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE" ? 503
      : errorCode === "FIRST_RUN_PLAN_PROVIDER_TIMEOUT" ? 504
      : errorCode === "INVALID_FIRST_RUN_PLAN_RESPONSE" ? 502
      : 503;
    logAiStageError({
      app,
      request,
      route,
      stage: "provider",
      status,
      errorCode,
      err: error,
      context,
    });
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "first-run-plan",
      route,
      planTier: quotaState.planTier,
      decisionSource: "ai",
      statusCode: status,
      mode: "generate",
      providerStatus:
        errorDetails?.providerStatus || (errorCode === "INVALID_FIRST_RUN_PLAN_RESPONSE" ? "invalid_response" : "error"),
      providerMs: logMetrics.providerMs,
      rejectionStage: errorDetails?.rejectionStage || null,
      rejectionReason: errorDetails?.rejectionReason || null,
      repairedOccurrenceCount: logMetrics.repairedOccurrenceCount,
      repairedMinutesDelta: logMetrics.repairedMinutesDelta,
      activeDays: logMetrics.activeDays,
      lightDays: logMetrics.lightDays,
      denseDays: logMetrics.denseDays,
      validationPassed:
        typeof errorDetails?.validationPassed === "boolean" ? errorDetails.validationPassed : null,
      richnessPassed: typeof errorDetails?.richnessPassed === "boolean" ? errorDetails.richnessPassed : null,
      zodIssuePaths: Array.isArray(errorDetails?.zodIssuePaths) ? errorDetails.zodIssuePaths : null,
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Number.isFinite(errorDetails?.totalMs) ? Math.round(errorDetails.totalMs) : Date.now() - startedAt,
      errorCode,
    });
    return reply.code(status).send({
      error: errorCode,
      message:
        errorCode === "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE"
          ? "First run plan backend unavailable."
          : errorCode === "FIRST_RUN_PLAN_PROVIDER_TIMEOUT"
            ? "First run plan provider timed out."
            : "Unable to generate first run plans.",
      requestId: request.requestId,
      ...(errorDetails ? { details: errorDetails } : {}),
    });
  }

  const parsedResponse = firstRunPlanResponseSchema.safeParse(response);
  if (!parsedResponse.success) {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "first-run-plan",
      route,
      planTier: quotaState.planTier,
      decisionSource: "ai",
      statusCode: 502,
      mode: "generate",
      providerStatus: "invalid_response",
      rejectionStage: "response_schema",
      rejectionReason: "provider_parse_failed",
      validationPassed: false,
      richnessPassed: false,
      zodIssuePaths: parsedResponse.error.issues.map((issue) => issue.path.join(".")).filter(Boolean).slice(0, 16),
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "INVALID_FIRST_RUN_PLAN_RESPONSE",
    });
    return reply.code(502).send({
      error: "INVALID_FIRST_RUN_PLAN_RESPONSE",
      message: "First run plan response is invalid.",
      requestId: request.requestId,
    });
  }

  const totalBlocks = parsedResponse.data.plans.reduce(
    (count, plan) => count + (plan?.comparisonMetrics?.totalBlocks || 0),
    0
  );
  const successMetrics = buildFirstRunPlanLogMetrics({ diagnostics: serviceDiagnostics });
  await insertAiRequestLog(app.supabase, {
    requestId: request.requestId,
    userId: request.user.id,
    coachKind: "first-run-plan",
    route,
    planTier: quotaState.planTier,
    decisionSource: "ai",
    statusCode: 200,
    mode: "generate",
    providerStatus: "ok",
    providerMs: successMetrics.providerMs,
    rejectionStage: null,
    rejectionReason: null,
    repairedOccurrenceCount: successMetrics.repairedOccurrenceCount,
    repairedMinutesDelta: successMetrics.repairedMinutesDelta,
    activeDays: successMetrics.activeDays,
    lightDays: successMetrics.lightDays,
    denseDays: successMetrics.denseDays,
    validationPassed: true,
    richnessPassed: true,
    stepCount: parsedResponse.data.plans.length,
    itemCount: totalBlocks,
    requestHash,
    ipHash: hashValue(getClientIp(request)),
    userAgent: request.headers["user-agent"] || "",
    latencyMs: Number.isFinite(serviceDiagnostics?.totalMs) ? Math.round(serviceDiagnostics.totalMs) : Date.now() - startedAt,
  });
  return reply.code(200).send(parsedResponse.data);
}

async function handleFirstRunStarterHintsRoute({ app, request, reply }) {
  const startedAt = Date.now();
  const route = "/ai/first-run-starter-hints";
  const parsedBody = firstRunStarterHintsRequestSchema.safeParse(request.body);
  if (!parsedBody.success) {
    return reply.code(400).send({
      error: "INVALID_BODY",
      message: "Request body is invalid.",
      issues: parsedBody.error.issues,
      requestId: request.requestId,
    });
  }

  const rateLimited =
    enforceMemoryRateLimit({
      key: `starter-hints:user:${request.user.id}`,
      limit: 8,
      windowMs: 60 * 1000,
    }) ||
    enforceMemoryRateLimit({
      key: `starter-hints:ip:${getClientIp(request)}`,
      limit: 30,
      windowMs: 15 * 60 * 1000,
    });
  if (rateLimited) {
    return reply.code(429).send({
      error: "RATE_LIMITED",
      message: "Rate limit exceeded.",
      requestId: request.requestId,
    });
  }

  const requestHash = hashValue(JSON.stringify({ route: "first-run-starter-hints", body: parsedBody.data }));
  let snapshot;
  try {
    snapshot = await loadUserSnapshot(app.supabase, request.user.id);
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "snapshot_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "SNAPSHOT_LOAD_FAILED",
      err: error,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "SNAPSHOT_LOAD_FAILED",
      message: "Unable to load user context.",
    });
  }

  let quotaState;
  try {
    quotaState = await resolveQuotaState(app.supabase, {
      userId: request.user.id,
      entitlement: snapshot.entitlement,
      quotaMode: app.config.AI_QUOTA_MODE,
    });
  } catch (error) {
    logAiStageError({
      app,
      request,
      route,
      stage: "quota_load",
      status: 503,
      errorCode: isSupabaseSchemaError(error) ? "BACKEND_SCHEMA_MISSING" : "QUOTA_LOAD_FAILED",
      err: error,
    });
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return sendAiStageError(reply, request.requestId, {
      status: 503,
      errorCode: "QUOTA_LOAD_FAILED",
      message: "Unable to verify AI quota.",
    });
  }

  if (quotaState.exceeded) {
    return reply.code(429).send({
      error: "QUOTA_EXCEEDED",
      message: "AI quota exceeded.",
      requestId: request.requestId,
      quotaRemaining: quotaState.remaining,
    });
  }

  const context = {
    ...parsedBody.data,
    requestId: request.requestId,
    quotaRemaining: quotaState.remaining,
  };

  let response;
  let serviceDiagnostics = null;
  try {
    const serviceResult = await runFirstRunStarterHintsService({ app, context });
    response = serviceResult.response;
    serviceDiagnostics = serviceResult.diagnostics;
  } catch (error) {
    const errorCode = String(error?.code || "").trim().toUpperCase() || "UNKNOWN_BACKEND_ERROR";
    const errorDetails = isPlainObject(error?.details) ? error.details : null;
    const status =
      errorCode === "FIRST_RUN_STARTER_HINTS_BACKEND_UNAVAILABLE" ? 503
      : errorCode === "FIRST_RUN_STARTER_HINTS_PROVIDER_TIMEOUT" ? 504
      : errorCode === "INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE" ? 502
      : 503;
    logAiStageError({
      app,
      request,
      route,
      stage: "provider",
      status,
      errorCode,
      err: error,
      context,
    });
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "first-run-starter-hints",
      route,
      planTier: quotaState.planTier,
      decisionSource: "ai",
      statusCode: status,
      mode: "starter_hints",
      providerStatus:
        errorDetails?.providerStatus ||
        (errorCode === "INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE" ? "invalid_response" : "error"),
      providerMs: Number.isFinite(errorDetails?.providerMs) ? Math.round(errorDetails.providerMs) : null,
      rejectionStage: errorDetails?.rejectionStage || null,
      rejectionReason: errorDetails?.rejectionReason || null,
      validationPassed:
        typeof errorDetails?.validationPassed === "boolean" ? errorDetails.validationPassed : null,
      richnessPassed: typeof errorDetails?.richnessPassed === "boolean" ? errorDetails.richnessPassed : null,
      zodIssuePaths: Array.isArray(errorDetails?.zodIssuePaths) ? errorDetails.zodIssuePaths : null,
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Number.isFinite(errorDetails?.totalMs) ? Math.round(errorDetails.totalMs) : Date.now() - startedAt,
      errorCode,
    });
    return reply.code(status).send({
      error: errorCode,
      message:
        errorCode === "FIRST_RUN_STARTER_HINTS_BACKEND_UNAVAILABLE"
          ? "First run starter hints backend unavailable."
          : errorCode === "FIRST_RUN_STARTER_HINTS_PROVIDER_TIMEOUT"
            ? "First run starter hints provider timed out."
            : "Unable to generate first run starter hints.",
      requestId: request.requestId,
      ...(errorDetails ? { details: errorDetails } : {}),
    });
  }

  const parsedResponse = firstRunStarterHintsResponseSchema.safeParse(response);
  if (!parsedResponse.success) {
    await insertAiRequestLog(app.supabase, {
      requestId: request.requestId,
      userId: request.user.id,
      coachKind: "first-run-starter-hints",
      route,
      planTier: quotaState.planTier,
      decisionSource: "ai",
      statusCode: 502,
      mode: "starter_hints",
      providerStatus: "invalid_response",
      rejectionStage: "response_schema",
      rejectionReason: "provider_parse_failed",
      validationPassed: false,
      richnessPassed: false,
      zodIssuePaths: parsedResponse.error.issues.map((issue) => issue.path.join(".")).filter(Boolean).slice(0, 16),
      requestHash,
      ipHash: hashValue(getClientIp(request)),
      userAgent: request.headers["user-agent"] || "",
      latencyMs: Date.now() - startedAt,
      errorCode: "INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE",
    });
    return reply.code(502).send({
      error: "INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE",
      message: "First run starter hints response is invalid.",
      requestId: request.requestId,
    });
  }

  await insertAiRequestLog(app.supabase, {
    requestId: request.requestId,
    userId: request.user.id,
    coachKind: "first-run-starter-hints",
    route,
    planTier: quotaState.planTier,
    decisionSource: "ai",
    statusCode: 200,
    mode: "starter_hints",
    providerStatus: "ok",
    providerMs: Number.isFinite(serviceDiagnostics?.providerMs) ? Math.round(serviceDiagnostics.providerMs) : null,
    rejectionStage: null,
    rejectionReason: null,
    validationPassed: true,
    richnessPassed: true,
    stepCount: parsedResponse.data.actionHints.length,
    itemCount: parsedResponse.data.actionHints.length + parsedResponse.data.riskRituals.length,
    requestHash,
    ipHash: hashValue(getClientIp(request)),
    userAgent: request.headers["user-agent"] || "",
    latencyMs: Number.isFinite(serviceDiagnostics?.totalMs) ? Math.round(serviceDiagnostics.totalMs) : Date.now() - startedAt,
  });
  return reply.code(200).send(parsedResponse.data);
}
