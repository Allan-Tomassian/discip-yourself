import { describe, expect, it, vi } from "vitest";
import { isAiCoachChatResponse, requestAiCoachChat } from "./aiCoachChatClient";

function buildChatResponse(overrides = {}) {
  return {
    kind: "chat",
    decisionSource: "rules",
    headline: "Ajoute un bloc simple",
    reason: "Une action courte suffit pour remettre Today en mouvement.",
    primaryAction: {
      label: "Voir pilotage",
      intent: "open_pilotage",
      categoryId: "cat-1",
      actionId: "goal-1",
      occurrenceId: null,
      dateKey: "2026-03-25",
    },
    secondaryAction: null,
    suggestedDurationMin: 20,
    draftChanges: [],
    meta: {
      coachVersion: "v1",
      requestId: "req_123",
      selectedDateKey: "2026-03-25",
      activeCategoryId: "cat-1",
      quotaRemaining: 3,
      fallbackReason: "none",
      messagePreview: "Ajoute une action",
    },
    ...overrides,
  };
}

describe("aiCoachChatClient", () => {
  it("valide une reponse chat avec draftChanges", () => {
    expect(
      isAiCoachChatResponse(
        buildChatResponse({
          draftChanges: [
            {
              type: "create_action",
              title: "Marcher 20 min",
              categoryId: "cat-1",
              actionId: null,
              occurrenceId: null,
              repeat: "none",
              daysOfWeek: [],
              startTime: null,
              durationMin: 20,
              dateKey: "2026-03-25",
            },
          ],
        })
      )
    ).toBe(true);
  });

  it("rejette un draft change invalide", () => {
    expect(
      isAiCoachChatResponse(
        buildChatResponse({
          draftChanges: [
            {
              type: "schedule_action",
              title: null,
              categoryId: "cat-1",
              actionId: null,
              occurrenceId: null,
              repeat: null,
              daysOfWeek: [],
              startTime: null,
              durationMin: 20,
              dateKey: "2026-03-25",
            },
          ],
        })
      )
    ).toBe(false);
  });

  it("retourne un diagnostic offline quand le navigateur est vraiment hors ligne", async () => {
    vi.stubGlobal("window", {
      location: {
        origin: "http://192.168.1.183:5173",
        hostname: "192.168.1.183",
      },
    });
    vi.stubGlobal("navigator", { onLine: false });

    try {
      const fetchImpl = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

      const result = await requestAiCoachChat({
        accessToken: "token",
        baseUrl: "https://discip-yourself-backend.onrender.com",
        fetchImpl,
        payload: {
          selectedDateKey: "2026-03-25",
          activeCategoryId: "cat-1",
          message: "Ajoute une action",
          recentMessages: [],
        },
      });

      expect(result).toMatchObject({
        ok: false,
        errorCode: "NETWORK_ERROR",
        transportMeta: {
          frontendOrigin: "http://192.168.1.183:5173",
          backendBaseUrl: "https://discip-yourself-backend.onrender.com",
          online: false,
          probableCause: "offline",
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
