import { describe, expect, it, vi } from "vitest";
import { createHomeNavigationHandlers } from "./homeNavigation";

describe("createHomeNavigationHandlers", () => {
  it("ouvre la library detail existante", () => {
    const openLibraryDetail = vi.fn();
    const setTab = vi.fn();
    const handlers = createHomeNavigationHandlers({ openLibraryDetail, setTab });

    handlers.onOpenLibrary();

    expect(openLibraryDetail).toHaveBeenCalledTimes(1);
    expect(setTab).not.toHaveBeenCalled();
  });

  it("ouvre insights pour les intents backend", () => {
    const openLibraryDetail = vi.fn();
    const setTab = vi.fn();
    const handlers = createHomeNavigationHandlers({ openLibraryDetail, setTab });

    handlers.onOpenPilotage();

    expect(setTab).toHaveBeenCalledWith("insights");
    expect(openLibraryDetail).not.toHaveBeenCalled();
  });
});
