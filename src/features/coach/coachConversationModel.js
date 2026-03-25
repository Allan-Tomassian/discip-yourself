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

export function renderCoachActionButtonLabel(action, suggestedDurationMin = null) {
  if (!action) return "";
  const durationLabel = Number.isFinite(suggestedDurationMin)
    ? `${suggestedDurationMin} min`
    : Number.isFinite(action.suggestedDurationMin)
      ? `${action.suggestedDurationMin} min`
      : "";
  return [trimString(action.label), durationLabel].filter(Boolean).join(" • ");
}

export function describeCoachDraftChange(change, { goalsById, categoriesById }) {
  if (!isPlainObject(change)) return "";
  const goalTitle =
    trimString(change.title) ||
    goalsById.get(change.actionId || "")?.title ||
    "Action";
  const categoryName = categoriesById.get(change.categoryId || "")?.name || null;
  const timingBits = [];
  if (change.dateKey) timingBits.push(change.dateKey);
  if (change.startTime) timingBits.push(change.startTime);
  if (Number.isFinite(change.durationMin)) timingBits.push(`${change.durationMin} min`);

  if (change.type === "create_action") {
    return ["Créer", goalTitle, categoryName, ...timingBits].filter(Boolean).join(" · ");
  }
  if (change.type === "update_action") {
    return ["Mettre à jour", goalTitle, categoryName].filter(Boolean).join(" · ");
  }
  if (change.type === "schedule_action") {
    return ["Planifier", goalTitle, ...timingBits].filter(Boolean).join(" · ");
  }
  if (change.type === "reschedule_occurrence") {
    return ["Replanifier", goalTitle, ...timingBits].filter(Boolean).join(" · ");
  }
  if (change.type === "archive_action") {
    return ["Archiver", goalTitle].filter(Boolean).join(" · ");
  }
  return goalTitle;
}

export function deriveCoachMessageEntries(conversation, sessionRepliesByCreatedAt) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const replies = isPlainObject(sessionRepliesByCreatedAt) ? sessionRepliesByCreatedAt : {};
  return messages.map((message, index) => {
    const createdAt =
      trimString(message?.createdAt) ||
      `${trimString(conversation?.id) || "conversation"}:${index}`;
    const sessionReply = replies[createdAt] || null;
    return {
      id: createdAt,
      role: message?.role === "assistant" ? "assistant" : "user",
      text: trimString(message?.text),
      createdAt,
      reply: sessionReply?.reply || null,
      draftApplyStatus: sessionReply?.draftApplyStatus || null,
      draftApplyMessage: sessionReply?.draftApplyMessage || "",
    };
  });
}
