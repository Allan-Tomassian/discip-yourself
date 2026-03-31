import { coachLocalAnalysisResponseSchema } from "../../schemas/coach.js";
import { buildLocalAnalysisFallback } from "../fallback/rules.js";
import { isOpenAiModelOutputError, runOpenAiCoach } from "./openaiRunner.js";

export async function runLocalAnalysisCoach({ app, context }) {
  let result = null;
  let decisionSource = "rules";
  let fallbackReason = "none";

  try {
    result = await runOpenAiCoach({ app, kind: "chat", context });
    if (result) {
      decisionSource = "ai";
    }
  } catch (error) {
    if (isOpenAiModelOutputError(error)) {
      app.log?.warn?.(
        {
          requestId: context.requestId,
          kind: "local-analysis",
          issueCode: error.issueCode,
          surface: context.analysisSurface || null,
        },
        "OpenAI local analysis output rejected before delivery",
      );
      fallbackReason = "invalid_model_output";
    } else {
      fallbackReason = "backend_error";
    }
  }

  if (!result) {
    result = buildLocalAnalysisFallback(context);
  }

  return coachLocalAnalysisResponseSchema.parse({
    ...result,
    decisionSource,
    meta: {
      coachVersion: "v1",
      requestId: context.requestId,
      selectedDateKey: context.activeDate,
      activeCategoryId: context.activeCategoryId,
      quotaRemaining: context.quotaRemaining,
      fallbackReason: decisionSource === "ai" ? "none" : fallbackReason,
      messagePreview: context.messagePreview || null,
    },
  });
}
