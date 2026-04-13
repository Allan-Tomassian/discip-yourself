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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    contextKeyCount: Object.keys(safeContext).length,
    hasMessage: typeof safeContext.message === "string" && safeContext.message.length > 0,
    hasRecentMessages: Array.isArray(safeContext.recentMessages) && safeContext.recentMessages.length > 0,
    hasCategorySnapshot: Boolean(safeContext.categorySnapshot),
    hasPlanningSummary: Boolean(safeContext.planningSummary),
    hasPilotageSummary: Boolean(safeContext.pilotageSummary),
  };
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
    },
    "ai route failed"
  );
}

function sendAiStageError(reply, requestId, { status = 503, errorCode, message }) {
  return reply.code(status).send({
    error: errorCode,
    message,
    requestId,
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
      decisionSource: null,
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
    const status =
      errorCode === "SESSION_GUIDANCE_BACKEND_UNAVAILABLE" ? 503
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
      decisionSource: "ai",
      statusCode: status,
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
          : "Unable to prepare premium session guidance.",
      requestId: request.requestId,
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
      decisionSource: "ai",
      statusCode: 502,
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

  await insertAiRequestLog(app.supabase, {
    requestId: request.requestId,
    userId: request.user.id,
    coachKind: "session-guidance",
    route,
    planTier: quotaState.planTier,
    decisionSource: "ai",
    statusCode: 200,
    requestHash,
    ipHash: hashValue(getClientIp(request)),
    userAgent: request.headers["user-agent"] || "",
    latencyMs: Date.now() - startedAt,
  });
  return reply.code(200).send(parsedResponse.data);
}
