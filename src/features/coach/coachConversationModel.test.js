import { describe, expect, it } from "vitest";
import {
  deriveCoachMessageEntries,
  resolveCoachMessageDisplayText,
} from "./coachConversationModel.js";

describe("coach conversation model", () => {
  it("uses message.text first", () => {
    expect(resolveCoachMessageDisplayText({ text: " Clarifier mon prochain bloc " })).toBe(
      "Clarifier mon prochain bloc"
    );
  });

  it("falls back to coachReply.message", () => {
    expect(
      resolveCoachMessageDisplayText({
        coachReply: { message: "Je peux t'aider à structurer ta journée." },
      })
    ).toBe("Je peux t'aider à structurer ta journée.");
  });

  it("falls back to legacy reply.message", () => {
    expect(
      resolveCoachMessageDisplayText({
        reply: { message: "Commence par verrouiller ton prochain pas." },
      })
    ).toBe("Commence par verrouiller ton prochain pas.");
  });

  it("falls back to legacy message and content", () => {
    expect(resolveCoachMessageDisplayText({ message: "Ancien message." })).toBe("Ancien message.");
    expect(
      resolveCoachMessageDisplayText({
        content: [{ text: "Premier bloc" }, { content: "Second bloc" }],
      })
    ).toBe("Premier bloc Second bloc");
  });

  it("uses headline and reason only as a short last resort", () => {
    const result = resolveCoachMessageDisplayText({
      reply: {
        headline: "Clarifier le bloc de lancement",
        reason:
          "Réduis la journée à un livrable concret et enlève le reste pour protéger l'exécution aujourd'hui.",
      },
    });

    expect(result).toContain("Clarifier le bloc de lancement");
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it("does not replace a real text with headline or reason", () => {
    expect(
      resolveCoachMessageDisplayText({
        text: "Texte réel",
        reply: {
          headline: "Headline",
          reason: "Reason",
        },
      })
    ).toBe("Texte réel");
  });

  it("derives displayText and reply for entries", () => {
    expect(
      deriveCoachMessageEntries({
        id: "conv_1",
        messages: [
          {
            role: "assistant",
            text: "Aide-moi à choisir le prochain pas.",
            createdAt: "2026-04-07T10:00:00.000Z",
            coachReply: {
              kind: "conversation",
              message: "Aide-moi à choisir le prochain pas.",
            },
          },
        ],
      })
    ).toEqual([
      expect.objectContaining({
        id: "2026-04-07T10:00:00.000Z",
        role: "assistant",
        text: "Aide-moi à choisir le prochain pas.",
        displayText: "Aide-moi à choisir le prochain pas.",
        reply: expect.objectContaining({
          kind: "conversation",
          message: "Aide-moi à choisir le prochain pas.",
        }),
      }),
    ]);
  });
});
