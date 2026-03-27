import { describe, expect, it } from "vitest";
import { nextTypingSlice, shouldBypassTyping } from "./useTypingReveal";

describe("useTypingReveal helpers", () => {
  it("reveals text progressively by step", () => {
    expect(nextTypingSlice("Coach", 0, 2)).toBe("Co");
    expect(nextTypingSlice("Coach", 2, 2)).toBe("Coac");
    expect(nextTypingSlice("Coach", 20, 2)).toBe("Coach");
  });

  it("bypasses typing when disabled or reduced motion is enabled", () => {
    expect(shouldBypassTyping({ enabled: false, prefersReducedMotion: false, text: "Coach" })).toBe(true);
    expect(shouldBypassTyping({ enabled: true, prefersReducedMotion: true, text: "Coach" })).toBe(true);
    expect(shouldBypassTyping({ enabled: true, prefersReducedMotion: false, text: "" })).toBe(true);
    expect(shouldBypassTyping({ enabled: true, prefersReducedMotion: false, text: "Coach" })).toBe(false);
  });
});
