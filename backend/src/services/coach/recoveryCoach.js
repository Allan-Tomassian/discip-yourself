import { coachResponseSchema } from "../../schemas/coach.js";
import { buildRecoveryFallback } from "../fallback/rules.js";
import { runOpenAiCoach } from "./openaiRunner.js";
import {
  buildTodayCanonicalContextSummary,
  TODAY_BACKEND_RESOLUTION_STATUS,
  TODAY_DIAGNOSTIC_REJECTION_REASON,
} from "../../../../src/domain/todayIntervention.js";

export async function runRecoveryCoach({ app, context }) {
  let result = null;
  let decisionSource = "rules";
  let fallbackReason = "none";
  let resolutionStatus = TODAY_BACKEND_RESOLUTION_STATUS.RULES_FALLBACK;
  let rejectionReason = TODAY_DIAGNOSTIC_REJECTION_REASON.NONE;
  try {
    result = await runOpenAiCoach({ app, kind: "recovery", context });
    if (result) {
      decisionSource = "ai";
      resolutionStatus = TODAY_BACKEND_RESOLUTION_STATUS.ACCEPTED_AI;
    }
  } catch {
    fallbackReason = "invalid_model_output";
    rejectionReason = TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_MODEL_OUTPUT;
    resolutionStatus = TODAY_BACKEND_RESOLUTION_STATUS.REJECTED_TO_RULES;
  }
  if (!result) {
    result = buildRecoveryFallback(context);
    decisionSource = "rules";
    if (resolutionStatus !== TODAY_BACKEND_RESOLUTION_STATUS.REJECTED_TO_RULES) {
      resolutionStatus = TODAY_BACKEND_RESOLUTION_STATUS.RULES_FALLBACK;
      rejectionReason = TODAY_DIAGNOSTIC_REJECTION_REASON.NONE;
    }
  }
  return coachResponseSchema.parse({
    ...result,
    decisionSource,
    interventionType: result?.interventionType ?? null,
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
      diagnostics: {
        resolutionStatus,
        rejectionReason,
        canonicalContextSummary: buildTodayCanonicalContextSummary({
          activeDate: context.selectedDateKey,
          isToday: false,
          activeSessionForActiveDate: context.activeSession,
          openSessionOutsideActiveDate: null,
          futureSessions: [],
          plannedActionsForActiveDate: context.dayOccurrences,
          focusOccurrenceForActiveDate: context.sortedOccurrences?.[0] || null,
        }),
      },
    },
  });
}
