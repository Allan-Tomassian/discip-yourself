import { describe, expect, it } from "vitest";
import { getSafeBackTarget, normalizeTab, parseNavigationState } from "./useAppNavigation";

describe("navigation back safety", () => {
  it("normalizes supported main tab back targets", () => {
    expect(getSafeBackTarget({ currentTab: "account", lastMainTab: "timeline" })).toBe("timeline");
    expect(getSafeBackTarget({ currentTab: "data", lastMainTab: "coach" })).toBe("coach");
    expect(getSafeBackTarget({ currentTab: "privacy", lastMainTab: "objectives" })).toBe("objectives");
    expect(getSafeBackTarget({ currentTab: "support", lastMainTab: "adjust" })).toBe("adjust");
  });

  it("falls back to Today for direct secondary routes", () => {
    expect(getSafeBackTarget({ currentTab: "account" })).toBe("today");
    expect(getSafeBackTarget({ currentTab: "legal", lastMainTab: "legal" })).toBe("today");
    expect(getSafeBackTarget({ currentTab: "faq", lastMainTab: "unknown" })).toBe("today");
  });

  it("keeps canonical aliases compatible", () => {
    expect(normalizeTab("home")).toBe("today");
    expect(normalizeTab("planning")).toBe("timeline");
    expect(normalizeTab("subscription")).toBe("billing");
    expect(getSafeBackTarget({ currentTab: "data", lastMainTab: "planning" })).toBe("timeline");
  });

  it("uses browser history state for secondary return context but keeps direct entries on Today", () => {
    expect(parseNavigationState("/account", "", null).initialLastMainTab).toBe("today");
    expect(parseNavigationState("/account", "", { lastMainTab: "timeline" }).initialLastMainTab).toBe("timeline");
    expect(parseNavigationState("/objectives", "", null).initialLastMainTab).toBe("objectives");
  });
});
