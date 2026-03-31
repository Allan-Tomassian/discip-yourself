import { describe, expect, it } from "vitest";
import { parseNavigationState } from "./useAppNavigation";

describe("useAppNavigation legacy coach alias", () => {
  it("maps /coach/chat to the origin main tab and opens the coach alias request", () => {
    expect(
      parseNavigationState("/coach/chat", "", {
        origin: {
          mainTab: "planning",
          coachConversationId: "conv_1",
        },
        coachMode: "plan",
      })
    ).toMatchObject({
      initialTab: "planning",
      initialCoachAliasRequest: {
        mainTab: "planning",
        mode: "plan",
        conversationId: "conv_1",
      },
    });
  });

  it("falls back to today when the legacy coach alias has no origin state", () => {
    expect(parseNavigationState("/coach/chat", "", null)).toMatchObject({
      initialTab: "today",
      initialCoachAliasRequest: {
        mainTab: "today",
        mode: "free",
        conversationId: null,
      },
    });
  });
});
