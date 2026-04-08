import { resolveExecutableOccurrence } from "../../logic/sessionResolver";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value, maxLength = 0) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";
  if (Number.isInteger(maxLength) && maxLength > 0 && normalized.length > maxLength) {
    return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
  }
  return normalized;
}

function resolveReplyObject(message) {
  if (isPlainObject(message?.coachReply)) return message.coachReply;
  if (isPlainObject(message?.reply)) return message.reply;
  return null;
}

function resolveLegacyContentText(content) {
  if (typeof content === "string") return trimString(content);
  if (!Array.isArray(content)) return "";
  return trimString(
    content
      .map((block) => {
        if (typeof block === "string") return trimString(block);
        if (!isPlainObject(block)) return "";
        return trimString(block.text || block.content || block.value || "");
      })
      .filter(Boolean)
      .join(" ")
  );
}

function buildLastResortReplyText(reply) {
  if (!isPlainObject(reply)) return "";
  const headline = trimString(reply.headline, 72);
  const reason = trimString(reply.reason, 100);
  return trimString([headline, reason].filter(Boolean).join(" — "), 160);
}

export function resolveCoachMessageDisplayText(message) {
  const directText = trimString(message?.text);
  if (directText) return directText;

  const coachReplyMessage = trimString(message?.coachReply?.message);
  if (coachReplyMessage) return coachReplyMessage;

  const legacyReplyMessage = trimString(message?.reply?.message);
  if (legacyReplyMessage) return legacyReplyMessage;

  const legacyMessage = trimString(message?.message);
  if (legacyMessage) return legacyMessage;

  const legacyContent = resolveLegacyContentText(message?.content);
  if (legacyContent) return legacyContent;

  return buildLastResortReplyText(resolveReplyObject(message));
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
    const reply = resolveReplyObject(message);
    return {
      id: createdAt,
      role: message?.role === "assistant" ? "assistant" : "user",
      text: trimString(message?.text),
      displayText: resolveCoachMessageDisplayText(message),
      createdAt,
      reply,
      draftApplyStatus: trimString(message?.coachReply?.createStatus) || null,
      draftApplyMessage: trimString(message?.coachReply?.createMessage) || "",
    };
  });
}
