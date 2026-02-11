import { describe, expect, it } from "vitest";
import { computeDiff, createDraftStore } from "./draftStore";
import { onBeforeLeaveScope } from "./draftGuards";

describe("draftStore", () => {
  it("begin/patch/commit/cancel tracks dirty/touched", () => {
    const store = createDraftStore();
    store.beginDraft("category:cat_1", { name: "Business", whyText: "Start" }, { risk: "medium" });

    let draft = store.getDraft("category:cat_1");
    expect(draft?.dirty).toBe(false);
    expect(draft?.touched).toBe(false);

    store.patchDraft("category:cat_1", { name: "Business Pro" });
    draft = store.getDraft("category:cat_1");
    expect(draft?.dirty).toBe(true);
    expect(draft?.touched).toBe(true);
    expect(draft?.working?.name).toBe("Business Pro");

    const commit = store.commitDraft("category:cat_1", { clear: false });
    expect(commit?.diff?.changed).toBe(true);
    expect(commit?.diff?.patch).toEqual({ name: "Business Pro" });

    draft = store.getDraft("category:cat_1");
    expect(draft?.dirty).toBe(false);
    expect(draft?.touched).toBe(false);
    expect(typeof draft?.lastCommittedAt).toBe("number");

    store.patchDraft("category:cat_1", { whyText: "Updated" });
    draft = store.getDraft("category:cat_1");
    expect(draft?.dirty).toBe(true);

    store.cancelDraft("category:cat_1", { clear: false });
    draft = store.getDraft("category:cat_1");
    expect(draft?.dirty).toBe(false);
    expect(draft?.working?.whyText).toBe("Start");
  });

  it("supports multiple scopes in parallel", () => {
    const store = createDraftStore();
    store.beginDraft("category:one", { name: "A" });
    store.beginDraft("goal:one", { title: "Goal A" });
    store.patchDraft("category:one", { name: "AA" });
    store.patchDraft("goal:one", { title: "Goal AA" });

    expect(store.getDraft("category:one")?.working?.name).toBe("AA");
    expect(store.getDraft("goal:one")?.working?.title).toBe("Goal AA");
    expect(store.listDrafts().length).toBe(2);
  });

  it("computeDiff supports known paths", () => {
    const diff = computeDiff(
      { profile: { name: "A", city: "Paris" }, title: "Old" },
      { profile: { name: "B", city: "Paris" }, title: "New" },
      ["profile.name", "title"]
    );
    expect(diff.changed).toBe(true);
    expect(diff.changedPaths).toEqual(["profile.name", "title"]);
    expect(diff.patch).toEqual({ profile: { name: "B" }, title: "New" });
  });
});

describe("draftGuards", () => {
  it("medium risk commits valid draft on leave", () => {
    const store = createDraftStore();
    store.beginDraft("category:cat_1", { name: "Business" }, { risk: "medium" });
    store.patchDraft("category:cat_1", { name: "Business+" });

    let committedPatch = null;
    const result = onBeforeLeaveScope({
      store,
      scopeKey: "category:cat_1",
      risk: "medium",
      validate: (working) => String(working?.name || "").trim().length > 0,
      onCommit: (commit) => {
        committedPatch = commit.diff.patch;
      },
    });

    expect(result.action).toBe("commit");
    expect(committedPatch).toEqual({ name: "Business+" });
    expect(store.getDraft("category:cat_1")).toBeNull();
  });

  it("high risk can block leave when user stays", () => {
    const store = createDraftStore();
    store.beginDraft("action:goal_1", { title: "Action" }, { risk: "high" });
    store.patchDraft("action:goal_1", { title: "Action+" });

    const result = onBeforeLeaveScope({
      store,
      scopeKey: "action:goal_1",
      risk: "high",
      confirmLeave: () => "stay",
    });

    expect(result.blocked).toBe(true);
    expect(store.getDraft("action:goal_1")?.dirty).toBe(true);
  });
});

