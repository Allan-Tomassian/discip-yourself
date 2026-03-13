import { describe, expect, it } from "vitest";
import { LABELS } from "./labels";

describe("LABELS", () => {
  it("uses action-first wording for advanced goals", () => {
    expect(LABELS.goal).toBe("Objectif");
    expect(LABELS.goals).toBe("Objectifs");
    expect(LABELS.action).toBe("Action");
    expect(LABELS.actions).toBe("Actions");
  });
});
