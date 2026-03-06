import { coachResponseSchema } from "../../schemas/coach.js";
import { buildRecoveryFallback } from "../fallback/rules.js";
import { runOpenAiCoach } from "./openaiRunner.js";

export async function runRecoveryCoach({ app, context }) {
  let result = null;
  let decisionSource = "rules";
  let fallbackReason = "none";
  try {
    result = await runOpenAiCoach({ app, kind: "recovery", context });
    if (result) decisionSource = "ai";
  } catch {
    fallbackReason = "invalid_model_output";
  }
  if (!result) {
    result = buildRecoveryFallback(context);
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
      occurrenceId: context.sortedOccurrences[0]?.id || context.activeSession?.occurrenceId || null,
      sessionId: context.activeSession?.id || null,
      quotaRemaining: context.quotaRemaining,
      fallbackReason: decisionSource === "ai" ? "none" : fallbackReason,
      trigger: context.trigger,
    },
  });
}
