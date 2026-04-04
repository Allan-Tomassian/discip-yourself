import React, { useEffect, useMemo, useRef, useState } from "react";
import MicroActionsCard from "../ui/today/MicroActionsCard";
import RewardedAdModal from "../ui/today/RewardedAdModal";
import {
  BASIC_MICRO_REROLL_LIMIT,
  completeMicroAction,
  ensureMicroActionsV1,
  getDefaultMicroCategoryId,
  rerollMicroActions,
} from "../logic/microActionsV1";
import { showRewardedAd, setRewardedAdPresenter } from "../logic/rewardedAds";
import {
  MICRO_ACTION_COINS_REWARD,
  REWARDED_AD_COINS_REWARD,
  addCoins,
  appendWalletEvent,
  applyAdReward,
  canWatchAd,
  ensureWallet,
} from "../logic/walletV1";
import { ensureTotemV1 } from "../logic/totemV1";
import { emitTotemEvent } from "../ui/totem/totemEvents";
import { getVisibleCategories } from "../domain/categoryVisibility";
import { todayLocalKey } from "../utils/dateKey";
import { AppScreen, SectionHeader } from "../shared/ui/app";

function normalizeMicroItemForCompare(item) {
  if (!item || typeof item !== "object") return null;
  return {
    id: typeof item.id === "string" ? item.id : "",
    title: typeof item.title === "string" ? item.title : "",
    subtitle: typeof item.subtitle === "string" ? item.subtitle : "",
    categoryId: typeof item.categoryId === "string" ? item.categoryId : "",
    status: typeof item.status === "string" ? item.status : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    doneAt: typeof item.doneAt === "string" ? item.doneAt : "",
    templateId: typeof item.templateId === "string" ? item.templateId : "",
    durationMin: Number.isFinite(item.durationMin) ? item.durationMin : 0,
  };
}

function isSameMicroActionsV1(a, b) {
  const left = a && typeof a === "object" ? a : {};
  const right = b && typeof b === "object" ? b : {};
  if ((left.dateKey || "") !== (right.dateKey || "")) return false;
  if ((left.categoryId || "") !== (right.categoryId || "")) return false;
  if (Number(left.rerollsUsed || 0) !== Number(right.rerollsUsed || 0)) return false;
  if (Number(left.rerollCredits || 0) !== Number(right.rerollCredits || 0)) return false;
  const leftItems = Array.isArray(left.items) ? left.items.map(normalizeMicroItemForCompare) : [];
  const rightItems = Array.isArray(right.items) ? right.items.map(normalizeMicroItemForCompare) : [];
  return JSON.stringify(leftItems) === JSON.stringify(rightItems);
}

function normalizeWalletEventForCompare(event) {
  const safe = event && typeof event === "object" ? event : {};
  return {
    ts: Number.isFinite(safe.ts) ? safe.ts : 0,
    type: typeof safe.type === "string" ? safe.type : "",
    amount: Number.isFinite(safe.amount) ? safe.amount : 0,
    meta: safe.meta && typeof safe.meta === "object" ? safe.meta : null,
  };
}

function isSameWalletV1(a, b) {
  const left = a && typeof a === "object" ? a : {};
  const right = b && typeof b === "object" ? b : {};
  if (Number(left.balance || 0) !== Number(right.balance || 0)) return false;
  if (Number(left.earnedToday || 0) !== Number(right.earnedToday || 0)) return false;
  if (Number(left.adsToday || 0) !== Number(right.adsToday || 0)) return false;
  if ((left.dateKey || "") !== (right.dateKey || "")) return false;
  const leftEvents = Array.isArray(left.lastEvents) ? left.lastEvents.map(normalizeWalletEventForCompare) : [];
  const rightEvents = Array.isArray(right.lastEvents) ? right.lastEvents.map(normalizeWalletEventForCompare) : [];
  return JSON.stringify(leftEvents) === JSON.stringify(rightEvents);
}

function isSameTotemV1(a, b) {
  return JSON.stringify(ensureTotemV1(a)) === JSON.stringify(ensureTotemV1(b));
}

export default function MicroActions({ data, setData, isPremiumPlan = false }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const todayKey = todayLocalKey();
  const rewardedAdResolverRef = useRef(null);
  const [microWatchAdLoading, setMicroWatchAdLoading] = useState(false);
  const [microRewardFeedback, setMicroRewardFeedback] = useState("");
  const [rewardedAdRequest, setRewardedAdRequest] = useState({ open: false, placement: "micro-reroll" });
  const microChecks = safeData.microChecks && typeof safeData.microChecks === "object" ? safeData.microChecks : {};
  const microDefaultCategoryId = useMemo(() => getDefaultMicroCategoryId(safeData), [safeData]);
  const microCategoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name || category.id,
      })),
    [categories]
  );
  const selectedCategoryId = useMemo(() => {
    const fromUi = typeof safeData?.ui?.microActionsV1?.categoryId === "string" ? safeData.ui.microActionsV1.categoryId : "";
    return fromUi || microDefaultCategoryId || categories[0]?.id || null;
  }, [categories, microDefaultCategoryId, safeData?.ui?.microActionsV1?.categoryId]);
  const microActionsV1 = useMemo(
    () => ensureMicroActionsV1(safeData, todayKey, selectedCategoryId),
    [safeData, selectedCategoryId, todayKey]
  );
  const microTodayBucket = microChecks?.[todayKey] && typeof microChecks[todayKey] === "object" ? microChecks[todayKey] : {};
  const microDoneToday = Math.min(3, Object.keys(microTodayBucket).length);
  const microWallet = useMemo(() => ensureWallet(safeData, { dateKey: todayKey }), [safeData, todayKey]);
  const microCanWatchAd = useMemo(
    () => (!isPremiumPlan ? canWatchAd(microWallet, { dateKey: todayKey }) : false),
    [isPremiumPlan, microWallet, todayKey]
  );
  const totemV1 = useMemo(() => ensureTotemV1(safeData?.ui?.totemV1), [safeData?.ui?.totemV1]);

  useEffect(() => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const fallbackCategory = (current => (
        current && typeof current.categoryId === "string" && current.categoryId
      ))(prevUi.microActionsV1) || getDefaultMicroCategoryId(prev);
      const ensured = ensureMicroActionsV1(prev, todayKey, fallbackCategory);
      const ensuredWallet = ensureWallet(prev, { dateKey: todayKey });
      const ensuredTotem = ensureTotemV1(prevUi.totemV1);
      if (
        isSameMicroActionsV1(prevUi.microActionsV1, ensured) &&
        isSameWalletV1(prevUi.walletV1, ensuredWallet) &&
        isSameTotemV1(prevUi.totemV1, ensuredTotem)
      ) {
        return prev;
      }
      return {
        ...prev,
        ui: {
          ...prevUi,
          microActionsV1: ensured,
          walletV1: ensuredWallet,
          totemV1: ensuredTotem,
        },
      };
    });
  }, [setData, todayKey]);

  useEffect(() => {
    const unregister = setRewardedAdPresenter(({ placement }) => {
      if (rewardedAdResolverRef.current) {
        return Promise.resolve({ ok: false, reason: "unavailable" });
      }
      return new Promise((resolve) => {
        rewardedAdResolverRef.current = resolve;
        setRewardedAdRequest({
          open: true,
          placement: typeof placement === "string" && placement ? placement : "micro-reroll",
        });
      });
    });

    return () => {
      unregister?.();
      if (rewardedAdResolverRef.current) {
        rewardedAdResolverRef.current({ ok: false, reason: "dismissed" });
        rewardedAdResolverRef.current = null;
      }
    };
  }, []);

  function handleMicroCategoryChange(nextCategoryId) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const targetCategory = (typeof nextCategoryId === "string" && nextCategoryId) || getDefaultMicroCategoryId(prev);
      const nextMicro = ensureMicroActionsV1(prev, todayKey, targetCategory, {
        resetItemsOnCategoryChange: true,
      });
      if (isSameMicroActionsV1(prevUi.microActionsV1, nextMicro)) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          microActionsV1: nextMicro,
        },
      };
    });
  }

  function handleMicroActionDone(slotIndex) {
    if (typeof setData !== "function") return;
    const eventTs = Date.now();
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const selectedCategory = (typeof prevUi?.microActionsV1?.categoryId === "string" && prevUi.microActionsV1.categoryId)
        || getDefaultMicroCategoryId(prev);
      const result = completeMicroAction(prev, slotIndex, {
        dateKey: todayKey,
        categoryId: selectedCategory,
      });
      if (!result.doneItem?.id) return prev;

      const prevMicroChecks = prev?.microChecks && typeof prev.microChecks === "object" ? prev.microChecks : {};
      const prevDay = prevMicroChecks?.[todayKey] && typeof prevMicroChecks[todayKey] === "object"
        ? prevMicroChecks[todayKey]
        : {};
      const alreadyDone = Boolean(prevDay[result.doneItem.id]);
      const nextMicroChecks = alreadyDone
        ? prevMicroChecks
        : {
            ...prevMicroChecks,
            [todayKey]: {
              ...prevDay,
              [result.doneItem.id]: true,
            },
          };
      const currentWallet = ensureWallet(prev, { dateKey: todayKey });
      const nextWallet = alreadyDone
        ? currentWallet
        : addCoins(
            currentWallet,
            MICRO_ACTION_COINS_REWARD,
            {
              type: "micro_done",
              meta: {
                microItemId: result.doneItem.id,
                categoryId: selectedCategory,
              },
            },
            { dateKey: todayKey }
          );
      const currentTotem = ensureTotemV1(prevUi.totemV1);
      const nextTotem = !alreadyDone && currentTotem.animationEnabled
        ? { ...currentTotem, lastAnimationAt: eventTs }
        : currentTotem;

      return {
        ...prev,
        ui: {
          ...prevUi,
          microActionsV1: result.microActions,
          walletV1: nextWallet,
          totemV1: nextTotem,
        },
        microChecks: nextMicroChecks,
      };
    });
    if (totemV1.animationEnabled) {
      emitTotemEvent({ type: "MICRO_DONE", payload: { target: "categoryRail" } });
    }
  }

  function handleMicroReroll(indices = [], options = {}) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const selectedCategory = (typeof prevUi?.microActionsV1?.categoryId === "string" && prevUi.microActionsV1.categoryId)
        || getDefaultMicroCategoryId(prev);
      const current = ensureMicroActionsV1(prev, todayKey, selectedCategory);
      const rerollCredits = Math.max(0, Number(current.rerollCredits) || 0);
      const wantsCredit = options?.useCredit === true;
      const limitReached = !isPremiumPlan && Number(current.rerollsUsed || 0) >= BASIC_MICRO_REROLL_LIMIT;
      const canUseCredit = !isPremiumPlan && limitReached && rerollCredits > 0;
      if (wantsCredit && !canUseCredit) return prev;
      if (!wantsCredit && limitReached) return prev;
      const result = rerollMicroActions(prev, indices, {
        dateKey: todayKey,
        categoryId: selectedCategory,
        incrementUsage: !wantsCredit,
      });
      if (!result.replacedCount) return prev;
      let nextMicro = result.microActions;
      let nextWallet = ensureWallet(prev, { dateKey: todayKey });
      if (wantsCredit && canUseCredit) {
        nextMicro = {
          ...nextMicro,
          rerollCredits: Math.max(0, rerollCredits - 1),
        };
        nextWallet = appendWalletEvent(
          nextWallet,
          {
            type: "spend_reroll",
            amount: 1,
            meta: { replacedCount: result.replacedCount },
          },
          { dateKey: todayKey }
        );
      }
      return {
        ...prev,
        ui: {
          ...prevUi,
          microActionsV1: nextMicro,
          walletV1: nextWallet,
        },
      };
    });
  }

  function resolveRewardedAd(result) {
    const resolver = rewardedAdResolverRef.current;
    rewardedAdResolverRef.current = null;
    setRewardedAdRequest({ open: false, placement: "micro-reroll" });
    resolver?.(result);
  }

  async function handleMicroWatchAd() {
    if (isPremiumPlan || !microCanWatchAd || microWatchAdLoading || typeof setData !== "function") return;
    setMicroWatchAdLoading(true);
    setMicroRewardFeedback("");
    try {
      const result = await showRewardedAd({ placement: "micro-reroll" });
      if (!result?.ok) {
        setMicroRewardFeedback(result?.reason === "unavailable" ? "Vidéo indisponible pour le moment." : "Vidéo fermée.");
        return;
      }

      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const selectedCategory = (typeof prevUi?.microActionsV1?.categoryId === "string" && prevUi.microActionsV1.categoryId)
          || getDefaultMicroCategoryId(prev);
        const currentMicro = ensureMicroActionsV1(prev, todayKey, selectedCategory);
        const currentWallet = ensureWallet(prev, { dateKey: todayKey });
        const rewarded = applyAdReward(currentWallet, {
          dateKey: todayKey,
          coins: REWARDED_AD_COINS_REWARD,
          meta: { placement: "micro-reroll" },
        });
        if (!rewarded.granted) return prev;
        const nextMicro = {
          ...currentMicro,
          rerollCredits: Math.max(0, Number(currentMicro.rerollCredits) || 0) + 1,
        };
        const currentTotem = ensureTotemV1(prevUi.totemV1);
        const nextTotem = currentTotem.animationEnabled
          ? { ...currentTotem, lastAnimationAt: Date.now() }
          : currentTotem;
        return {
          ...prev,
          ui: {
            ...prevUi,
            microActionsV1: nextMicro,
            walletV1: rewarded.wallet,
            totemV1: nextTotem,
          },
        };
      });
    } finally {
      setMicroWatchAdLoading(false);
    }
  }

  return (
    <AppScreen
      data={safeData}
      pageId="micro-actions"
      backgroundImage={safeData?.profile?.whyImage || ""}
      headerTitle="Micro-actions"
      headerSubtitle="Petites actions rapides pour relancer l’élan du jour."
    >
      <div className="mainPageStack microActionsPage">
        <section className="mainPageSection">
          <SectionHeader
            title="Micro-actions du jour"
            subtitle="Trois leviers courts pour relancer l’élan sans repasser par Today."
          />
          <div className="mainPageSectionBody">
            <MicroActionsCard
              categoryId={selectedCategoryId}
              categoryOptions={microCategoryOptions}
              items={microActionsV1.items}
              microDoneToday={microDoneToday}
              rerollsUsed={Math.max(0, Number(microActionsV1?.rerollsUsed) || 0)}
              rerollCredits={Math.max(0, Number(microActionsV1?.rerollCredits) || 0)}
              rerollLimit={isPremiumPlan ? Number.POSITIVE_INFINITY : BASIC_MICRO_REROLL_LIMIT}
              canWatchAd={microCanWatchAd}
              adLoading={microWatchAdLoading}
              adFeedback={microRewardFeedback}
              isPremiumPlan={isPremiumPlan}
              canValidate
              isMicroToday
              onCategoryChange={handleMicroCategoryChange}
              onDone={handleMicroActionDone}
              onReroll={(indices) => handleMicroReroll(indices, { useCredit: false })}
              onUseRerollCredit={(indices) => handleMicroReroll(indices, { useCredit: true })}
              onWatchAd={handleMicroWatchAd}
            />
          </div>
        </section>
      </div>
      <RewardedAdModal
        open={rewardedAdRequest.open}
        placement={rewardedAdRequest.placement}
        onDismiss={() => resolveRewardedAd({ ok: false, reason: "dismissed" })}
        onComplete={() => resolveRewardedAd({ ok: true })}
      />
    </AppScreen>
  );
}
