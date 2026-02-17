import React, { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { GateButton, GateFooter, GateHeader, GatePanel, GateRow, GateSection } from "../shared/ui/gate/Gate";
import "../features/navigation/topMenuGate.css";

const ENABLE_MENU_NAV_DEBUG = false;
const MENU_ITEMS = [
  { id: "account", label: "Compte / Profil", subtitle: "Username, nom, avatar", group: "main" },
  { id: "preferences", label: "Réglages", subtitle: "App / apparence", group: "main" },
  { id: "subscription", label: "Abonnement", subtitle: "Statut et options Premium", group: "main" },
  { id: "data", label: "Données", subtitle: "Exporter / importer", group: "main" },
  { id: "privacy", label: "Confidentialité", subtitle: "Politique de données", group: "secondary" },
  { id: "terms", label: "Conditions", subtitle: "Conditions d'utilisation", group: "secondary" },
  { id: "support", label: "Support", subtitle: "Contact et FAQ", group: "secondary" },
];
const MENU_SUBVIEW_COPY = {
  account: "Paramètres de profil bientôt disponibles directement dans ce menu.",
  preferences: "Réglages rapides en préparation dans cette sous-vue.",
  subscription: "Le détail d'abonnement sera intégré ici.",
  data: "Les actions Export / Import seront ajoutées ici.",
  privacy: "La confidentialité sera consultable depuis cette sous-vue.",
  terms: "Les conditions seront consultables ici sans changer d'écran.",
  support: "Le support et la FAQ seront accessibles dans ce panneau.",
};

export default function TopMenuPopover({ onNavigate, onClose }) {
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [menuView, setMenuView] = useState("root");
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
    if (ENABLE_MENU_NAV_DEBUG && typeof onNavigate === "function") {
      onNavigate(itemId);
      if (typeof onClose === "function") onClose();
      return;
    }
    setMenuView(itemId);
  }

  function handleBack() {
    setMenuError("");
    setMenuView("root");
  }

  function handleDebugNavigate() {
    if (!activeItem) return;
    if (typeof onNavigate === "function") onNavigate(activeItem.id);
    if (typeof onClose === "function") onClose();
  }

  const mainItems = MENU_ITEMS.filter((item) => item.group === "main");
  const secondaryItems = MENU_ITEMS.filter((item) => item.group === "secondary");

  return (
    <div className="topMenuGatePopover">
      <GatePanel
        className="topMenuGate GateSurfacePremium"
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
                  className="topMenuHeaderIconButton GatePressable"
                  onClick={handleBack}
                  aria-label="Retour"
                  title="Retour"
                >
                  ‹
                </button>
              ) : null}
              <button
                type="button"
                className="topMenuHeaderIconButton GatePressable"
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
  );
}
