let rewardedAdPresenter = null;

export function setRewardedAdPresenter(presenter) {
  rewardedAdPresenter = typeof presenter === "function" ? presenter : null;
  return () => {
    if (rewardedAdPresenter === presenter) rewardedAdPresenter = null;
  };
}

export async function showRewardedAd({ placement = "default" } = {}) {
  if (typeof rewardedAdPresenter !== "function") {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const result = await rewardedAdPresenter({ placement });
    if (result?.ok) return { ok: true };
    const reason = result?.reason === "unavailable" ? "unavailable" : "dismissed";
    return { ok: false, reason };
  } catch {
    return { ok: false, reason: "dismissed" };
  }
}
