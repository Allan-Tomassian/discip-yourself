import { resolveExecutableOccurrence } from "../../logic/sessionResolver";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function findCoachOccurrence(state, action, selectedDateKey) {
  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const directMatch =
    typeof action?.occurrenceId === "string"
      ? occurrences.find((occurrence) => occurrence?.id === action.occurrenceId) || null
      : null;
  if (directMatch) return directMatch;

  const goalIds = typeof action?.actionId === "string" && action.actionId ? [action.actionId] : [];
  const resolved = resolveExecutableOccurrence(state, {
    dateKey: action?.dateKey || selectedDateKey,
    goalIds,
  });
  if (!resolved?.occurrenceId) return null;
  return occurrences.find((occurrence) => occurrence?.id === resolved.occurrenceId) || null;
}

export function deriveCoachMessageEntries(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return messages.map((message, index) => {
    const createdAt =
      trimString(message?.createdAt) ||
      `${trimString(conversation?.id) || "conversation"}:${index}`;
    return {
      id: createdAt,
      role: message?.role === "assistant" ? "assistant" : "user",
      text: trimString(message?.text),
      createdAt,
      reply: isPlainObject(message?.coachReply) ? message.coachReply : null,
      draftApplyStatus: trimString(message?.coachReply?.createStatus) || null,
      draftApplyMessage: trimString(message?.coachReply?.createMessage) || "",
    };
  });
}
