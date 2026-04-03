import React, { useCallback, useEffect, useMemo, useState } from "react";
import { UI_COPY } from "../labels";
import {
  AppCard,
  AppSelect,
  FeedbackMessage,
  GhostButton,
  SecondaryButton,
} from "../../shared/ui/app";
import "../../features/today/today.css";

function normalizeItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) => item && typeof item === "object");
}

function normalizeOptions(options) {
  const list = Array.isArray(options) ? options : [];
  return list
    .map((option) => {
      const value = typeof option?.value === "string" ? option.value : "";
      if (!value) return null;
      return {
        value,
        label: typeof option?.label === "string" && option.label.trim() ? option.label.trim() : value,
      };
    })
    .filter(Boolean);
}

function formatRerollCounter({ isPremiumPlan, rerollsUsed, rerollLimit }) {
  if (isPremiumPlan) return "Premium: rerolls illimités";
  const used = Math.max(0, Number(rerollsUsed) || 0);
  const limit = Math.max(0, Number(rerollLimit) || 0);
  return `Basique: ${Math.min(used, limit)}/${limit} aujourd’hui`;
}

export default function MicroActionsCard({
  drag = false,
  setActivatorNodeRef,
  listeners,
  attributes,
  categoryId = "",
  categoryOptions = [],
  items = [],
  microDoneToday = 0,
  rerollsUsed = 0,
  rerollCredits = 0,
  rerollLimit = 3,
  canWatchAd = false,
  adLoading = false,
  adFeedback = "",
  isPremiumPlan = false,
  canValidate = false,
  isMicroToday = true,
  onCategoryChange,
  onDone,
  onReroll,
  onWatchAd,
  onUseRerollCredit,
  onGoToToday,
}) {
  const [selectedIndices, setSelectedIndices] = useState([]);
  const isReadOnlyDate = !isMicroToday;
  const safeItems = useMemo(() => normalizeItems(items), [items]);
  const safeOptions = useMemo(() => normalizeOptions(categoryOptions), [categoryOptions]);
  const usedRerolls = Math.max(0, Number(rerollsUsed) || 0);
  const safeCredits = Math.max(0, Number(rerollCredits) || 0);
  const safeLimit = Math.max(0, Number(rerollLimit) || 0);
  const rerollBlocked = !isPremiumPlan && usedRerolls >= safeLimit;
  const canReroll = canValidate && !rerollBlocked;
  const canUseCreditReroll = canValidate && !isPremiumPlan && rerollBlocked && safeCredits > 0;
  const canWatchRewardedAd = canValidate && !isPremiumPlan && rerollBlocked && safeCredits <= 0 && canWatchAd;

  useEffect(() => {
    setSelectedIndices((previous) => previous.filter((index) => index >= 0 && index < safeItems.length));
  }, [safeItems.length]);

  const selectedCategoryName = useMemo(() => {
    const hit = safeOptions.find((option) => option.value === categoryId);
    return hit?.label || "Général";
  }, [categoryId, safeOptions]);

  const rerollCounterLabel = useMemo(
    () => formatRerollCounter({ isPremiumPlan, rerollsUsed: usedRerolls, rerollLimit: safeLimit }),
    [isPremiumPlan, safeLimit, usedRerolls]
  );

  const toggleSlot = useCallback((index) => {
    setSelectedIndices((previous) => {
      if (previous.includes(index)) return previous.filter((item) => item !== index);
      return [...previous, index].sort((a, b) => a - b);
    });
  }, []);

  const handleReroll = useCallback(() => {
    if (!canReroll) return;
    onReroll?.(selectedIndices);
    setSelectedIndices([]);
  }, [canReroll, onReroll, selectedIndices]);

  const handleUseRerollCredit = useCallback(() => {
    if (!canUseCreditReroll) return;
    onUseRerollCredit?.(selectedIndices);
    setSelectedIndices([]);
  }, [canUseCreditReroll, onUseRerollCredit, selectedIndices]);

  return (
    <AppCard
      className={`microCard GateSurfacePremium GateCardPremium GateSecondarySectionCard${isReadOnlyDate ? " isReadOnlyDate" : ""}`}
      data-tour-id="today-micro-card"
    >
      <div className="microCardBody">
        <div className="microHeader">
          <div className="microHeaderMain">
            {drag ? (
              <button
                ref={setActivatorNodeRef}
                {...listeners}
                {...attributes}
                className="dragHandle"
                aria-label="Réorganiser"
              >
                ⋮⋮
              </button>
            ) : null}
            <div className="microHeaderText">
              <div className="GateRoleCardTitle">Pour {selectedCategoryName}</div>
              <div className="GateRoleCardMeta">3 actions rapides à valider ou reroll.</div>
            </div>
          </div>
          <div className="microHeaderStats">
            <span className="microDoneStat" aria-label="Micro-actions validées aujourd’hui">
              {microDoneToday}/3
            </span>
            <span className="microDoneMeta">{rerollCounterLabel}</span>
          </div>
        </div>

        <div className="microToolbar">
          <div className="microContext GateRoleCardMeta">Choisis la catégorie à nourrir maintenant.</div>
          <div className="GateSelectWrap microCategorySelectWrap">
            <AppSelect
              value={categoryId}
              className="GateSelectPremium microCategorySelect"
              onChange={(event) => onCategoryChange?.(event.target.value)}
              aria-label="Catégorie des micro-actions"
              disabled={isReadOnlyDate}
            >
              {safeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </div>
        </div>
        {isReadOnlyDate ? (
          <div className="microTodayHintRow GateInlineMetaCard" data-testid="micro-actions-today-hint">
            <span className="microTodayHintText">Micro-actions disponibles uniquement aujourd’hui.</span>
            <GhostButton
              size="sm"
              className="microGoTodayBtn"
              onClick={() => onGoToToday?.()}
              data-testid="micro-actions-go-today"
              aria-label="Revenir à aujourd’hui"
            >
              Revenir à aujourd’hui
            </GhostButton>
          </div>
        ) : null}

        <div className="microList">
          {safeItems.map((item, index) => {
            const isSelected = selectedIndices.includes(index);
            const isDone = item.status === "done";
            return (
              <div key={item.id || `${item.title}-${index}`} className="microItem GateInlineMetaCard" data-tour-id="today-micro-item">
                <label className="microPick" aria-label={`Sélectionner ${item.title} pour reroll`}>
                  <input
                    type="checkbox"
                    className="microPickInput"
                    checked={isSelected}
                    onChange={() => toggleSlot(index)}
                    disabled={!(canReroll || canUseCreditReroll)}
                    data-tour-id="today-micro-select"
                  />
                  <span className="microPickMark" aria-hidden="true">✓</span>
                </label>
                <div className="microItemMain">
                  <div className="microItemTitle GateRoleCardTitle">{item.title}</div>
                  {item.subtitle ? <div className="microItemSub GateRoleCardMeta">{item.subtitle}</div> : null}
                </div>
                <span className="microBadge">{item.durationMin || 2} min</span>
                <GhostButton
                  size="sm"
                  className="microActionBtn"
                  onClick={() => onDone?.(index)}
                  disabled={!canValidate || isDone}
                  aria-label={isDone ? "Déjà fait" : `${UI_COPY.done}: ${item.title}`}
                  data-tour-id="today-micro-done"
                  aria-disabled={!canValidate || isDone}
                >
                  {UI_COPY.done}
                </GhostButton>
              </div>
            );
          })}
        </div>

        <div className="microRerollRow">
          <SecondaryButton
            size="sm"
            className="microRerollBtn"
            onClick={handleReroll}
            disabled={!canReroll}
            aria-label="Reroll des micro-actions"
            data-tour-id="today-micro-toggle"
          >
            Reroll
          </SecondaryButton>
          {canUseCreditReroll ? (
            <GhostButton
              size="sm"
              className="microUseCreditBtn"
              onClick={handleUseRerollCredit}
              aria-label="Utiliser un crédit reroll"
              data-testid="micro-use-reroll-credit"
            >
              Utiliser 1 reroll
            </GhostButton>
          ) : null}
          {!isPremiumPlan && rerollBlocked && safeCredits <= 0 ? (
            <GhostButton
              size="sm"
              className="microWatchAdBtn"
              onClick={() => onWatchAd?.()}
              disabled={!canWatchRewardedAd || adLoading}
              aria-label="Regarder une vidéo pour débloquer un reroll"
              data-testid="micro-watch-ad"
              aria-disabled={!canWatchRewardedAd || adLoading}
            >
              {adLoading ? "Vidéo..." : UI_COPY.watchAd}
            </GhostButton>
          ) : null}
        </div>

        {rerollBlocked ? (
          <FeedbackMessage className="microRerollLimit" tone="warning">
            Limite atteinte aujourd’hui.
          </FeedbackMessage>
        ) : null}
        {adFeedback ? (
          <FeedbackMessage className="microRewardStatus" tone="success" role="status">
            {adFeedback}
          </FeedbackMessage>
        ) : null}
      </div>
    </AppCard>
  );
}
