import { describe, expect, it } from "vitest";
import { resolveManualAiDisplayState } from "./displayState";

describe("resolveManualAiDisplayState", () => {
  it("returns local when no analysis is visible and no request is loading", () => {
    expect(resolveManualAiDisplayState()).toEqual({
      kind: "local",
      label: "Lecture locale",
      isAi: false,
    });
  });

  it("returns ai while a first manual analysis is loading", () => {
    expect(resolveManualAiDisplayState({ loading: true })).toEqual({
      kind: "ai",
      label: "Lecture du coach",
      isAi: true,
    });
  });

  it("returns ai_updated only after a same-context refresh", () => {
    expect(
      resolveManualAiDisplayState({
        visibleAnalysis: { savedAt: 1 },
        wasRefreshed: true,
      })
    ).toEqual({
      kind: "ai_updated",
      label: "Lecture mise à jour",
      isAi: true,
    });
  });
});
