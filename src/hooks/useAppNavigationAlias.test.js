import { describe, expect, it } from "vitest";
import { parseNavigationState } from "./useAppNavigation";

describe("useAppNavigation legacy coach alias", () => {
  it("maps /coach/chat to the dedicated coach tab while preserving the origin request", () => {
    expect(
      parseNavigationState("/coach/chat", "", {
        origin: {
          mainTab: "planning",
          coachConversationId: "conv_1",
        },
        coachMode: "plan",
      })
    ).toMatchObject({
      initialTab: "coach",
      initialCoachAliasRequest: {
        mainTab: "timeline",
        mode: "plan",
        conversationId: "conv_1",
      },
    });
  });

  it("falls back to the dedicated coach tab when the legacy coach alias has no origin state", () => {
    expect(parseNavigationState("/coach/chat", "", null)).toMatchObject({
      initialTab: "coach",
      initialCoachAliasRequest: {
        mainTab: "coach",
        mode: "free",
        conversationId: null,
      },
    });
  });
});
