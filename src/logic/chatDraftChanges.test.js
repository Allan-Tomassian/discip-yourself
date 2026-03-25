import { describe, expect, it } from "vitest";
import { applyChatDraftChanges } from "./chatDraftChanges";

describe("chatDraftChanges", () => {
  it("met a jour le titre d'une action sans modifier son planning", () => {
    const state = {
      categories: [{ id: "cat-1", name: "Sante", color: "#22C55E" }],
      goals: [
        {
          id: "goal-1",
          title: "Marcher 20 min",
          categoryId: "cat-1",
          type: "PROCESS",
          planType: "ACTION",
          status: "queued",
          repeat: "weekly",
          daysOfWeek: [1],
          startTime: "09:00",
          timeMode: "FIXED",
          timeSlots: ["09:00"],
          durationMinutes: 20,
          schedule: {
            timezone: "Europe/Paris",
            daysOfWeek: [1],
            timeSlots: ["09:00"],
            durationMinutes: 20,
            remindersEnabled: false,
          },
        },
      ],
      occurrences: [
        {
          id: "occ-1",
          goalId: "goal-1",
          date: "2026-03-25",
          start: "09:00",
          slotKey: "09:00",
          durationMinutes: 20,
          status: "planned",
        },
      ],
    };

    const result = applyChatDraftChanges(state, [
      {
        type: "update_action",
        actionId: "goal-1",
        title: "Marcher 30 min",
        categoryId: "cat-1",
      },
    ]);

    expect(result.appliedCount).toBe(1);
    expect(result.navigationTarget).toBe("library");
    expect(result.state.goals[0].title).toBe("Marcher 30 min");
    expect(result.state.goals[0].startTime).toBe("09:00");
    expect(result.state.occurrences[0].start).toBe("09:00");
  });
});
