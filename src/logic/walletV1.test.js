import { describe, expect, it } from "vitest";
import {
  BASIC_REWARDED_ADS_DAILY_LIMIT,
  REWARDED_AD_COINS_REWARD,
  addCoins,
  applyAdReward,
  canWatchAd,
  ensureWallet,
  spendCoins,
} from "./walletV1";

function buildState(walletV1 = null) {
  return {
    ui: {
      walletV1,
    },
  };
}

describe("walletV1", () => {
  it("resets daily counters when date changes", () => {
    const wallet = ensureWallet(
      buildState({
        version: 1,
        balance: 120,
        earnedToday: 74,
        adsToday: 4,
        dateKey: "2026-02-18",
        lastEvents: [],
      }),
      { dateKey: "2026-02-19" }
    );

    expect(wallet.balance).toBe(120);
    expect(wallet.earnedToday).toBe(0);
    expect(wallet.adsToday).toBe(0);
    expect(wallet.dateKey).toBe("2026-02-19");
  });

  it("addCoins increments balance and logs event", () => {
    const wallet = addCoins(
      ensureWallet(buildState(), { dateKey: "2026-02-18" }),
      2,
      {
        type: "micro_done",
        meta: { microItemId: "m_1" },
      },
      { dateKey: "2026-02-18" }
    );

    expect(wallet.balance).toBe(2);
    expect(wallet.earnedToday).toBe(2);
    expect(wallet.lastEvents).toHaveLength(1);
    expect(wallet.lastEvents[0].type).toBe("micro_done");
    expect(wallet.lastEvents[0].amount).toBe(2);
  });

  it("canWatchAd returns false when daily ad cap is reached", () => {
    const wallet = ensureWallet(
      buildState({
        version: 1,
        balance: 0,
        earnedToday: 0,
        adsToday: BASIC_REWARDED_ADS_DAILY_LIMIT,
        dateKey: "2026-02-18",
        lastEvents: [],
      }),
      { dateKey: "2026-02-18" }
    );

    expect(canWatchAd(wallet, { dateKey: "2026-02-18" })).toBe(false);
  });

  it("applyAdReward grants coins and increments ad usage", () => {
    const base = ensureWallet(buildState(), { dateKey: "2026-02-18" });
    const rewarded = applyAdReward(base, {
      dateKey: "2026-02-18",
      coins: REWARDED_AD_COINS_REWARD,
      meta: { placement: "micro-reroll" },
    });

    expect(rewarded.granted).toBe(true);
    expect(rewarded.wallet.balance).toBe(REWARDED_AD_COINS_REWARD);
    expect(rewarded.wallet.earnedToday).toBe(REWARDED_AD_COINS_REWARD);
    expect(rewarded.wallet.adsToday).toBe(1);
    expect(rewarded.wallet.lastEvents.at(-1)?.type).toBe("ad_reward");
  });

  it("trims wallet event history to 50 entries", () => {
    let wallet = ensureWallet(buildState(), { dateKey: "2026-02-18" });
    for (let i = 0; i < 60; i += 1) {
      wallet = addCoins(wallet, 1, { type: "micro_done", meta: { i } }, { dateKey: "2026-02-18" });
    }
    expect(wallet.lastEvents).toHaveLength(50);
    expect(wallet.balance).toBe(60);
  });

  it("spendCoins decrements balance when enough coins exist", () => {
    const funded = addCoins(ensureWallet(buildState(), { dateKey: "2026-02-18" }), 100, { type: "ad_reward" }, { dateKey: "2026-02-18" });
    const result = spendCoins(
      funded,
      40,
      { type: "spend_shop", meta: { itemId: "cape" } },
      { dateKey: "2026-02-18" }
    );

    expect(result.spent).toBe(true);
    expect(result.wallet.balance).toBe(60);
    expect(result.wallet.lastEvents.at(-1)?.type).toBe("spend_shop");
    expect(result.wallet.lastEvents.at(-1)?.amount).toBe(40);
  });

  it("spendCoins is rejected when balance is insufficient", () => {
    const wallet = ensureWallet(buildState(), { dateKey: "2026-02-18" });
    const result = spendCoins(wallet, 10, { type: "spend_shop" }, { dateKey: "2026-02-18" });
    expect(result.spent).toBe(false);
    expect(result.wallet.balance).toBe(0);
  });
});
