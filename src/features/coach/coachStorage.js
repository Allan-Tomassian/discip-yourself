import { uid } from "../../utils/helpers";

export const COACH_CONVERSATIONS_VERSION = 1;
export const COACH_MAX_CONVERSATIONS = 20;
export const COACH_MAX_MESSAGES = 50;
export const COACH_RECENT_MESSAGES_LIMIT = 6;

const SESSION_REPLY_STORE = new Map();
const SESSION_REPLY_LISTENERS = new Set();

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

function normalizeMessage(rawMessage, fallbackCreatedAt = null) {
  const source = isPlainObject(rawMessage) ? rawMessage : {};
  const role = source.role === "assistant" ? "assistant" : source.role === "user" ? "user" : "";
  const text = trimString(source.text);
  if (!role || !text) return null;
  return {
    role,
    text,
    createdAt: normalizeIsoString(source.createdAt, fallbackCreatedAt || new Date().toISOString()),
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
    contextSnapshot: normalizeContextSnapshot(source.contextSnapshot),
  };
}

function emitSessionReplyChange(conversationId) {
  for (const listener of SESSION_REPLY_LISTENERS) {
    listener(conversationId);
  }
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

export function createCoachConversation({ contextSnapshot = null, now = new Date() } = {}) {
  const createdAt = now instanceof Date ? now.toISOString() : new Date().toISOString();
  return {
    id: uid(),
    createdAt,
    updatedAt: createdAt,
    messages: [],
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

export function appendCoachConversationMessages(rawValue, { conversationId = null, messages = [], contextSnapshot = null } = {}) {
  const state = ensureCoachConversationsState(rawValue);
  const normalizedMessages = (Array.isArray(messages) ? messages : [])
    .map((message) => normalizeMessage(message))
    .filter(Boolean);

  const existingConversation =
    (conversationId ? state.conversations.find((entry) => entry.id === conversationId) : null) || null;
  const baseConversation = existingConversation || createCoachConversation({ contextSnapshot });
  const nextMessages = [...baseConversation.messages, ...normalizedMessages].slice(-COACH_MAX_MESSAGES);
  const updatedAt = normalizedMessages[normalizedMessages.length - 1]?.createdAt || new Date().toISOString();
  const nextConversation = {
    ...baseConversation,
    updatedAt,
    messages: nextMessages,
    contextSnapshot: normalizeContextSnapshot(contextSnapshot || baseConversation.contextSnapshot),
  };

  return {
    conversation: nextConversation,
    state: upsertCoachConversation(state, nextConversation),
  };
}

export function buildCoachConversationMessage(role, text, createdAt = new Date().toISOString()) {
  return normalizeMessage({ role, text, createdAt });
}

export function buildAssistantTranscriptText(reply) {
  if (!isPlainObject(reply)) return "";
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

function getSessionReplyBucket(conversationId) {
  const safeConversationId = trimString(conversationId, 120);
  if (!safeConversationId) return {};
  return SESSION_REPLY_STORE.get(safeConversationId) || {};
}

export function getCoachSessionReplies(conversationId) {
  return getSessionReplyBucket(conversationId);
}

export function subscribeCoachSessionReplies(listener) {
  if (typeof listener !== "function") return () => {};
  SESSION_REPLY_LISTENERS.add(listener);
  return () => {
    SESSION_REPLY_LISTENERS.delete(listener);
  };
}

export function setCoachSessionReply(conversationId, messageCreatedAt, reply) {
  const safeConversationId = trimString(conversationId, 120);
  const safeMessageCreatedAt = normalizeIsoString(messageCreatedAt, null);
  if (!safeConversationId || !safeMessageCreatedAt || !isPlainObject(reply)) return;
  const currentBucket = getSessionReplyBucket(safeConversationId);
  SESSION_REPLY_STORE.set(safeConversationId, {
    ...currentBucket,
    [safeMessageCreatedAt]: {
      reply,
      draftApplyStatus: Array.isArray(reply?.draftChanges) && reply.draftChanges.length ? "idle" : null,
      draftApplyMessage: "",
    },
  });
  emitSessionReplyChange(safeConversationId);
}

export function updateCoachSessionReplyDraftStatus(conversationId, messageCreatedAt, nextPatch) {
  const safeConversationId = trimString(conversationId, 120);
  const safeMessageCreatedAt = normalizeIsoString(messageCreatedAt, null);
  if (!safeConversationId || !safeMessageCreatedAt || !isPlainObject(nextPatch)) return;
  const currentBucket = getSessionReplyBucket(safeConversationId);
  const currentEntry = isPlainObject(currentBucket[safeMessageCreatedAt]) ? currentBucket[safeMessageCreatedAt] : null;
  if (!currentEntry) return;
  SESSION_REPLY_STORE.set(safeConversationId, {
    ...currentBucket,
    [safeMessageCreatedAt]: {
      ...currentEntry,
      ...nextPatch,
    },
  });
  emitSessionReplyChange(safeConversationId);
}

export function clearCoachSessionReplies(conversationId) {
  const safeConversationId = trimString(conversationId, 120);
  if (!safeConversationId || !SESSION_REPLY_STORE.has(safeConversationId)) return;
  SESSION_REPLY_STORE.delete(safeConversationId);
  emitSessionReplyChange(safeConversationId);
}
