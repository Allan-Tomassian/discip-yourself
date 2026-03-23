import { buildNowContext } from "./nowContext.js";
import { safeArray } from "./shared.js";

function normalizeRecentMessages(recentMessages) {
  return safeArray(recentMessages)
    .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant"))
    .map((entry) => ({
      role: entry.role,
      content: typeof entry.content === "string" ? entry.content.trim().slice(0, 500) : "",
    }))
    .filter((entry) => entry.content)
    .slice(-6);
}

export function buildChatContext({
  data,
  selectedDateKey,
  activeCategoryId,
  quotaState,
  requestId,
  body,
  now = new Date(),
}) {
  const baseContext = buildNowContext({
    data,
    selectedDateKey,
    activeCategoryId,
    quotaState,
    requestId,
    trigger: "manual",
    now,
  });
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";

  return {
    ...baseContext,
    message,
    messagePreview: message ? message.slice(0, 120) : null,
    recentMessages: normalizeRecentMessages(body?.recentMessages),
  };
}
