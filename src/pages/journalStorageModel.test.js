import { describe, expect, it } from "vitest";
import { buildJournalStorageModel, clearJournalStorageForUser } from "./journalStorageModel";

function createStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    get length() {
      return entries.size;
    },
    key(index) {
      return Array.from(entries.keys())[index] || null;
    },
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    removeItem(key) {
      entries.delete(key);
    },
    has(key) {
      return entries.has(key);
    },
  };
}

describe("journal storage model", () => {
  it("scopes note keys by authenticated user id", () => {
    expect(
      buildJournalStorageModel({
        userId: "account-a",
        categoryId: "cat-1",
        dateKey: "2026-06-01",
      })
    ).toMatchObject({
      noteStorageKey: "dailyNote:user:account-a:cat-1:2026-06-01",
      noteMetaStorageKey: "dailyNoteMeta:user:account-a:cat-1:2026-06-01",
      noteHistoryStorageKey: "dailyNoteHistory:user:account-a:cat-1",
    });
  });

  it("clears only the selected user's journal keys", () => {
    const storage = createStorage({
      "dailyNote:user:account-a:cat-1:2026-06-01": "A",
      "dailyNoteMeta:user:account-a:cat-1:2026-06-01": "{}",
      "dailyNoteHistory:user:account-a:cat-1": "[]",
      "dailyNote:user:account-b:cat-1:2026-06-01": "B",
    });

    const removed = clearJournalStorageForUser({ userId: "account-a", localStorageRef: storage });

    expect(removed).toEqual(
      expect.arrayContaining([
        "dailyNote:user:account-a:cat-1:2026-06-01",
        "dailyNoteMeta:user:account-a:cat-1:2026-06-01",
        "dailyNoteHistory:user:account-a:cat-1",
      ])
    );
    expect(storage.has("dailyNote:user:account-a:cat-1:2026-06-01")).toBe(false);
    expect(storage.has("dailyNote:user:account-b:cat-1:2026-06-01")).toBe(true);
  });
});
