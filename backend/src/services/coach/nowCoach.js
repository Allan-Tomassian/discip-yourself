import { coachResponseSchema } from "../../schemas/coach.js";
import { buildNowFallback } from "../fallback/rules.js";
import { runOpenAiCoach } from "./openaiRunner.js";

export async function runNowCoach({ app, context }) {
  let result = null;
  let decisionSource = "rules";
  let fallbackReason = "none";
  try {
    result = await runOpenAiCoach({ app, kind: "now", context });
    if (result) decisionSource = "ai";
  } catch {
    fallbackReason = "invalid_model_output";
  }
  if (!result) {
    result = buildNowFallback(context);
    decisionSource = "rules";
  }
  return coachResponseSchema.parse({
    ...result,
    decisionSource,
    meta: {
      coachVersion: "v1",
      requestId: context.requestId,
      selectedDateKey: context.selectedDateKey,
      activeCategoryId: context.activeCategoryId,
      occurrenceId: context.topOccurrence?.id || context.activeSession?.occurrenceId || null,
      sessionId: context.activeSession?.id || null,
      quotaRemaining: context.quotaRemaining,
      fallbackReason: decisionSource === "ai" ? "none" : fallbackReason,
      trigger: context.trigger,
    },
  });
}
