import { describe, expect, it } from "vitest";
import { migrate } from "../../logic/state";
import {
  appendCoachConversationMessages,
  buildAssistantTranscriptText,
  buildCoachConversationMessage,
  buildRecentMessagesFromConversation,
  createCoachConversation,
  ensureCoachConversationsState,
} from "./coachStorage";

describe("coachStorage", () => {
  it("normalizes and prunes conversations and messages", () => {
    const state = ensureCoachConversationsState({
      version: 1,
      conversations: Array.from({ length: 24 }, (_, index) => ({
        id: `conv_${index}`,
        createdAt: `2026-03-${String((index % 9) + 1).padStart(2, "0")}T09:00:00.000Z`,
        updatedAt: `2026-03-${String((index % 9) + 1).padStart(2, "0")}T10:00:00.000Z`,
        messages: Array.from({ length: 55 }, (_, messageIndex) => ({
          role: messageIndex % 2 === 0 ? "user" : "assistant",
          text: `Message ${index}-${messageIndex}`,
          createdAt: `2026-03-${String((index % 9) + 1).padStart(2, "0")}T10:${String(messageIndex).padStart(2, "0")}:00.000Z`,
        })),
      })),
    });

    expect(state.version).toBe(1);
    expect(state.conversations).toHaveLength(20);
    expect(state.conversations[0].messages).toHaveLength(50);
  });

  it("creates a conversation on first append and trims recent messages to 6", () => {
    const created = buildCoachConversationMessage("user", "Je dois clarifier ma semaine");
    const firstResult = appendCoachConversationMessages(null, {
      messages: [created],
      contextSnapshot: { activeCategoryId: "cat_work", dateKey: "2026-03-25" },
    });

    expect(firstResult.conversation.id).toBeTruthy();
    expect(firstResult.conversation.contextSnapshot).toEqual({
      activeCategoryId: "cat_work",
      dateKey: "2026-03-25",
    });

    let state = firstResult.state;
    let conversation = firstResult.conversation;
    for (let index = 0; index < 7; index += 1) {
      const nextResult = appendCoachConversationMessages(state, {
        conversationId: conversation.id,
        messages: [buildCoachConversationMessage(index % 2 === 0 ? "assistant" : "user", `Entrée ${index}`)],
        contextSnapshot: { activeCategoryId: "cat_work", dateKey: "2026-03-25" },
      });
      state = nextResult.state;
      conversation = nextResult.conversation;
    }

    const recent = buildRecentMessagesFromConversation(conversation);
    expect(recent).toHaveLength(6);
    expect(recent[0].content).toBe("Entrée 1");
    expect(recent[5].content).toBe("Entrée 6");
  });

  it("builds a compact persisted assistant transcript", () => {
    expect(
      buildAssistantTranscriptText({
        headline: "Planifie une marche",
        reason: "Pose 20 min aujourd’hui pour retrouver de l’énergie.",
      })
    ).toBe("Planifie une marche\nPose 20 min aujourd’hui pour retrouver de l’énergie.");
  });

  it("injects coach conversations into migrated user data when missing", () => {
    const migrated = migrate({
      categories: [],
      goals: [],
      occurrences: [],
      ui: {},
    });

    expect(migrated.coach_conversations_v1).toEqual({
      version: 1,
      conversations: [],
    });
  });

  it("preserves an empty explicit conversation created by the user", () => {
    const conversation = createCoachConversation({
      contextSnapshot: { activeCategoryId: "cat_health", dateKey: "2026-03-25" },
      now: new Date("2026-03-25T10:00:00.000Z"),
    });
    const state = ensureCoachConversationsState({
      version: 1,
      conversations: [conversation],
    });

    expect(state.conversations[0]).toMatchObject({
      id: conversation.id,
      messages: [],
      contextSnapshot: {
        activeCategoryId: "cat_health",
        dateKey: "2026-03-25",
      },
    });
  });
});
