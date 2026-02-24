import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { loadUserData, upsertUserData } from "../data/userDataApi";
import WalletBadge from "./WalletBadge";
import { GateButton, GateFooter, GateHeader, GatePanel, GateRow, GateSection } from "../shared/ui/gate/Gate";
import { BASIC_REWARDED_ADS_DAILY_LIMIT, spendCoins } from "../logic/walletV1";
import {
  TOTEM_ACCESSORY_CATALOG,
  TOTEM_COLOR_CATALOG,
  ensureTotemV1,
  findTotemAccessoryById,
} from "../logic/totemV1";
import "../features/navigation/topMenuGate.css";

const ENABLE_MENU_NAV_DEBUG = false;
const MENU_ITEMS = [
  { id: "account", label: "Compte / Profil", subtitle: "Username, nom, avatar", group: "main" },
  { id: "preferences", label: "Réglages", subtitle: "App / apparence", group: "main" },
  { id: "totem", label: "Totem / Personnalisation", subtitle: "Aigle, couleurs, accessoires", group: "main" },
  { id: "wallet", label: "Portefeuille", subtitle: "Coins et récompenses", group: "main" },
  { id: "subscription", label: "Abonnement", subtitle: "Statut et options Premium", group: "main" },
  { id: "data", label: "Données", subtitle: "Exporter / importer", group: "main" },
  { id: "privacy", label: "Confidentialité", subtitle: "Politique de données", group: "secondary" },
  { id: "terms", label: "Conditions", subtitle: "Conditions d'utilisation", group: "secondary" },
  { id: "support", label: "Support", subtitle: "Contact et FAQ", group: "secondary" },
];
const MENU_SUBVIEW_COPY = {
  account: "Paramètres de profil bientôt disponibles directement dans ce menu.",
  preferences: "Réglages rapides en préparation dans cette sous-vue.",
  totem: "Personnalise ton totem avec tes coins.",
  wallet: "Le portefeuille détaille ton solde et tes récompenses récentes.",
  subscription: "Le détail d'abonnement sera intégré ici.",
  data: "Les actions Export / Import seront ajoutées ici.",
  privacy: "La confidentialité sera consultable depuis cette sous-vue.",
  terms: "Les conditions seront consultables ici sans changer d'écran.",
  support: "Le support et la FAQ seront accessibles dans ce panneau.",
};

function resolveMenuView(nextView) {
  if (nextView === "root") return "root";
  if (MENU_ITEMS.some((item) => item.id === nextView)) return nextView;
  return "root";
}

function formatCoins(value) {
  const safe = Math.max(0, Number(value) || 0);
  return new Intl.NumberFormat("fr-FR").format(safe);
}

export default function TopMenuPopover({ onNavigate, onClose, initialView = "root" }) {
  const { signOut, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [menuView, setMenuView] = useState(() => resolveMenuView(initialView));
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsWhyText, setSettingsWhyText] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");
  const [settingsSnapshot, setSettingsSnapshot] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletStatus, setWalletStatus] = useState("");
  const [walletSnapshot, setWalletSnapshot] = useState(null);
  const [totemLoading, setTotemLoading] = useState(false);
  const [totemSaving, setTotemSaving] = useState(false);
  const [totemStatus, setTotemStatus] = useState("");
  const [totemSnapshot, setTotemSnapshot] = useState(null);
  const inSubview = menuView !== "root";
  const activeItem = MENU_ITEMS.find((item) => item.id === menuView) || null;

  async function handleLogout() {
    setMenuError("");
    setLoggingOut(true);
    try {
      await signOut();
      if (typeof onClose === "function") onClose();
    } catch (error) {
      const message = String(error?.message || "").trim() || "Impossible de se déconnecter.";
      setMenuError(message);
    } finally {
      setLoggingOut(false);
    }
  }

  function handleAction(itemId) {
    setMenuError("");
    setSettingsStatus("");
    setWalletStatus("");
    setTotemStatus("");
    if (ENABLE_MENU_NAV_DEBUG && typeof onNavigate === "function") {
      onNavigate(itemId);
      if (typeof onClose === "function") onClose();
      return;
    }
    setMenuView(itemId);
  }

  function handleBack() {
    setMenuError("");
    setSettingsStatus("");
    setWalletStatus("");
    setTotemStatus("");
    setMenuView("root");
  }

  function handleDebugNavigate() {
    if (!activeItem) return;
    if (typeof onNavigate === "function") onNavigate(activeItem.id);
    if (typeof onClose === "function") onClose();
  }

  const mainItems = MENU_ITEMS.filter((item) => item.group === "main");
  const secondaryItems = MENU_ITEMS.filter((item) => item.group === "secondary");
  const isPreferencesView = menuView === "preferences";
  const isTotemView = menuView === "totem";
  const isWalletView = menuView === "wallet";

  useEffect(() => {
    const nextView = resolveMenuView(initialView);
    setMenuView((prev) => (prev === nextView ? prev : nextView));
  }, [initialView]);

  useEffect(() => {
    const shouldLoadPayload = isPreferencesView || isWalletView || isTotemView;
    if (!shouldLoadPayload) return undefined;
    if (!user?.id) return undefined;

    let active = true;
    if (isPreferencesView) {
      setSettingsLoading(true);
      setSettingsStatus("");
    }
    if (isWalletView) {
      setWalletLoading(true);
      setWalletStatus("");
    }
    if (isTotemView) {
      setTotemLoading(true);
      setTotemStatus("");
    }

    loadUserData(user.id)
      .then((payload) => {
        if (!active) return;
        const safePayload = payload && typeof payload === "object" ? payload : {};
        const profile = safePayload.profile && typeof safePayload.profile === "object" ? safePayload.profile : {};
        const wallet = safePayload?.ui?.walletV1 && typeof safePayload.ui.walletV1 === "object"
          ? safePayload.ui.walletV1
          : null;
        const totem = safePayload?.ui?.totemV1 && typeof safePayload.ui.totemV1 === "object"
          ? safePayload.ui.totemV1
          : null;
        setSettingsSnapshot(safePayload);
        setWalletSnapshot(wallet);
        setTotemSnapshot(totem);
        if (isPreferencesView) {
          setSettingsWhyText(String(profile.whyText || ""));
        }
      })
      .catch(() => {
        if (!active) return;
        if (isPreferencesView) setSettingsStatus("Impossible de charger les réglages.");
        if (isWalletView) setWalletStatus("Impossible de charger le portefeuille.");
        if (isTotemView) setTotemStatus("Impossible de charger la personnalisation.");
      })
      .finally(() => {
        if (!active) return;
        if (isPreferencesView) setSettingsLoading(false);
        if (isWalletView) setWalletLoading(false);
        if (isTotemView) setTotemLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isPreferencesView, isWalletView, isTotemView, user?.id]);

  const walletData = (() => {
    const source = (walletSnapshot && typeof walletSnapshot === "object")
      ? walletSnapshot
      : settingsSnapshot?.ui?.walletV1 && typeof settingsSnapshot.ui.walletV1 === "object"
        ? settingsSnapshot.ui.walletV1
        : {};
    const balance = Number.isFinite(source.balance) ? Math.max(0, Math.floor(source.balance)) : 0;
    const earnedToday = Number.isFinite(source.earnedToday) ? Math.max(0, Math.floor(source.earnedToday)) : 0;
    const adsToday = Number.isFinite(source.adsToday) ? Math.max(0, Math.floor(source.adsToday)) : 0;
    const lastEvents = Array.isArray(source.lastEvents)
      ? source.lastEvents.filter((event) => event && typeof event === "object")
      : [];
    return { balance, earnedToday, adsToday, lastEvents };
  })();

  const totemData = ensureTotemV1(
    (totemSnapshot && typeof totemSnapshot === "object")
      ? totemSnapshot
      : settingsSnapshot?.ui?.totemV1
  );

  const totemAccessoryPreview = (() => {
    const firstAccessory = Array.isArray(totemData.equipped?.accessoryIds) ? totemData.equipped.accessoryIds[0] : "";
    return findTotemAccessoryById(firstAccessory)?.emoji || "";
  })();

  const walletRecentEvents = walletData.lastEvents.slice(-5).reverse();

  async function persistMenuUi(patchBuilder) {
    if (!user?.id || typeof patchBuilder !== "function") return false;
    setTotemSaving(true);
    try {
      const base = settingsSnapshot && typeof settingsSnapshot === "object"
        ? settingsSnapshot
        : await loadUserData(user.id);
      const safeBase = base && typeof base === "object" ? base : {};
      const safeUi = safeBase.ui && typeof safeBase.ui === "object" ? safeBase.ui : {};
      const safeProfile = safeBase.profile && typeof safeBase.profile === "object" ? safeBase.profile : {};
      const safeWallet = (() => {
        const source = safeUi.walletV1 && typeof safeUi.walletV1 === "object" ? safeUi.walletV1 : {};
        const balance = Number.isFinite(source.balance) ? Math.max(0, Math.floor(source.balance)) : 0;
        const earnedToday = Number.isFinite(source.earnedToday) ? Math.max(0, Math.floor(source.earnedToday)) : 0;
        const adsToday = Number.isFinite(source.adsToday) ? Math.max(0, Math.floor(source.adsToday)) : 0;
        const dateKey = typeof source.dateKey === "string" && source.dateKey.trim() ? source.dateKey.trim() : "";
        const lastEvents = Array.isArray(source.lastEvents)
          ? source.lastEvents.filter((event) => event && typeof event === "object").slice(-50)
          : [];
        return {
          version: 1,
          balance,
          earnedToday,
          adsToday,
          dateKey,
          lastEvents,
        };
      })();
      const safeTotem = ensureTotemV1(safeUi.totemV1);
      const patch = patchBuilder({ wallet: safeWallet, totem: safeTotem });
      if (!patch || typeof patch !== "object") return false;

      const nextUi = {
        ...safeUi,
        ...(patch.ui && typeof patch.ui === "object" ? patch.ui : {}),
      };
      const nextData = {
        ...safeBase,
        profile: safeProfile,
        ...(patch.data && typeof patch.data === "object" ? patch.data : {}),
        ui: nextUi,
      };
      await upsertUserData(user.id, nextData);
      setSettingsSnapshot(nextData);
      setWalletSnapshot(nextUi.walletV1 || null);
      setTotemSnapshot(nextUi.totemV1 || null);
      return true;
    } catch {
      return false;
    } finally {
      setTotemSaving(false);
    }
  }

  function formatWalletEventLabel(eventType) {
    if (eventType === "micro_done") return "Micro-action validée";
    if (eventType === "ad_reward") return "Vidéo récompensée";
    if (eventType === "spend_reroll") return "Reroll utilisé";
    if (eventType === "spend_shop") return "Achat boutique";
    return "Événement";
  }

  function formatWalletEventAmount(event) {
    const amount = Number.isFinite(event?.amount) ? Math.max(0, Math.floor(event.amount)) : 0;
    const type = typeof event?.type === "string" ? event.type : "";
    if (type === "spend_reroll") return `-${amount} crédit`;
    if (type === "spend_shop") return `-${formatCoins(amount)} coins`;
    return `+${formatCoins(amount)} coins`;
  }

  function formatWalletEventTime(event) {
    const ts = Number.isFinite(event?.ts) ? event.ts : NaN;
    if (!Number.isFinite(ts)) return "";
    try {
      return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    } catch (_error) {
      return "";
    }
  }

  async function handleToggleTotemAnimations() {
    setTotemStatus("");
    const ok = await persistMenuUi(({ totem }) => ({
      ui: {
        totemV1: {
          ...totem,
          animationEnabled: !totem.animationEnabled,
        },
      },
    }));
    if (!ok) setTotemStatus("Impossible de mettre à jour l’animation.");
  }

  async function handleSelectTotemColor(colorOption) {
    if (!colorOption?.id) return;
    setTotemStatus("");
    const owned = totemData.owned.colors.includes(colorOption.id);
    const isEquipped = String(totemData.equipped.bodyColor).toLowerCase() === String(colorOption.color).toLowerCase();
    if (owned && isEquipped) return;

    const ok = await persistMenuUi(({ wallet, totem }) => {
      const nextOwned = [...totem.owned.colors];
      let nextWallet = wallet;
      if (!owned) {
        const spendResult = spendCoins(
          wallet,
          colorOption.price,
          { type: "spend_shop", meta: { itemType: "color", itemId: colorOption.id } }
        );
        if (!spendResult.spent) return null;
        nextWallet = spendResult.wallet;
        nextOwned.push(colorOption.id);
      }
      return {
        ui: {
          walletV1: nextWallet,
          totemV1: {
            ...totem,
            owned: {
              ...totem.owned,
              colors: Array.from(new Set(nextOwned)),
            },
            equipped: {
              ...totem.equipped,
              bodyColor: colorOption.color,
            },
          },
        },
      };
    });

    if (!ok) {
      setTotemStatus(owned ? "Impossible d’équiper cette couleur." : "Solde insuffisant pour cet achat.");
      return;
    }
    setTotemStatus(owned ? "Couleur équipée." : "Couleur achetée et équipée.");
  }

  async function handleToggleAccessory(accessoryOption) {
    if (!accessoryOption?.id) return;
    setTotemStatus("");
    const owned = totemData.owned.accessories.includes(accessoryOption.id);
    const equippedIds = Array.isArray(totemData.equipped.accessoryIds) ? totemData.equipped.accessoryIds : [];
    const isEquipped = equippedIds.includes(accessoryOption.id);

    const ok = await persistMenuUi(({ wallet, totem }) => {
      let nextWallet = wallet;
      let nextOwned = [...totem.owned.accessories];
      let nextEquipped = [...totem.equipped.accessoryIds];

      if (!owned) {
        const spendResult = spendCoins(
          wallet,
          accessoryOption.price,
          { type: "spend_shop", meta: { itemType: "accessory", itemId: accessoryOption.id } }
        );
        if (!spendResult.spent) return null;
        nextWallet = spendResult.wallet;
        nextOwned.push(accessoryOption.id);
        nextEquipped.push(accessoryOption.id);
      } else if (isEquipped) {
        nextEquipped = nextEquipped.filter((id) => id !== accessoryOption.id);
      } else {
        nextEquipped = Array.from(new Set([...nextEquipped, accessoryOption.id]));
      }

      return {
        ui: {
          walletV1: nextWallet,
          totemV1: {
            ...totem,
            owned: {
              ...totem.owned,
              accessories: Array.from(new Set(nextOwned)),
            },
            equipped: {
              ...totem.equipped,
              accessoryIds: Array.from(new Set(nextEquipped)),
            },
          },
        },
      };
    });

    if (!ok) {
      setTotemStatus(owned ? "Impossible de modifier cet accessoire." : "Solde insuffisant pour cet achat.");
      return;
    }
    if (!owned) setTotemStatus("Accessoire acheté et équipé.");
    else setTotemStatus(isEquipped ? "Accessoire retiré." : "Accessoire équipé.");
  }

  async function handleSavePreferences() {
    if (!user?.id || settingsSaving) return;

    setSettingsSaving(true);
    setSettingsStatus("");
    try {
      const base = settingsSnapshot && typeof settingsSnapshot === "object"
        ? settingsSnapshot
        : await loadUserData(user.id);
      const safeBase = base && typeof base === "object" ? base : {};
      const safeProfile = safeBase.profile && typeof safeBase.profile === "object" ? safeBase.profile : {};
      const nextData = {
        ...safeBase,
        profile: {
          ...safeProfile,
          whyText: settingsWhyText,
          whyUpdatedAt: new Date().toISOString(),
        },
      };
      await upsertUserData(user.id, nextData);
      setSettingsSnapshot(nextData);
      setSettingsStatus("Enregistré.");
    } catch {
      setSettingsStatus("Impossible d'enregistrer.");
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <div className="topMenuGatePopover">
      <div className="topMenuCardOuter">
        <div className="topMenuCardClip">
          <GatePanel
            className="topMenuGate topMenuCardContent GateSurfacePremium GateCardPremium"
            role={inSubview ? "dialog" : "menu"}
            aria-label={inSubview ? "Sous-vue menu" : "Menu principal"}
          >
            <GateHeader
              title={inSubview ? activeItem?.label || "Menu" : "Menu"}
              subtitle={inSubview ? "Vue intégrée au panneau" : "Navigation rapide"}
              className="topMenuGateHeader"
              actions={(
                <div className="topMenuHeaderActions">
                  {inSubview ? (
                    <button
                      type="button"
                      className="topMenuHeaderIconButton GateIconButtonPremium GatePressable"
                      onClick={handleBack}
                      aria-label="Retour"
                      title="Retour"
                    >
                      ‹
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="topMenuHeaderIconButton GateIconButtonPremium GatePressable"
                    onClick={onClose}
                    aria-label="Fermer le menu"
                    title="Fermer"
                  >
                    ×
                  </button>
                </div>
              )}
            />

            {!inSubview ? (
              <>
                <GateSection className="topMenuGateSectionFlat">
                  <div className="topMenuGateList">
                    {mainItems.map((item) => (
                      <GateRow
                        key={item.id}
                        label={item.label}
                        meta={item.subtitle}
                        right={<span className="topMenuGateChevron" aria-hidden="true">›</span>}
                        className="topMenuGateItem topMenuGateRowFlat GatePressable"
                        role="menuitem"
                        withSound
                        onClick={() => handleAction(item.id)}
                      />
                    ))}
                  </div>
                </GateSection>

                <div className="topMenuGateDivider" />

                <GateSection className="topMenuGateSectionFlat">
                  <div className="topMenuGateList">
                    {secondaryItems.map((item) => (
                      <GateRow
                        key={item.id}
                        label={item.label}
                        meta={item.subtitle}
                        right={<span className="topMenuGateChevron" aria-hidden="true">›</span>}
                        className="topMenuGateItem topMenuGateRowFlat GatePressable"
                        role="menuitem"
                        withSound
                        onClick={() => handleAction(item.id)}
                      />
                    ))}
                  </div>
                </GateSection>

                <GateFooter className="topMenuGateFooter">
                  <GateButton
                    type="button"
                    variant="ghost"
                    className="topMenuGateLogout GatePressable"
                    withSound
                    onClick={handleLogout}
                    disabled={loggingOut}
                    role="menuitem"
                  >
                    {loggingOut ? "Déconnexion..." : "Déconnexion"}
                  </GateButton>
                </GateFooter>
              </>
            ) : (
              <GateSection className="topMenuGateSectionFlat topMenuSubviewSection">
                <div className="topMenuSubview">
                  {isPreferencesView ? (
                    <>
                      <p className="topMenuSubviewKicker" data-tour-id="settings-title">Réglages</p>
                      <p className="topMenuSubviewBody">
                        Ajuste ton pourquoi directement dans le menu.
                      </p>
                      <label className="topMenuSettingsField">
                        <span className="topMenuSettingsLabel">Ton pourquoi</span>
                        <textarea
                          className="GateTextareaPremium topMenuSettingsTextarea"
                          placeholder="Ton pourquoi"
                          value={settingsWhyText}
                          onChange={(event) => {
                            setSettingsStatus("");
                            setSettingsWhyText(event.target.value);
                          }}
                          disabled={settingsLoading || settingsSaving}
                        />
                      </label>
                      <div className="topMenuSubviewActions GatePrimaryCtaRow">
                        <GateButton
                          type="button"
                          className="GatePressable"
                          withSound
                          onClick={handleSavePreferences}
                          disabled={settingsLoading || settingsSaving}
                        >
                          {settingsSaving ? "Enregistrement..." : "Enregistrer"}
                        </GateButton>
                        <GateButton
                          type="button"
                          variant="ghost"
                          className="GatePressable"
                          withSound
                          onClick={handleBack}
                        >
                          Retour au menu
                        </GateButton>
                        {ENABLE_MENU_NAV_DEBUG ? (
                          <GateButton
                            type="button"
                            className="GatePressable"
                            withSound
                            onClick={handleDebugNavigate}
                          >
                            Ouvrir la page (debug)
                          </GateButton>
                        ) : null}
                      </div>
                      {settingsStatus ? (
                        <p className="topMenuSettingsStatus" role="status">
                          {settingsStatus}
                        </p>
                      ) : null}
                    </>
                  ) : isWalletView ? (
                    <>
                      <p className="topMenuSubviewKicker">Portefeuille</p>
                      <div className="topMenuWalletTopRow">
                        <GateButton
                          type="button"
                          variant="ghost"
                          className="GatePressable topMenuWalletTopBtn"
                          withSound
                          onClick={handleBack}
                        >
                          ← Menu
                        </GateButton>
                        <GateButton
                          type="button"
                          variant="ghost"
                          className="GatePressable topMenuWalletTopBtn"
                          withSound
                          onClick={onClose}
                        >
                          Fermer
                        </GateButton>
                      </div>
                      <WalletBadge
                        balance={walletData.balance}
                        className="topMenuWalletBalance"
                        size="md"
                        showDelta={false}
                        dataTestId="menu-wallet-balance"
                      />
                      <div className="topMenuWalletStats">
                        <div className="topMenuWalletStat GateRowPremium">
                          <span>Gagné aujourd’hui</span>
                          <strong>{formatCoins(walletData.earnedToday)}</strong>
                        </div>
                        <div className="topMenuWalletStat GateRowPremium">
                          <span>Vidéos aujourd’hui</span>
                          <strong>{walletData.adsToday}/{BASIC_REWARDED_ADS_DAILY_LIMIT}</strong>
                        </div>
                      </div>
                      <div className="topMenuWalletEvents">
                        <div className="topMenuWalletEventsTitle">Dernières récompenses</div>
                        {walletLoading ? (
                          <p className="topMenuWalletEventsEmpty">Chargement...</p>
                        ) : walletRecentEvents.length ? (
                          walletRecentEvents.map((event, index) => (
                            <div className="topMenuWalletEvent GateRowPremium" key={`${event.ts || "ev"}-${index}`}>
                              <div className="topMenuWalletEventText">
                                <span className="topMenuWalletEventLabel">{formatWalletEventLabel(event.type)}</span>
                                <span className="topMenuWalletEventMeta">{formatWalletEventTime(event)}</span>
                              </div>
                              <span className="topMenuWalletEventAmount">{formatWalletEventAmount(event)}</span>
                            </div>
                          ))
                        ) : (
                          <p className="topMenuWalletEventsEmpty">Aucune récompense récente.</p>
                        )}
                      </div>
                      {walletStatus ? (
                        <p className="topMenuSettingsStatus" role="status">
                          {walletStatus}
                        </p>
                      ) : null}
                    </>
                  ) : isTotemView ? (
                    <>
                      <p className="topMenuSubviewKicker">Totem</p>
                      <div className="topMenuTotemPreview">
                        <div className="topMenuTotemAvatar" style={{ "--totem-body-color": totemData.equipped.bodyColor }}>
                          <span className="topMenuTotemGlyph">🦅</span>
                          {totemAccessoryPreview ? <span className="topMenuTotemAccessory">{totemAccessoryPreview}</span> : null}
                        </div>
                        <div className="topMenuTotemSummary">
                          <div className="topMenuTotemBalance">🪙 {formatCoins(walletData.balance)}</div>
                          <div className="topMenuTotemMeta">Personnalisation de l’aigle</div>
                        </div>
                      </div>
                      <div className="topMenuTotemToggleRow">
                        <span>Animations</span>
                        <GateButton
                          type="button"
                          variant="ghost"
                          className="GatePressable topMenuTotemToggleBtn"
                          withSound
                          onClick={handleToggleTotemAnimations}
                          disabled={totemSaving}
                        >
                          {totemData.animationEnabled ? "Activées" : "Désactivées"}
                        </GateButton>
                      </div>
                      <div className="topMenuTotemSection">
                        <div className="topMenuTotemSectionTitle">Couleurs</div>
                        <div className="topMenuTotemGrid">
                          {TOTEM_COLOR_CATALOG.map((colorOption) => {
                            const owned = totemData.owned.colors.includes(colorOption.id);
                            const equipped = String(totemData.equipped.bodyColor).toLowerCase() === String(colorOption.color).toLowerCase();
                            return (
                              <div
                                className={`topMenuTotemCard GateRowPremium${equipped ? " isEquipped" : ""}`}
                                key={colorOption.id}
                              >
                                <span className="topMenuTotemSwatch" style={{ background: colorOption.color }} aria-hidden="true" />
                                <div className="topMenuTotemCardText">
                                  <strong>{colorOption.label}</strong>
                                  <span>{owned ? "Possédé" : `🪙 ${formatCoins(colorOption.price)}`}</span>
                                </div>
                                <GateButton
                                  type="button"
                                  variant={equipped ? "primary" : "ghost"}
                                  className="GatePressable topMenuTotemActionBtn"
                                  withSound
                                  disabled={totemSaving || equipped}
                                  onClick={() => handleSelectTotemColor(colorOption)}
                                >
                                  {equipped ? "Équipé" : owned ? "Équiper" : "Acheter"}
                                </GateButton>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="topMenuTotemSection">
                        <div className="topMenuTotemSectionTitle">Accessoires</div>
                        <div className="topMenuTotemGrid">
                          {TOTEM_ACCESSORY_CATALOG.map((accessoryOption) => {
                            const owned = totemData.owned.accessories.includes(accessoryOption.id);
                            const equipped = totemData.equipped.accessoryIds.includes(accessoryOption.id);
                            return (
                              <div
                                className={`topMenuTotemCard GateRowPremium${equipped ? " isEquipped" : ""}`}
                                key={accessoryOption.id}
                              >
                                <span className="topMenuTotemAccessoryBadge" aria-hidden="true">{accessoryOption.emoji}</span>
                                <div className="topMenuTotemCardText">
                                  <strong>{accessoryOption.label}</strong>
                                  <span>{owned ? "Possédé" : `🪙 ${formatCoins(accessoryOption.price)}`}</span>
                                </div>
                                <GateButton
                                  type="button"
                                  variant={equipped ? "primary" : "ghost"}
                                  className="GatePressable topMenuTotemActionBtn"
                                  withSound
                                  disabled={totemSaving}
                                  onClick={() => handleToggleAccessory(accessoryOption)}
                                >
                                  {equipped ? "Retirer" : owned ? "Équiper" : "Acheter"}
                                </GateButton>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {totemLoading ? <p className="topMenuSettingsStatus">Chargement...</p> : null}
                      {totemStatus ? (
                        <p className="topMenuSettingsStatus" role="status">
                          {totemStatus}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="topMenuSubviewKicker">Bientôt</p>
                      <p className="topMenuSubviewBody">
                        {activeItem ? MENU_SUBVIEW_COPY[activeItem.id] : "Cette section sera disponible dans le menu."}
                      </p>
                      <div className="topMenuSubviewActions GatePrimaryCtaRow">
                        <GateButton
                          type="button"
                          variant="ghost"
                          className="GatePressable"
                          withSound
                          onClick={handleBack}
                        >
                          Retour au menu
                        </GateButton>
                        {ENABLE_MENU_NAV_DEBUG ? (
                          <GateButton
                            type="button"
                            className="GatePressable"
                            withSound
                            onClick={handleDebugNavigate}
                          >
                            Ouvrir la page (debug)
                          </GateButton>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </GateSection>
            )}

            {menuError ? (
              <p className="topMenuGateError" role="alert">
                {menuError}
              </p>
            ) : null}
          </GatePanel>
        </div>
      </div>
    </div>
  );
}
