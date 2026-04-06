import { coachChatResponseSchema } from "../../schemas/coach.js";
import { buildChatFallback } from "../fallback/rules.js";
import { isOpenAiModelOutputError, runOpenAiCoach } from "./openaiRunner.js";

function resolveChatRulesReason({ hasOpenAiKey, hasOpenAiClient, fallbackReason }) {
  if (fallbackReason === "invalid_model_output") return "invalid_model_output";
  if (fallbackReason === "backend_error") return "openai_backend_error";
  if (!hasOpenAiKey) return "openai_key_missing";
  if (!hasOpenAiClient) return "openai_disabled";
  return "business_fallback";
}

export async function runChatCoach({ app, context }) {
  let result = null;
  let decisionSource = "rules";
  let fallbackReason = "none";
  let issueCode = null;
  let backendError = null;
  const hasOpenAiKey = Boolean(String(app?.config?.OPENAI_API_KEY || "").trim());
  const hasOpenAiClient = Boolean(app?.openai);

  try {
    result = await runOpenAiCoach({ app, kind: "chat", context });
    if (result) {
      decisionSource = "ai";
    }
  } catch (error) {
    if (isOpenAiModelOutputError(error)) {
      fallbackReason = "invalid_model_output";
      issueCode = error.issueCode;
    } else {
      fallbackReason = "backend_error";
      backendError = error;
    }
  }

  if (!result) {
    result = buildChatFallback(context);
  }

  const effectiveFallbackReason = decisionSource === "ai" ? "none" : fallbackReason;
  const rulesReason =
    decisionSource === "rules"
      ? resolveChatRulesReason({ hasOpenAiKey, hasOpenAiClient, fallbackReason: effectiveFallbackReason })
      : null;

  const logPayload = {
    requestId: context.requestId,
    kind: "chat",
    chatMode: context.chatMode || null,
    decisionSource,
    fallbackReason: effectiveFallbackReason,
    hasOpenAiKey,
    hasOpenAiClient,
  };
  if (rulesReason) logPayload.rulesReason = rulesReason;
  if (issueCode) logPayload.issueCode = issueCode;
  if (backendError) logPayload.err = backendError;

  if (decisionSource === "ai") {
    app.log?.info?.(logPayload, "Chat coach resolved with AI");
  } else if (rulesReason === "openai_backend_error") {
    app.log?.error?.(logPayload, "Chat coach resolved with rules fallback");
  } else {
    app.log?.warn?.(logPayload, "Chat coach resolved with rules fallback");
  }

  return coachChatResponseSchema.parse({
    ...result,
    decisionSource,
    meta: {
      coachVersion: "v1",
      requestId: context.requestId,
      selectedDateKey: context.activeDate,
      activeCategoryId: context.activeCategoryId,
      quotaRemaining: context.quotaRemaining,
      fallbackReason: effectiveFallbackReason,
      messagePreview: context.messagePreview || null,
    },
  });
}
