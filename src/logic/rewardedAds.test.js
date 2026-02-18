import { describe, expect, it } from "vitest";
import { setRewardedAdPresenter, showRewardedAd } from "./rewardedAds";

describe("rewardedAds", () => {
  it("returns unavailable when no presenter is registered", async () => {
    const unregister = setRewardedAdPresenter(null);
    unregister?.();
    const result = await showRewardedAd({ placement: "micro-reroll" });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("resolves with presenter result", async () => {
    const unregister = setRewardedAdPresenter(async ({ placement }) => {
      if (placement === "micro-reroll") return { ok: true };
      return { ok: false, reason: "dismissed" };
    });

    const result = await showRewardedAd({ placement: "micro-reroll" });
    unregister();

    expect(result).toEqual({ ok: true });
  });
});
