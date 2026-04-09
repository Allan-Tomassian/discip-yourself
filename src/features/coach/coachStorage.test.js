import { describe, expect, it } from "vitest";
import {
  appendCoachConversationMessages,
  buildCoachConversationMessage,
  removeCoachConversation,
  updateCoachConversationMessage,
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

  it("persists coach reply metadata inside assistant messages", () => {
    const message = buildCoachConversationMessage(
      "assistant",
      "Je peux te proposer un plan simple.",
      "2026-03-26T09:00:00.000Z",
      {
        kind: "conversation",
        mode: "plan",
        message: "Je peux te proposer un plan simple.",
        proposal: {
          kind: "action",
          categoryDraft: { mode: "existing", id: "cat_1", label: "Focus" },
          actionDrafts: [{ title: "Bloquer 20 min", categoryId: "cat_1" }],
          primaryActionRef: { index: 0 },
          sessionBlueprintDraft: {
            protocolType: "deep_work",
            why: "avancer sur un levier concret",
            firstStep: "ouvre la première sous-partie précise",
            ifBlocked: "réduis le scope à un sous-livrable",
            successDefinition: "une avancée visible est produite",
            estimatedMinutes: 20,
          },
          unresolvedQuestions: [],
          requiresValidation: true,
        },
      }
    );

    const result = appendCoachConversationMessages(null, {
      messages: [message],
      contextSnapshot: { activeCategoryId: "cat_1", dateKey: "2026-03-26" },
      mode: "plan",
      planningState: {
        mode: "plan",
        entryPoint: "assistant_auto",
        intent: "contextual",
        autoActivation: "allowed",
      },
    });

    expect(result.state.conversations[0].mode).toBe("plan");
    expect(result.state.conversations[0].planningState).toEqual({
      mode: "plan",
      entryPoint: "assistant_auto",
      intent: "contextual",
      autoActivation: "allowed",
    });
    expect(result.state.conversations[0].messages[0].coachReply).toMatchObject({
      kind: "conversation",
      mode: "plan",
      proposal: {
        kind: "action",
        primaryActionRef: { index: 0 },
        sessionBlueprintDraft: {
          protocolType: "deep_work",
        },
      },
    });
  });

  it("updates a persisted assistant reply state in place", () => {
    const baseState = appendCoachConversationMessages(null, {
      messages: [
        buildCoachConversationMessage("assistant", "Plan prêt", "2026-03-26T09:00:00.000Z", {
          kind: "conversation",
          mode: "plan",
          message: "Plan prêt",
          proposal: {
            kind: "action",
            actionDrafts: [{ title: "Bloquer 20 min", categoryId: "cat_1" }],
            primaryActionRef: { index: 0 },
            unresolvedQuestions: [],
            requiresValidation: true,
          },
        }),
      ],
      contextSnapshot: { activeCategoryId: "cat_1", dateKey: "2026-03-26" },
      mode: "plan",
    }).state;

    const conversationId = baseState.conversations[0].id;
    const nextState = updateCoachConversationMessage(baseState, {
      conversationId,
      messageCreatedAt: "2026-03-26T09:00:00.000Z",
      update: (message) => ({
        ...message,
        coachReply: {
          ...message.coachReply,
          createStatus: "created",
          createMessage: "Créé dans l’app.",
        },
      }),
    });

    expect(nextState.conversations[0].messages[0].coachReply).toMatchObject({
      createStatus: "created",
      createMessage: "Créé dans l’app.",
    });
  });

  it("derives a planning state from legacy conversation mode for storage compatibility", () => {
    const state = upsertCoachConversation(null, {
      id: "conv_legacy",
      createdAt: "2026-03-26T09:00:00.000Z",
      updatedAt: "2026-03-26T09:00:00.000Z",
      messages: [],
      mode: "plan",
      contextSnapshot: { activeCategoryId: "cat_1", dateKey: "2026-03-26" },
    });

    expect(state.conversations[0].planningState).toEqual({
      mode: "plan",
      entryPoint: "requested_mode",
      intent: null,
      autoActivation: "allowed",
    });
  });

  it("persists canonical library view targets for created plans", () => {
    const message = buildCoachConversationMessage(
      "assistant",
      "Créé dans Sport.",
      "2026-03-26T09:00:00.000Z",
      {
        kind: "conversation",
        mode: "plan",
        message: "Créé dans Sport.",
        primaryAction: {
          intent: "open_created_view",
          label: "Voir",
          categoryId: "cat_sport",
          viewTarget: {
            type: "library-focus",
            categoryId: "cat_sport",
            section: "actions",
            outcomeId: "goal_1",
            actionIds: ["action_1"],
          },
        },
      }
    );

    const result = appendCoachConversationMessages(null, {
      messages: [message],
      contextSnapshot: { activeCategoryId: "cat_sport", dateKey: "2026-03-26" },
      mode: "plan",
    });

    expect(result.state.conversations[0].messages[0].coachReply?.primaryAction?.viewTarget).toEqual({
      type: "library-focus",
      categoryId: "cat_sport",
      section: "actions",
      outcomeId: "goal_1",
      actionIds: ["action_1"],
    });
  });

  it("normalizes legacy library-category targets into canonical library-focus targets", () => {
    const message = buildCoachConversationMessage(
      "assistant",
      "Créé dans Sport.",
      "2026-03-26T09:00:00.000Z",
      {
        kind: "conversation",
        mode: "plan",
        message: "Créé dans Sport.",
        primaryAction: {
          intent: "open_created_view",
          label: "Voir",
          categoryId: "cat_sport",
          viewTarget: {
            type: "library-category",
            categoryId: "cat_sport",
            focusSection: "objectives",
            outcomeId: "goal_1",
            actionIds: [],
          },
        },
      }
    );

    const result = appendCoachConversationMessages(null, {
      messages: [message],
      contextSnapshot: { activeCategoryId: "cat_sport", dateKey: "2026-03-26" },
      mode: "plan",
    });

    expect(result.state.conversations[0].messages[0].coachReply?.primaryAction?.viewTarget).toEqual({
      type: "library-focus",
      categoryId: "cat_sport",
      section: "objectives",
      outcomeId: "goal_1",
      actionIds: [],
    });
  });
});
