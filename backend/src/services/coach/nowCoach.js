import { coachResponseSchema } from "../../schemas/coach.js";
import { buildNowFallback } from "../fallback/rules.js";
import { runOpenAiCoach } from "./openaiRunner.js";
import {
  isTodayInterventionAllowed,
  resolveTodayInterventionType,
} from "../../../../src/domain/todayIntervention.js";

function withGovernedTodayIntervention({ context, payload }) {
  const interventionType = resolveTodayInterventionType({
    activeSessionForActiveDate: context.activeSessionForActiveDate,
    openSessionOutsideActiveDate: context.openSessionOutsideActiveDate,
    futureSessions: context.futureSessions,
    primaryActionIntent: payload?.primaryAction?.intent || "",
  });
  if (
    !interventionType ||
    !isTodayInterventionAllowed({
      interventionType,
      primaryActionIntent: payload?.primaryAction?.intent || "",
      activeSessionForActiveDate: context.activeSessionForActiveDate,
      openSessionOutsideActiveDate: context.openSessionOutsideActiveDate,
      futureSessions: context.futureSessions,
    })
  ) {
    throw new Error("invalid_today_intervention");
  }
  return {
    ...payload,
    interventionType,
  };
}

export async function runNowCoach({ app, context }) {
  let result = null;
  let decisionSource = "rules";
  let fallbackReason = "none";
  try {
    result = await runOpenAiCoach({ app, kind: "now", context });
    if (result) {
      result = withGovernedTodayIntervention({ context, payload: result });
      decisionSource = "ai";
    }
  } catch {
    fallbackReason = "invalid_model_output";
  }
  if (!result) {
    result = buildNowFallback(context);
    result = withGovernedTodayIntervention({ context, payload: result });
    decisionSource = "rules";
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
    },
  });
}
