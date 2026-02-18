import React from "react";
import WalletBadge from "../../components/WalletBadge";
import { GateButton, GateHeader, GatePanel, GateSection } from "../../shared/ui/gate/Gate";
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
    <div
      className="totemDockPanelOuter GateGlassOuter"
      data-testid="totem-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Dock totem"
    >
      <div className="totemDockPanelClip GateGlassClip GateGlassBackdrop">
        <GatePanel className="totemDockPanel GateGlassContent GateSurfacePremium GateCardPremium">
          <GateHeader
            title="Totem Dock"
            subtitle="Wallet, shop et personnalisation"
            actions={(
              <div className="totemDockPanelActions">
                <button
                  type="button"
                  className="totemDockIconBtn GatePressable"
                  data-testid="totem-panel-hide-action"
                  aria-label="Masquer le dock"
                  title="Masquer"
                  onClick={onHideDock}
                >
                  ⤵
                </button>
                <button
                  type="button"
                  className="totemDockIconBtn GatePressable"
                  data-testid="totem-panel-close"
                  aria-label="Fermer le panneau totem"
                  title="Fermer"
                  onClick={onClose}
                >
                  ×
                </button>
              </div>
            )}
          />

          <div className="totemDockTabs" role="tablist" aria-label="Vues dock totem">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={view === tab.id}
                className={`totemDockTab GatePressable${view === tab.id ? " isActive" : ""}`}
                onClick={() => onChangeView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <GateSection className="totemDockSection">
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
                  <div className="totemDockWalletStat">
                    <span>Gagné aujourd’hui</span>
                    <strong>{formatCoins(walletData.earnedToday)}</strong>
                  </div>
                  <div className="totemDockWalletStat">
                    <span>Vidéos aujourd’hui</span>
                    <strong>{walletData.adsToday}/{BASIC_REWARDED_ADS_DAILY_LIMIT}</strong>
                  </div>
                </div>
                <div className="totemDockWalletEvents">
                  <div className="totemDockWalletEventsTitle">Dernières récompenses</div>
                  {recentEvents.length ? (
                    recentEvents.map((event, index) => (
                      <div className="totemDockWalletEvent" key={`${event.ts || "event"}-${index}`}>
                        <div className="totemDockWalletEventText">
                          <span className="totemDockWalletEventLabel">{formatEventLabel(event.type)}</span>
                          <span className="totemDockWalletEventMeta">{formatEventTime(event)}</span>
                        </div>
                        <span className="totemDockWalletEventAmount">{formatEventAmount(event)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="totemDockEmpty">Aucune récompense récente.</p>
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
                  <div className="totemDockOwnedRow">
                    <span>Couleurs possédées</span>
                    <strong>{totemData.owned.colors.length}</strong>
                  </div>
                  <div className="totemDockOwnedRow">
                    <span>Accessoires possédés</span>
                    <strong>{totemData.owned.accessories.length}</strong>
                  </div>
                </div>
                <div className="totemDockHint">Utilise l’onglet Boutique pour acheter ou équiper.</div>
              </div>
            ) : null}

            {view === "shop" ? (
              <div className="totemDockShopView">
                <div className="totemDockShopGroup">
                  <div className="totemDockShopTitle">Couleurs</div>
                  <div className="totemDockShopGrid">
                    {TOTEM_COLOR_CATALOG.map((colorOption) => {
                      const owned = totemData.owned.colors.includes(colorOption.id);
                      const equipped = String(totemData.equipped.bodyColor).toLowerCase() === String(colorOption.color).toLowerCase();
                      return (
                        <div className="totemDockShopCard" key={colorOption.id}>
                          <span className="totemDockSwatch" style={{ background: colorOption.color }} />
                          <div className="totemDockShopText">
                            <strong>{colorOption.label}</strong>
                            <span>{owned ? "Possédé" : `🪙 ${formatCoins(colorOption.price)}`}</span>
                          </div>
                          <GateButton
                            type="button"
                            variant={equipped ? "primary" : "ghost"}
                            className="GatePressable totemDockShopAction"
                            withSound
                            onClick={() => onSelectColor(colorOption)}
                            disabled={equipped}
                          >
                            {equipped ? "Équipé" : owned ? "Équiper" : "Acheter"}
                          </GateButton>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="totemDockShopGroup">
                  <div className="totemDockShopTitle">Accessoires</div>
                  <div className="totemDockShopGrid">
                    {TOTEM_ACCESSORY_CATALOG.map((item) => {
                      const owned = totemData.owned.accessories.includes(item.id);
                      const equipped = totemData.equipped.accessoryIds.includes(item.id);
                      return (
                        <div className="totemDockShopCard" key={item.id}>
                          <span className="totemDockAccessory">{item.emoji}</span>
                          <div className="totemDockShopText">
                            <strong>{item.label}</strong>
                            <span>{owned ? "Possédé" : `🪙 ${formatCoins(item.price)}`}</span>
                          </div>
                          <GateButton
                            type="button"
                            variant={equipped ? "primary" : "ghost"}
                            className="GatePressable totemDockShopAction"
                            withSound
                            onClick={() => onToggleAccessory(item)}
                          >
                            {equipped ? "Retirer" : owned ? "Équiper" : "Acheter"}
                          </GateButton>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {view === "settings" ? (
              <div className="totemDockSettingsView">
                <div className="totemDockSettingsRow">
                  <span>Animations</span>
                  <GateButton
                    type="button"
                    variant="ghost"
                    className="GatePressable"
                    withSound
                    onClick={onToggleAnimations}
                  >
                    {totemData.animationEnabled ? "Activées" : "Désactivées"}
                  </GateButton>
                </div>
                <div className="totemDockSettingsRow">
                  <span>Comportement</span>
                  <strong>Variant B</strong>
                </div>
                <p className="totemDockHint">
                  Ce réglage prépare les variantes de comportement du totem, sans changer le scoring.
                </p>
              </div>
            ) : null}
          </GateSection>

          {statusMessage ? (
            <p className={`totemDockStatus ${statusTone === "error" ? "isError" : ""}`} role="status">
              {statusMessage}
            </p>
          ) : null}
        </GatePanel>
      </div>
    </div>
  );
}
