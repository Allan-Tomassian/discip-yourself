import { normalizeCreationProposal } from "../../creation/createItemDraft";
import { uid } from "../../utils/helpers";

export const COACH_CONVERSATIONS_VERSION = 1;
export const COACH_MAX_CONVERSATIONS = 20;
export const COACH_MAX_MESSAGES = 50;
export const COACH_RECENT_MESSAGES_LIMIT = 6;

const COACH_CONVERSATION_MODES = new Set(["free", "plan"]);
const COACH_REPLY_INTENTS = new Set([
  "start_occurrence",
  "resume_session",
  "open_library",
  "open_pilotage",
  "open_today",
  "open_support",
  "continue_coach",
  "open_created_view",
]);
const COACH_REPLY_CREATE_STATUSES = new Set(["idle", "creating", "created", "error"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value, maxLength = null) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!Number.isFinite(maxLength)) return trimmed;
  return trimmed.slice(0, Math.max(0, maxLength));
}

function normalizeIsoString(value, fallback = null) {
  const trimmed = trimString(value, 64);
  return trimmed || fallback;
}

function normalizeContextSnapshot(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  return {
    activeCategoryId: trimString(source.activeCategoryId, 200) || null,
    dateKey: trimString(source.dateKey, 32) || null,
  };
}

function normalizeConversationMode(value, fallback = "free") {
  const next = trimString(value, 24).toLowerCase();
  return COACH_CONVERSATION_MODES.has(next) ? next : fallback;
}

function normalizeViewTarget(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  const type = trimString(source.type, 40);
  if (type === "edit-item") {
    const itemId = trimString(source.itemId, 200);
    if (!itemId) return null;
    return {
      type: "edit-item",
      itemId,
      categoryId: trimString(source.categoryId, 200) || null,
    };
  }
  if (type === "library-category") {
    const actionIds = Array.isArray(source.actionIds)
      ? source.actionIds.map((entry) => trimString(entry, 200)).filter(Boolean).slice(0, 6)
      : [];
    return {
      type: "library-category",
      categoryId: trimString(source.categoryId, 200) || null,
      focusSection: source.focusSection === "objectives" ? "objectives" : "actions",
      outcomeId: trimString(source.outcomeId, 200) || null,
      actionIds,
    };
  }
  return null;
}

function normalizeReplyAction(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  const label = trimString(source.label, 64);
  const intent = trimString(source.intent, 40);
  if (!label || !COACH_REPLY_INTENTS.has(intent)) return null;
  return {
    label,
    intent,
    categoryId: trimString(source.categoryId, 200) || null,
    actionId: trimString(source.actionId, 200) || null,
    occurrenceId: trimString(source.occurrenceId, 200) || null,
    dateKey: trimString(source.dateKey, 32) || null,
    viewTarget: normalizeViewTarget(source.viewTarget),
  };
}

function normalizeCreateStatus(value) {
  const next = trimString(value, 24).toLowerCase();
  return COACH_REPLY_CREATE_STATUSES.has(next) ? next : null;
}

function normalizeCoachReply(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  if (source.kind === "conversation" || COACH_CONVERSATION_MODES.has(trimString(source.mode, 24).toLowerCase())) {
    const message = trimString(source.message, 1200);
    if (!message) return null;
    return {
      kind: "conversation",
      mode: normalizeConversationMode(source.mode, "free"),
      message,
      primaryAction: normalizeReplyAction(source.primaryAction),
      secondaryAction: normalizeReplyAction(source.secondaryAction),
      proposal: source.proposal ? normalizeCreationProposal(source.proposal) : null,
      createStatus: normalizeCreateStatus(source.createStatus),
      createMessage: trimString(source.createMessage, 220),
      viewTarget: normalizeViewTarget(source.viewTarget),
    };
  }

  const headline = trimString(source.headline, 120);
  const reason = trimString(source.reason, 320);
  if (!headline && !reason) return null;
  const suggestedDurationMin = Number(source.suggestedDurationMin);
  return {
    kind: "chat",
    headline: headline || "Action",
    reason,
    primaryAction: normalizeReplyAction(source.primaryAction),
    secondaryAction: normalizeReplyAction(source.secondaryAction),
    suggestedDurationMin: Number.isFinite(suggestedDurationMin) ? Math.max(1, Math.round(suggestedDurationMin)) : null,
    draftChanges: (Array.isArray(source.draftChanges) ? source.draftChanges : [])
      .filter(isPlainObject)
      .slice(0, 4)
      .map((change) => ({ ...change })),
    createStatus: normalizeCreateStatus(source.createStatus),
    createMessage: trimString(source.createMessage, 220),
    viewTarget: normalizeViewTarget(source.viewTarget),
  };
}

function normalizeMessage(rawMessage, fallbackCreatedAt = null) {
  const source = isPlainObject(rawMessage) ? rawMessage : {};
  const role = source.role === "assistant" ? "assistant" : source.role === "user" ? "user" : "";
  const text = trimString(source.text);
  if (!role || !text) return null;
  return {
    role,
    text,
    createdAt: normalizeIsoString(source.createdAt, fallbackCreatedAt || new Date().toISOString()),
    coachReply: normalizeCoachReply(source.coachReply || source.reply || null),
  };
}

function sortConversationsByUpdatedAt(conversations) {
  return [...conversations].sort((left, right) => {
    const leftUpdated = normalizeIsoString(left?.updatedAt, "") || "";
    const rightUpdated = normalizeIsoString(right?.updatedAt, "") || "";
    if (leftUpdated !== rightUpdated) return rightUpdated.localeCompare(leftUpdated);
    return trimString(right?.id, 120).localeCompare(trimString(left?.id, 120));
  });
}

function normalizeConversation(rawConversation) {
  const source = isPlainObject(rawConversation) ? rawConversation : {};
  const createdAt = normalizeIsoString(source.createdAt, new Date().toISOString());
  const messages = (Array.isArray(source.messages) ? source.messages : [])
    .map((message) => normalizeMessage(message, createdAt))
    .filter(Boolean)
    .slice(-COACH_MAX_MESSAGES);
  const latestMessageCreatedAt = messages[messages.length - 1]?.createdAt || null;
  return {
    id: trimString(source.id, 120) || uid(),
    createdAt,
    updatedAt: normalizeIsoString(source.updatedAt, latestMessageCreatedAt || createdAt),
    messages,
    mode: normalizeConversationMode(source.mode, "free"),
    contextSnapshot: normalizeContextSnapshot(source.contextSnapshot),
  };
}

export function ensureCoachConversationsState(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  const conversations = (Array.isArray(source.conversations) ? source.conversations : [])
    .map(normalizeConversation);

  return {
    version: COACH_CONVERSATIONS_VERSION,
    conversations: sortConversationsByUpdatedAt(conversations).slice(0, COACH_MAX_CONVERSATIONS),
  };
}

export function createCoachConversation({ contextSnapshot = null, now = new Date(), mode = "free" } = {}) {
  const createdAt = now instanceof Date ? now.toISOString() : new Date().toISOString();
  return {
    id: uid(),
    createdAt,
    updatedAt: createdAt,
    messages: [],
    mode: normalizeConversationMode(mode, "free"),
    contextSnapshot: normalizeContextSnapshot(contextSnapshot),
  };
}

export function getLatestCoachConversation(rawValue) {
  const state = ensureCoachConversationsState(rawValue);
  return state.conversations[0] || null;
}

export function getCoachConversationById(rawValue, conversationId) {
  const safeConversationId = trimString(conversationId, 120);
  if (!safeConversationId) return null;
  const state = ensureCoachConversationsState(rawValue);
  return state.conversations.find((conversation) => conversation.id === safeConversationId) || null;
}

export function upsertCoachConversation(rawValue, nextConversation) {
  const conversation = normalizeConversation(nextConversation);
  const state = ensureCoachConversationsState(rawValue);
  const remaining = state.conversations.filter((entry) => entry.id !== conversation.id);
  return ensureCoachConversationsState({
    version: COACH_CONVERSATIONS_VERSION,
    conversations: [conversation, ...remaining],
  });
}

export function removeCoachConversation(rawValue, conversationId) {
  const safeConversationId = trimString(conversationId, 120);
  if (!safeConversationId) return ensureCoachConversationsState(rawValue);
  const state = ensureCoachConversationsState(rawValue);
  return ensureCoachConversationsState({
    version: COACH_CONVERSATIONS_VERSION,
    conversations: state.conversations.filter((entry) => entry.id !== safeConversationId),
  });
}

export function appendCoachConversationMessages(
  rawValue,
  { conversationId = null, messages = [], contextSnapshot = null, mode = null } = {}
) {
  const state = ensureCoachConversationsState(rawValue);
  const normalizedMessages = (Array.isArray(messages) ? messages : [])
    .map((message) => normalizeMessage(message))
    .filter(Boolean);

  const existingConversation =
    (conversationId ? state.conversations.find((entry) => entry.id === conversationId) : null) || null;
  const baseConversation = existingConversation || createCoachConversation({ contextSnapshot, mode });
  const nextMessages = [...baseConversation.messages, ...normalizedMessages].slice(-COACH_MAX_MESSAGES);
  const updatedAt = normalizedMessages[normalizedMessages.length - 1]?.createdAt || new Date().toISOString();
  const nextConversation = {
    ...baseConversation,
    updatedAt,
    messages: nextMessages,
    mode: normalizeConversationMode(mode, baseConversation.mode),
    contextSnapshot: normalizeContextSnapshot(contextSnapshot || baseConversation.contextSnapshot),
  };

  return {
    conversation: nextConversation,
    state: upsertCoachConversation(state, nextConversation),
  };
}

export function buildCoachConversationMessage(role, text, createdAt = new Date().toISOString(), coachReply = null) {
  return normalizeMessage({ role, text, createdAt, coachReply });
}

export function buildAssistantTranscriptText(reply) {
  if (!isPlainObject(reply)) return "";
  if (reply.kind === "conversation") {
    return trimString(reply.message, 1200);
  }
  const headline = trimString(reply.headline);
  const reason = trimString(reply.reason);
  return [headline, reason].filter(Boolean).join("\n");
}

export function buildRecentMessagesFromConversation(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return messages
    .map((message) => normalizeMessage(message))
    .filter(Boolean)
    .slice(-COACH_RECENT_MESSAGES_LIMIT)
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));
}

export function updateCoachConversationMessage(rawValue, { conversationId, messageCreatedAt, update, now = new Date() } = {}) {
  const safeConversationId = trimString(conversationId, 120);
  const safeMessageCreatedAt = normalizeIsoString(messageCreatedAt, null);
  if (!safeConversationId || !safeMessageCreatedAt) return ensureCoachConversationsState(rawValue);
  const state = ensureCoachConversationsState(rawValue);
  const conversation = state.conversations.find((entry) => entry.id === safeConversationId) || null;
  if (!conversation) return state;

  let didUpdate = false;
  const nextMessages = conversation.messages.map((message) => {
    if (message?.createdAt !== safeMessageCreatedAt) return message;
    const nextMessage =
      typeof update === "function"
        ? update(message)
        : isPlainObject(update)
          ? { ...message, ...update }
          : message;
    const normalized = normalizeMessage(nextMessage, safeMessageCreatedAt);
    if (!normalized) return message;
    didUpdate = true;
    return normalized;
  });
  if (!didUpdate) return state;

  return upsertCoachConversation(state, {
    ...conversation,
    updatedAt: now instanceof Date ? now.toISOString() : new Date().toISOString(),
    messages: nextMessages,
  });
}

export function updateCoachConversationMode(rawValue, { conversationId, mode } = {}) {
  const safeConversationId = trimString(conversationId, 120);
  if (!safeConversationId) return ensureCoachConversationsState(rawValue);
  const state = ensureCoachConversationsState(rawValue);
  const conversation = state.conversations.find((entry) => entry.id === safeConversationId) || null;
  if (!conversation) return state;
  return upsertCoachConversation(state, {
    ...conversation,
    mode: normalizeConversationMode(mode, conversation.mode),
  });
}

export function getCoachSessionReplies() {
  return {};
}

export function subscribeCoachSessionReplies() {
  return () => {};
}

export function setCoachSessionReply() {}

export function updateCoachSessionReplyDraftStatus() {}

export function clearCoachSessionReplies() {}
