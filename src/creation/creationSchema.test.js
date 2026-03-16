import { describe, expect, it } from "vitest";
import {
  CREATION_FLOW_HABIT,
  CREATION_FLOW_HABIT_UX_V2,
  STEP_HABIT_EXPECTATION,
  STEP_HABIT_TYPE,
} from "./creationSchema";

describe("creationSchema", () => {
  it("uses the UX v2 action flow as the default habit flow", () => {
    expect(CREATION_FLOW_HABIT).toEqual(CREATION_FLOW_HABIT_UX_V2);
    expect(CREATION_FLOW_HABIT[0]).toBe(STEP_HABIT_TYPE);
    expect(CREATION_FLOW_HABIT[1]).toBe(STEP_HABIT_EXPECTATION);
  });
});
