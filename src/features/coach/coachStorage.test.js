import { describe, expect, it } from "vitest";
import {
  appendCoachConversationMessages,
  removeCoachConversation,
  upsertCoachConversation,
} from "./coachStorage";

describe("coachStorage", () => {
  it("removes a persisted conversation without changing the storage shape", () => {
    const baseState = upsertCoachConversation(null, {
      id: "conv_1",
      createdAt: "2026-03-26T09:00:00.000Z",
      updatedAt: "2026-03-26T09:00:00.000Z",
      messages: [{ role: "user", text: "Bonjour", createdAt: "2026-03-26T09:00:00.000Z" }],
      contextSnapshot: { activeCategoryId: "cat_1", dateKey: "2026-03-26" },
    });

    const nextState = removeCoachConversation(baseState, "conv_1");

    expect(nextState.version).toBe(1);
    expect(nextState.conversations).toEqual([]);
  });

  it("keeps the latest messages capped when appending to a conversation", () => {
    const messages = Array.from({ length: 60 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      text: `message ${index}`,
      createdAt: `2026-03-26T09:${String(index).padStart(2, "0")}:00.000Z`,
    }));

    const result = appendCoachConversationMessages(null, {
      messages,
      contextSnapshot: { activeCategoryId: "cat_1", dateKey: "2026-03-26" },
    });

    expect(result.conversation.messages).toHaveLength(50);
    expect(result.state.conversations[0].messages[0].text).toBe("message 10");
  });
});
