import React, { useEffect, useMemo, useRef, useState } from "react";
import "../shared/ui/gate/gate-premium.css";

const REWARD_EVENT_TYPES = new Set(["micro_done", "ad_reward"]);

function formatCoins(value) {
  const safe = Math.max(0, Number(value) || 0);
  return new Intl.NumberFormat("fr-FR").format(safe);
}

function getLatestRewardEvent(lastEvents) {
  const list = Array.isArray(lastEvents) ? lastEvents : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const event = list[i];
    if (!event || typeof event !== "object") continue;
    const amount = Math.max(0, Number(event.amount) || 0);
    if (!amount) continue;
    if (!REWARD_EVENT_TYPES.has(String(event.type || ""))) continue;
    return {
      key: `${event.ts || 0}:${event.type || ""}:${amount}`,
      amount,
    };
  }
  return { key: "", amount: 0 };
}

export default function WalletBadge({
  balance = 0,
  lastEvents = [],
  onOpenWallet,
  size = "sm",
  showDelta = true,
  className = "",
  dataTestId = "wallet-badge",
  dataTourId = "",
  deltaAmount = 0,
  deltaKey = "",
}) {
  const initialSeenRef = useRef(false);
  const lastSeenKeyRef = useRef("");
  const [visibleDelta, setVisibleDelta] = useState(0);
  const [deltaVisible, setDeltaVisible] = useState(false);

  const safeBalanceLabel = useMemo(() => formatCoins(balance), [balance]);
  const rewardFromEvents = useMemo(() => getLatestRewardEvent(lastEvents), [lastEvents]);
  const derivedDeltaAmount = Math.max(0, Number(deltaAmount) || 0) || rewardFromEvents.amount;
  const derivedDeltaKey = String(deltaKey || rewardFromEvents.key || "");
  const normalizedSize = size === "md" ? "md" : "sm";
  const canOpenWallet = typeof onOpenWallet === "function";
  const rootClasses = [
    "WalletBadgeRoot",
    className,
  ].filter(Boolean).join(" ");
  const badgeClasses = [
    "WalletBadgeCard",
    "GateSurfacePremium",
    canOpenWallet ? "WalletBadgeInteractive GatePressable" : "",
    normalizedSize === "md" ? "WalletBadgeMd" : "WalletBadgeSm",
  ].filter(Boolean).join(" ");

  useEffect(() => {
    if (!showDelta || !derivedDeltaKey || !derivedDeltaAmount) return undefined;
    if (!initialSeenRef.current) {
      initialSeenRef.current = true;
      lastSeenKeyRef.current = derivedDeltaKey;
      return undefined;
    }
    if (lastSeenKeyRef.current === derivedDeltaKey) return undefined;
    lastSeenKeyRef.current = derivedDeltaKey;
    setVisibleDelta(derivedDeltaAmount);
    setDeltaVisible(true);
    const timeout = window.setTimeout(() => {
      setDeltaVisible(false);
    }, 840);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [showDelta, derivedDeltaAmount, derivedDeltaKey]);

  if (canOpenWallet) {
    return (
      <div className={rootClasses}>
        <button
          type="button"
          className={badgeClasses}
          onClick={onOpenWallet}
          aria-label="Ouvrir le portefeuille"
          data-testid={dataTestId}
          data-tour-id={dataTourId || undefined}
        >
          <span className="WalletBadgeEmoji" aria-hidden="true">🪙</span>
          <span className="WalletBadgeValue">{safeBalanceLabel}</span>
        </button>
        {showDelta && deltaVisible ? (
          <span className="WalletBadgeDelta" aria-live="polite">
            +{visibleDelta}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={rootClasses}>
      <div className={badgeClasses} aria-label="Solde coins" data-testid={dataTestId}>
        <span className="WalletBadgeEmoji" aria-hidden="true">🪙</span>
        <span className="WalletBadgeValue">{safeBalanceLabel}</span>
      </div>
      {showDelta && deltaVisible ? (
        <span className="WalletBadgeDelta" aria-live="polite">
          +{visibleDelta}
        </span>
      ) : null}
    </div>
  );
}
