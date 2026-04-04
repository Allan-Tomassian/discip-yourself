import React from "react";
import WalletBadge from "../../components/WalletBadge";
import {
  AppCard,
  AppChip,
  AppHeader,
  AppIconButton,
  AppInlineMetaCard,
  AppToggleRow,
  FeedbackMessage,
  GhostButton,
  MetricRow,
  PrimaryButton,
  SectionHeader,
} from "../../shared/ui/app";
import { BASIC_REWARDED_ADS_DAILY_LIMIT } from "../../logic/walletV1";
import { TOTEM_ACCESSORY_CATALOG, TOTEM_COLOR_CATALOG, findTotemAccessoryById } from "../../logic/totemV1";

const TABS = [
  { id: "wallet", label: "Portefeuille" },
  { id: "totem", label: "Personnalisation" },
  { id: "shop", label: "Boutique" },
  { id: "settings", label: "Animations" },
];

function formatCoins(value) {
  const safe = Math.max(0, Number(value) || 0);
  return new Intl.NumberFormat("fr-FR").format(safe);
}

function formatEventLabel(eventType) {
  if (eventType === "micro_done") return "Micro-action";
  if (eventType === "ad_reward") return "Vidéo récompensée";
  if (eventType === "totem_shop") return "Achat totem";
  return "Événement";
}

function formatEventAmount(event = {}) {
  const raw = Number(event.amount) || 0;
  const sign = event.type === "totem_shop" ? "-" : "+";
  return `${sign}${formatCoins(Math.max(0, Math.floor(Math.abs(raw))))}`;
}

function formatEventTime(event = {}) {
  const ts = Number(event.ts) || 0;
  if (!ts) return "À l’instant";
  return new Date(ts).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TotemDockPanel({
  view = "wallet",
  walletData,
  totemData,
  statusMessage = "",
  statusTone = "info",
  onChangeView,
  onClose,
  onHideDock,
  onToggleAnimations,
  onSelectColor,
  onToggleAccessory,
}) {
  const recentEvents = walletData.lastEvents.slice(-5).reverse();
  const firstAccessoryId = Array.isArray(totemData.equipped?.accessoryIds) ? totemData.equipped.accessoryIds[0] : "";
  const previewAccessory = findTotemAccessoryById(firstAccessoryId)?.emoji || "";

  return (
    <div className="totemDockPanelOuter" data-testid="totem-panel" role="dialog" aria-modal="true" aria-label="Dock totem">
      <AppCard variant="elevated" className="totemDockPanel">
        <AppHeader
          title="Totem Dock"
          subtitle="Wallet, shop et personnalisation"
          actions={(
            <div className="totemDockPanelActions">
              <AppIconButton
                className="totemDockIconBtn"
                data-testid="totem-panel-hide-action"
                aria-label="Masquer le dock"
                title="Masquer"
                onClick={onHideDock}
              >
                ⤵
              </AppIconButton>
              <AppIconButton
                className="totemDockIconBtn"
                data-testid="totem-panel-close"
                aria-label="Fermer le panneau totem"
                title="Fermer"
                onClick={onClose}
              >
                ×
              </AppIconButton>
            </div>
          )}
        />

        <div className="totemDockTabs" role="tablist" aria-label="Vues dock totem">
          {TABS.map((tab) => (
            <AppChip
              key={tab.id}
              type="button"
              role="tab"
              active={view === tab.id}
              aria-selected={view === tab.id}
              className="totemDockTab"
              onClick={() => onChangeView(tab.id)}
            >
              {tab.label}
            </AppChip>
          ))}
        </div>

        <div className="totemDockSection">
            {view === "wallet" ? (
              <div className="totemDockWallet">
                <WalletBadge
                  balance={walletData.balance}
                  className="totemDockWalletBadge"
                  size="md"
                  showDelta={false}
                  dataTestId="totem-wallet-balance"
                />
                <div className="totemDockWalletStats">
                  <AppCard className="totemDockWalletStat">
                    <MetricRow label="Gagné aujourd’hui" value={formatCoins(walletData.earnedToday)} />
                  </AppCard>
                  <AppCard className="totemDockWalletStat">
                    <MetricRow
                      label="Vidéos aujourd’hui"
                      value={`${walletData.adsToday}/${BASIC_REWARDED_ADS_DAILY_LIMIT}`}
                    />
                  </AppCard>
                </div>
                <div className="totemDockWalletEvents">
                  <SectionHeader title="Dernières récompenses" />
                  {recentEvents.length ? (
                    recentEvents.map((event, index) => (
                      <AppInlineMetaCard
                        key={`${event.ts || "event"}-${index}`}
                        className="totemDockWalletEvent"
                        title={formatEventLabel(event.type)}
                        text={formatEventTime(event)}
                        action={<span className="totemDockWalletEventAmount">{formatEventAmount(event)}</span>}
                      />
                    ))
                  ) : (
                    <AppInlineMetaCard className="totemDockEmpty" text="Aucune récompense récente." />
                  )}
                </div>
              </div>
            ) : null}

            {view === "totem" ? (
              <div className="totemDockTotemView">
                <div className="totemDockTotemPreview">
                  <div className="totemDockTotemAvatar" style={{ "--totem-dock-body": totemData.equipped.bodyColor }}>
                    <span className="totemDockTotemGlyph">🦅</span>
                    {previewAccessory ? <span className="totemDockTotemAccessory">{previewAccessory}</span> : null}
                  </div>
                  <div className="totemDockTotemMeta">
                    <div className="totemDockTotemBalance">🪙 {formatCoins(walletData.balance)}</div>
                    <div className="totemDockTotemText">Totem équipé</div>
                  </div>
                </div>
                <div className="totemDockOwned">
                  <AppCard className="totemDockOwnedRow">
                    <MetricRow label="Couleurs possédées" value={totemData.owned.colors.length} />
                  </AppCard>
                  <AppCard className="totemDockOwnedRow">
                    <MetricRow label="Accessoires possédés" value={totemData.owned.accessories.length} />
                  </AppCard>
                </div>
                <div className="totemDockHint">Utilise l’onglet Boutique pour acheter ou équiper.</div>
              </div>
            ) : null}

            {view === "shop" ? (
              <div className="totemDockShopView">
                <div className="totemDockShopGroup">
                  <SectionHeader title="Couleurs" />
                  <div className="totemDockShopGrid">
                    {TOTEM_COLOR_CATALOG.map((colorOption) => {
                      const owned = totemData.owned.colors.includes(colorOption.id);
                      const equipped = String(totemData.equipped.bodyColor).toLowerCase() === String(colorOption.color).toLowerCase();
                      return (
                        <AppCard className="totemDockShopCard" key={colorOption.id}>
                          <span className="totemDockSwatch" style={{ background: colorOption.color }} />
                          <div className="totemDockShopText">
                            <strong>{colorOption.label}</strong>
                            <span>{owned ? "Possédé" : `🪙 ${formatCoins(colorOption.price)}`}</span>
                          </div>
                          {equipped ? (
                            <PrimaryButton
                              type="button"
                              className="totemDockShopAction"
                              disabled
                            >
                              Équipé
                            </PrimaryButton>
                          ) : (
                            <GhostButton
                              type="button"
                              className="totemDockShopAction"
                              withSound
                              onClick={() => onSelectColor(colorOption)}
                            >
                              {owned ? "Équiper" : "Acheter"}
                            </GhostButton>
                          )}
                        </AppCard>
                      );
                    })}
                  </div>
                </div>

                <div className="totemDockShopGroup">
                  <SectionHeader title="Accessoires" />
                  <div className="totemDockShopGrid">
                    {TOTEM_ACCESSORY_CATALOG.map((item) => {
                      const owned = totemData.owned.accessories.includes(item.id);
                      const equipped = totemData.equipped.accessoryIds.includes(item.id);
                      return (
                        <AppCard className="totemDockShopCard" key={item.id}>
                          <span className="totemDockAccessory">{item.emoji}</span>
                          <div className="totemDockShopText">
                            <strong>{item.label}</strong>
                            <span>{owned ? "Possédé" : `🪙 ${formatCoins(item.price)}`}</span>
                          </div>
                          {equipped ? (
                            <PrimaryButton
                              type="button"
                              className="totemDockShopAction"
                              withSound
                              onClick={() => onToggleAccessory(item)}
                            >
                              Retirer
                            </PrimaryButton>
                          ) : (
                            <GhostButton
                              type="button"
                              className="totemDockShopAction"
                              withSound
                              onClick={() => onToggleAccessory(item)}
                            >
                              {owned ? "Équiper" : "Acheter"}
                            </GhostButton>
                          )}
                        </AppCard>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {view === "settings" ? (
              <div className="totemDockSettingsView">
                <AppCard className="totemDockSettingsRow">
                  <AppToggleRow
                    checked={totemData.animationEnabled}
                    onChange={onToggleAnimations}
                    label="Animations"
                    description="Active ou coupe les animations du totem sans modifier le scoring."
                  />
                </AppCard>
                <AppCard className="totemDockSettingsRow">
                  <MetricRow label="Comportement" value="Variant B" />
                </AppCard>
                <p className="totemDockHint">
                  Ce réglage prépare les variantes de comportement du totem, sans changer le scoring.
                </p>
              </div>
            ) : null}
        </div>

        {statusMessage ? (
          <FeedbackMessage tone={statusTone === "error" ? "error" : "info"} className="totemDockStatus" role="status">
            {statusMessage}
          </FeedbackMessage>
        ) : null}
      </AppCard>
    </div>
  );
}
