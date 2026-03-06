import { coachPayloadSchema } from "../../schemas/coach.js";

function buildNowPrompt(context) {
  return [
    "You are the execution coach for Discip-Yourself.",
    "Return one short actionable recommendation for what the user should do now.",
    "No chat. No markdown. No prose outside JSON.",
    "Never invent actions or occurrences that are not in the context.",
    "Prefer resume_session, then start_occurrence, then open_library.",
    `Context: ${JSON.stringify({
      kind: "now",
      selectedDateKey: context.selectedDateKey,
      activeCategoryId: context.activeCategoryId,
      activeSession: context.activeSession,
      topOccurrence: context.topOccurrence,
      doneToday: context.doneToday,
      missedToday: context.missedToday,
      remainingToday: context.remainingToday,
      categoryStatus: context.categoryStatus,
      quotaRemaining: context.quotaRemaining,
      recentHistory: context.recentHistory,
    })}`,
  ].join("\n");
}

function buildRecoveryPrompt(context) {
  return [
    "You are the recovery coach for Discip-Yourself.",
    "Return one short recovery action only.",
    "No chat. No markdown. No prose outside JSON.",
    "Never invent actions or occurrences that are not in the context.",
    "Prefer resume_session, then the smallest remaining action, then open_library.",
    `Context: ${JSON.stringify({
      kind: "recovery",
      selectedDateKey: context.selectedDateKey,
      activeCategoryId: context.activeCategoryId,
      activeSession: context.activeSession,
      dayOccurrences: context.dayOccurrences,
      missedToday: context.missedToday,
      doneToday: context.doneToday,
      plannedToday: context.plannedToday,
      remainingToday: context.remainingToday,
      discipline7d: context.discipline7d?.discipline,
      discipline14d: context.discipline14d?.discipline,
      categoryStatus: context.categoryStatus,
      quotaRemaining: context.quotaRemaining,
    })}`,
  ].join("\n");
}

export async function runOpenAiCoach({ app, kind, context }) {
  if (!app.openai || !app.config?.OPENAI_API_KEY) return null;
  const prompt = kind === "recovery" ? buildRecoveryPrompt(context) : buildNowPrompt(context);
  const completion = await app.openai.chat.completions.create({
    model: app.config.OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a precise execution coach. Output valid JSON only. Keep text compact and actionable.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });
  const content = completion.choices?.[0]?.message?.content || "";
  if (!content) return null;
  const parsed = JSON.parse(content);
  return coachPayloadSchema.parse(parsed);
}
