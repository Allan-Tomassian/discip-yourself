import test from "node:test";
import assert from "node:assert/strict";
import { detectCoachBehavior } from "../src/services/coach/coachBehavior.js";

const TRUTH_TABLE = [
  {
    message: "Bonjour",
    expected: {
      mode: "normal",
      overlays: [],
      horizon: "now",
      intensity: "soft",
    },
  },
  {
    message: "J’ai du mal à me concentrer aujourd’hui",
    expected: {
      mode: "action",
      overlays: [],
      horizon: "today",
      intensity: "standard",
    },
  },
  {
    message: "Aide-moi à organiser mes deux prochains jours",
    expected: {
      mode: "clarity",
      overlays: ["plan_builder"],
      horizon: "short_plan",
      intensity: "standard",
    },
  },
  {
    message: "Je suis épuisé, je n’en peux plus",
    expected: {
      mode: "reset",
      overlays: [],
      horizon: "now",
      intensity: "soft",
    },
  },
  {
    message: "Dis-moi franchement ce qui ne va pas dans ma routine",
    expected: {
      mode: "clarity",
      overlays: ["honest_audit"],
      horizon: "pattern",
      intensity: "direct",
    },
  },
  {
    message: "Je veux faire une activité mais je ne sais pas laquelle",
    expected: {
      mode: "clarity",
      overlays: ["choice_narrowing"],
      horizon: "now",
      intensity: "standard",
    },
  },
];

for (const entry of TRUTH_TABLE) {
  test(`detectCoachBehavior truth table: ${entry.message}`, () => {
    assert.deepEqual(
      detectCoachBehavior({
        message: entry.message,
        recentMessages: [],
      }),
      entry.expected,
    );
  });
}

test("detectCoachBehavior uses the latest previous user message only for short or ambiguous follow-ups", () => {
  const behavior = detectCoachBehavior({
    message: "Et demain",
    recentMessages: [
      { role: "assistant", content: "Tu veux plutôt clarifier ou agir ?" },
      { role: "user", content: "Aide-moi à organiser mes deux prochains jours" },
    ],
  });

  assert.deepEqual(behavior, {
    mode: "clarity",
    overlays: ["plan_builder"],
    horizon: "short_plan",
    intensity: "standard",
  });
});
