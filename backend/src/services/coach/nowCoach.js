import { coachResponseSchema } from "../../schemas/coach.js";
import { buildNowFallback } from "../fallback/rules.js";
import { isOpenAiModelOutputError, runOpenAiCoach } from "./openaiRunner.js";
import {
  buildTodayCanonicalContextSummary,
  diagnoseTodayIntervention,
  TODAY_BACKEND_RESOLUTION_STATUS,
  TODAY_DIAGNOSTIC_REJECTION_REASON,
} from "../../../../src/domain/todayIntervention.js";

function withGovernedTodayIntervention({ context, payload }) {
  const diagnosis = diagnoseTodayIntervention({
    requestedInterventionType: payload?.interventionType || null,
    activeSessionForActiveDate: context.activeSessionForActiveDate,
    openSessionOutsideActiveDate: context.openSessionOutsideActiveDate,
    futureSessions: context.futureSessions,
    primaryActionIntent: payload?.primaryAction?.intent || "",
    primaryActionDateKey: payload?.primaryAction?.dateKey || "",
    activeDate: context.activeDate,
    systemToday: context.systemToday,
    focusOccurrenceForActiveDate: context.focusOccurrenceForActiveDate,
    gapSummary: context.gapSummary,
  });
  if (!diagnosis.ok || !diagnosis.resolvedInterventionType) {
    throw new Error("invalid_today_intervention");
  }
  return {
    ...payload,
    interventionType: diagnosis.resolvedInterventionType,
  };
}

export async function runNowCoach({ app, context }) {
  let result = null;
  let decisionSource = "rules";
  let fallbackReason = "none";
  let resolutionStatus = TODAY_BACKEND_RESOLUTION_STATUS.RULES_FALLBACK;
  let rejectionReason = TODAY_DIAGNOSTIC_REJECTION_REASON.NONE;
  try {
    result = await runOpenAiCoach({ app, kind: "now", context });
    if (result) {
      result = withGovernedTodayIntervention({ context, payload: result });
      decisionSource = "ai";
      resolutionStatus = TODAY_BACKEND_RESOLUTION_STATUS.ACCEPTED_AI;
    }
  } catch (error) {
    if (error?.message === "invalid_today_intervention") {
      const governanceDiagnosis = diagnoseTodayIntervention({
        requestedInterventionType: result?.interventionType || null,
        activeSessionForActiveDate: context.activeSessionForActiveDate,
        openSessionOutsideActiveDate: context.openSessionOutsideActiveDate,
        futureSessions: context.futureSessions,
        primaryActionIntent: result?.primaryAction?.intent || "",
        primaryActionDateKey: result?.primaryAction?.dateKey || "",
        activeDate: context.activeDate,
        systemToday: context.systemToday,
        focusOccurrenceForActiveDate: context.focusOccurrenceForActiveDate,
        gapSummary: context.gapSummary,
      });
      rejectionReason =
        governanceDiagnosis.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.GOVERNANCE_REJECTED;
      resolutionStatus = TODAY_BACKEND_RESOLUTION_STATUS.REJECTED_TO_RULES;
    } else {
      if (isOpenAiModelOutputError(error)) {
        app.log?.warn?.(
          {
            requestId: context.requestId,
            kind: "now",
            issueCode: error.issueCode,
          },
          "OpenAI coach output rejected before governance",
        );
      }
      fallbackReason = "invalid_model_output";
      rejectionReason = TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_MODEL_OUTPUT;
      resolutionStatus = TODAY_BACKEND_RESOLUTION_STATUS.REJECTED_TO_RULES;
    }
    result = null;
  }
  if (!result) {
    result = buildNowFallback(context);
    result = withGovernedTodayIntervention({ context, payload: result });
    decisionSource = "rules";
    if (resolutionStatus !== TODAY_BACKEND_RESOLUTION_STATUS.REJECTED_TO_RULES) {
      resolutionStatus = TODAY_BACKEND_RESOLUTION_STATUS.RULES_FALLBACK;
      rejectionReason = TODAY_DIAGNOSTIC_REJECTION_REASON.NONE;
    }
  }
  return coachResponseSchema.parse({
    ...result,
    decisionSource,
    meta: {
      coachVersion: "v1",
      requestId: context.requestId,
      selectedDateKey: context.activeDate,
      activeCategoryId: context.activeCategoryId,
      occurrenceId: context.focusOccurrenceForActiveDate?.id || context.activeSessionForActiveDate?.occurrenceId || null,
      sessionId: context.activeSessionForActiveDate?.id || null,
      quotaRemaining: context.quotaRemaining,
      fallbackReason: decisionSource === "ai" ? "none" : fallbackReason,
      trigger: context.trigger,
      diagnostics: {
        resolutionStatus,
        rejectionReason,
        canonicalContextSummary: buildTodayCanonicalContextSummary({
          activeDate: context.activeDate,
          isToday: context.isToday,
          activeSessionForActiveDate: context.activeSessionForActiveDate,
          openSessionOutsideActiveDate: context.openSessionOutsideActiveDate,
          futureSessions: context.futureSessions,
          plannedActionsForActiveDate: context.plannedActionsForActiveDate,
          focusOccurrenceForActiveDate: context.focusOccurrenceForActiveDate,
        }),
      },
    },
  });
}
