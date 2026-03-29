import { describe, expect, it, vi } from "vitest";
import { dispatchOpenCreateTask } from "./useCreateFlowOrchestration";

describe("dispatchOpenCreateTask", () => {
  it("opens create-item for a simple action without throwing", () => {
    const resolvePreferredCategoryId = vi.fn(() => "cat-action");
    const seedCreateDraft = vi.fn();
    const onCreateTaskOpen = vi.fn();
    const setTab = vi.fn();
    const setPlusOpen = vi.fn();

    const result = dispatchOpenCreateTask({
      request: { source: "today", kind: "action" },
      tab: "today",
      librarySelectedCategoryId: null,
      resolvePreferredCategoryId,
      seedCreateDraft,
      onCreateTaskOpen,
      setTab,
      setPlusOpen,
    });

    expect(result.resolvedCategoryId).toBe("cat-action");
    expect(result.normalizedProposal).toBeNull();
    expect(setPlusOpen).toHaveBeenCalledWith(false);
    expect(seedCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "today",
        categoryId: "cat-action",
        kind: "action",
        preserveDraft: false,
        proposal: null,
        origin: expect.objectContaining({
          mainTab: "today",
          sourceSurface: "today",
          categoryId: "cat-action",
        }),
      })
    );
    expect(onCreateTaskOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "action",
        proposal: null,
        origin: expect.objectContaining({
          mainTab: "today",
          sourceSurface: "today",
          categoryId: "cat-action",
        }),
      })
    );
    expect(setTab).toHaveBeenCalledWith(
      "create-item",
      expect.objectContaining({
        historyState: expect.objectContaining({
          task: "create-item",
          createKind: "action",
          origin: expect.objectContaining({
            mainTab: "today",
            sourceSurface: "today",
            categoryId: "cat-action",
          }),
        }),
      })
    );
  });

  it("opens create-item for an outcome from library category context", () => {
    const setTab = vi.fn();
    const onCreateTaskOpen = vi.fn();
    const seedCreateDraft = vi.fn();

    const result = dispatchOpenCreateTask({
      request: { source: "category-detail", categoryId: "cat-library", kind: "outcome" },
      tab: "category-detail",
      librarySelectedCategoryId: "cat-library",
      resolvePreferredCategoryId: vi.fn(({ categoryId }) => categoryId),
      seedCreateDraft,
      onCreateTaskOpen,
      setTab,
      setPlusOpen: vi.fn(),
    });

    expect(result.nextOrigin).toEqual(
      expect.objectContaining({
        mainTab: "library",
        sourceSurface: "category-detail",
        categoryId: "cat-library",
        libraryMode: "category-view",
      })
    );
    expect(onCreateTaskOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "outcome",
        origin: expect.objectContaining({
          mainTab: "library",
          sourceSurface: "category-detail",
          categoryId: "cat-library",
          libraryMode: "category-view",
        }),
      })
    );
    expect(setTab).toHaveBeenCalledWith(
      "create-item",
      expect.objectContaining({
        historyState: expect.objectContaining({
          createKind: "outcome",
        }),
      })
    );
  });

  it("normalizes assistant proposals before opening create-item", () => {
    const proposal = {
      kind: "assistant",
      categoryDraft: { mode: "existing", id: "cat-assistant" },
      actionDrafts: [{ title: "Planifier la semaine", repeat: "weekly", daysOfWeek: [1, 3] }],
      unresolvedQuestions: ["Quel créneau ?"],
    };
    const seedCreateDraft = vi.fn();
    const onCreateTaskOpen = vi.fn();

    const result = dispatchOpenCreateTask({
      request: {
        source: "planning",
        kind: "assistant",
        categoryId: "cat-assistant",
        proposal,
      },
      tab: "planning",
      librarySelectedCategoryId: null,
      resolvePreferredCategoryId: vi.fn(({ categoryId }) => categoryId),
      seedCreateDraft,
      onCreateTaskOpen,
      setTab: vi.fn(),
      setPlusOpen: vi.fn(),
    });

    expect(result.normalizedProposal).toEqual(
      expect.objectContaining({
        kind: "assistant",
        requiresValidation: true,
        sourceContext: expect.objectContaining({
          mainTab: "planning",
          sourceSurface: "planning",
          categoryId: "cat-assistant",
        }),
        actionDrafts: [
          expect.objectContaining({
            title: "Planifier la semaine",
            categoryId: "cat-assistant",
          }),
        ],
      })
    );
    expect(seedCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "assistant",
        proposal: result.normalizedProposal,
      })
    );
    expect(onCreateTaskOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "assistant",
        proposal: result.normalizedProposal,
      })
    );
  });

  it("supports resume without throwing and preserves the existing draft intent", () => {
    const origin = {
      mainTab: "today",
      sourceSurface: "today",
      categoryId: "cat-resume",
      dateKey: "2026-03-29",
    };
    const setTab = vi.fn();

    dispatchOpenCreateTask({
      request: {
        source: "resume-draft",
        categoryId: "cat-resume",
        outcomeId: "goal-1",
        kind: "action",
        preserveDraft: true,
        origin,
      },
      tab: "today",
      librarySelectedCategoryId: null,
      resolvePreferredCategoryId: vi.fn(({ categoryId }) => categoryId),
      seedCreateDraft: vi.fn(),
      onCreateTaskOpen: vi.fn(),
      setTab,
      setPlusOpen: vi.fn(),
    });

    expect(setTab).toHaveBeenCalledWith(
      "create-item",
      expect.objectContaining({
        historyState: expect.objectContaining({
          createKind: "action",
          origin: expect.objectContaining({
            mainTab: "today",
            sourceSurface: "today",
            categoryId: "cat-resume",
            dateKey: "2026-03-29",
          }),
        }),
      })
    );
  });
});
