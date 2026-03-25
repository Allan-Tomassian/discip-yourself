import { describe, it, expect, vi, afterEach } from "vitest";
import { createDebouncedSave, createStateSignature, shouldSkipHydrationRemoteSave } from "./useUserData";

afterEach(() => {
  vi.useRealTimers();
});

describe("createDebouncedSave", () => {
  it("déclenche une seule sauvegarde avec la dernière valeur", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const saver = createDebouncedSave({ delayMs: 500, onSave, onError });

    saver.schedule({ value: 1 });
    vi.advanceTimersByTime(250);
    saver.schedule({ value: 2 });
    vi.advanceTimersByTime(499);
    expect(onSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await vi.runAllTimersAsync();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ value: 2 });
    expect(onError).not.toHaveBeenCalled();
  });

  it("envoie l'erreur au handler sans casser l'exécution", async () => {
    vi.useFakeTimers();
    const error = new Error("save failed");
    const onSave = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    const saver = createDebouncedSave({ delayMs: 300, onSave, onError });

    saver.schedule({ value: 3 });
    await vi.advanceTimersByTimeAsync(300);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe("hydration save guard", () => {
  it("skips only the exact hydrated snapshot", () => {
    const hydrated = { profile: { whyText: "Initial" } };
    const hydratedSignature = createStateSignature(hydrated);

    expect(
      shouldSkipHydrationRemoteSave({
        skipNextRemoteSave: true,
        hydratedSignature,
        nextSignature: hydratedSignature,
      })
    ).toBe(true);

    expect(
      shouldSkipHydrationRemoteSave({
        skipNextRemoteSave: true,
        hydratedSignature,
        nextSignature: createStateSignature({ profile: { whyText: "Modifié" } }),
      })
    ).toBe(false);
  });
});
