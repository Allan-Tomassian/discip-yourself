import { describe, expect, it } from "vitest";
import { createEmptyDraft, normalizeCreationDraft } from "./creationDraft";
import { STEP_HABIT_TYPE, STEP_OUTCOME } from "./creationSchema";

describe("creationDraft action-first defaults", () => {
  it("starts with habit type step for new drafts", () => {
    const draft = createEmptyDraft();
    expect(draft.step).toBe(STEP_HABIT_TYPE);
    expect(draft.mode).toBe("action");
    expect(draft.status).toBe("draft");
    expect(draft.uxV2).toBe(true);
  });

  it("falls back to habit type when step is invalid", () => {
    const draft = normalizeCreationDraft({ step: "unknown-step", habits: [] });
    expect(draft.step).toBe(STEP_HABIT_TYPE);
  });

  it("keeps explicit legacy outcome step for compatibility", () => {
    const draft = normalizeCreationDraft({ step: STEP_OUTCOME, outcomes: [] });
    expect(draft.step).toBe(STEP_OUTCOME);
  });

  it("normalizes flow metadata without adding a new persistence key", () => {
    const draft = normalizeCreationDraft({
      mode: "guided",
      status: "ready",
      sourceContext: { source: "today", trigger: "cta" },
      pendingFields: ["categoryId", "categoryId", "", "habitType"],
    });

    expect(draft.mode).toBe("guided");
    expect(draft.status).toBe("ready");
    expect(draft.sourceContext).toEqual({ source: "today", trigger: "cta" });
    expect(draft.pendingFields).toEqual(["categoryId", "habitType"]);
  });
});
