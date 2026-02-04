import { describe, it, expect } from "vitest";
import { canCreate } from "./categoryGate";
import { SYSTEM_INBOX_ID } from "./state";

const sys = { id: SYSTEM_INBOX_ID, name: "Général" };
const catA = { id: "cat_a", name: "Business" };

describe("canCreate", () => {
  it("returns false when no active category", () => {
    expect(canCreate({ activeCategoryId: null, categories: [sys] })).toBe(false);
  });

  it("allows System Inbox only when it is the only category", () => {
    expect(canCreate({ activeCategoryId: SYSTEM_INBOX_ID, categories: [sys] })).toBe(true);
    expect(canCreate({ activeCategoryId: SYSTEM_INBOX_ID, categories: [sys, catA] })).toBe(false);
  });

  it("allows non-system active category", () => {
    expect(canCreate({ activeCategoryId: "cat_a", categories: [sys, catA] })).toBe(true);
  });
});
