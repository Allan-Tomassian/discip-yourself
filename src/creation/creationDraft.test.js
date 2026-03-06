import { describe, expect, it } from "vitest";
import { createEmptyDraft, normalizeCreationDraft } from "./creationDraft";
import { STEP_HABIT_TYPE, STEP_OUTCOME } from "./creationSchema";

describe("creationDraft action-first defaults", () => {
  it("starts with habit type step for new drafts", () => {
    const draft = createEmptyDraft();
    expect(draft.step).toBe(STEP_HABIT_TYPE);
  });

  it("falls back to habit type when step is invalid", () => {
    const draft = normalizeCreationDraft({ step: "unknown-step", habits: [] });
    expect(draft.step).toBe(STEP_HABIT_TYPE);
  });

  it("keeps explicit legacy outcome step for compatibility", () => {
    const draft = normalizeCreationDraft({ step: STEP_OUTCOME, outcomes: [] });
    expect(draft.step).toBe(STEP_OUTCOME);
  });
});
