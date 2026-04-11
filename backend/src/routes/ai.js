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
    request.log.error({ err: error, requestId: request.requestId }, "snapshot load failed");
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return reply.code(503).send({
      error: "BACKEND_ERROR",
      message: "Unable to load user context.",
      requestId: request.requestId,
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
    request.log.error({ err: error, requestId: request.requestId }, "quota load failed");
    if (isSupabaseSchemaError(error)) {
      return reply.code(503).send(buildSchemaErrorReply(request.requestId));
    }
    return reply.code(503).send({
      error: "BACKEND_ERROR",
      message: "Unable to resolve AI quota.",
      requestId: request.requestId,
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

  let response;
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
    response = responseSchema.parse(await runner({ app, context, snapshot, quotaState }));
  } catch (error) {
    request.log.error(
      {
        err: error,
        requestId: request.requestId,
        coachKind,
        ...activeSessionDiagnostics,
      },
      "coach route failed"
    );
    return reply.code(503).send({
      error: "BACKEND_ERROR",
      message: "Unable to build coach response.",
      requestId: request.requestId,
    });
  }

  await insertAiRequestLog(app.supabase, {
    requestId: request.requestId,
    userId: request.user.id,
    coachKind,
    route: `/ai/${coachKind}`,
    planTier: quotaState.planTier,
    decisionSource: response.decisionSource,
    statusCode: 200,
    requestHash,
    ipHash: hashValue(getClientIp(request)),
    userAgent: request.headers["user-agent"] || "",
    latencyMs: Date.now() - startedAt,
  });
  return reply.code(200).send(response);
}
