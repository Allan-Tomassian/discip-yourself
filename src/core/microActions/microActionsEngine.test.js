import { describe, expect, it } from "vitest";
import { getMicroActionsForToday } from "./microActionsEngine";

const LIB = [
  { id: "clarA", title: "Clarify A", durationMin: 2, categoryId: "business", intent: "prep", tags: ["clarify"] },
  { id: "prepA", title: "Prep A", durationMin: 2, categoryId: "business", intent: "prep", tags: ["prep"] },
  { id: "execA", title: "Exec A", durationMin: 3, categoryId: "business", intent: "execute", tags: ["exec"] },
  { id: "genPrep", title: "Gen Prep", durationMin: 3, categoryId: "general", intent: "prep", tags: ["prep"] },
  { id: "genExec", title: "Gen Exec", durationMin: 3, categoryId: "general", intent: "execute", tags: ["exec"] },
];

describe("getMicroActionsForToday", () => {
  it("keeps a stable set within the same 30-min bucket", () => {
    const ctx = {
      categoryId: "suggest_business",
      hourNow: 9,
      nowMs: 1_000,
      library: LIB,
    };
    const listA = getMicroActionsForToday(ctx, 3).map((item) => item.id);
    const listB = getMicroActionsForToday({ ...ctx, nowMs: 10 * 60 * 1000 }, 3).map((item) => item.id);
    expect(listB).toEqual(listA);
  });

  it("selects clarity, prep, then execute for a business category", () => {
    const list = getMicroActionsForToday(
      {
        categoryId: "business",
        hourNow: 9,
        nowMs: 1_000,
        library: LIB,
      },
      3
    );
    const ids = list.map((item) => item.id);
    expect(ids).toContain("clarA");
    expect(ids).toContain("prepA");
    expect(ids).toContain("execA");
  });

  it("falls back to general when category is unknown", () => {
    const list = getMicroActionsForToday(
      {
        categoryId: "unknown",
        hourNow: 9,
        nowMs: 1_000,
        library: LIB,
      },
      2
    );
    expect(list.map((item) => item.id)).toEqual(["genPrep", "genExec"]);
  });

  it("avoids seen ids from the last 24h", () => {
    const list = getMicroActionsForToday(
      {
        categoryId: "suggest_business",
        hourNow: 9,
        nowMs: 1_000,
        seenIds: ["execA"],
        library: LIB,
      },
      3
    );
    expect(list.map((item) => item.id)).not.toContain("execA");
  });
});
