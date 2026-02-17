import React, { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { GateButton, GateFooter, GateHeader, GatePanel, GateRow } from "../shared/ui/gate/Gate";
import "../features/navigation/topMenuGate.css";

const MENU_ITEMS = [
  { id: "account", label: "Compte / Profil", subtitle: "Username, nom, avatar", group: "main" },
  { id: "preferences", label: "Réglages", subtitle: "App / apparence", group: "main" },
  { id: "subscription", label: "Abonnement", subtitle: "Statut et options Premium", group: "main" },
  { id: "data", label: "Données", subtitle: "Exporter / importer", group: "main" },
  { id: "privacy", label: "Confidentialité", subtitle: "Politique de données", group: "secondary" },
  { id: "terms", label: "Conditions", subtitle: "Conditions d'utilisation", group: "secondary" },
  { id: "support", label: "Support", subtitle: "Contact et FAQ", group: "secondary" },
];

export default function TopMenuPopover({ onNavigate, onClose }) {
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuError, setMenuError] = useState("");

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
    if (typeof onNavigate === "function") onNavigate(itemId);
    if (typeof onClose === "function") onClose();
    setMenuError("");
  }

  const mainItems = MENU_ITEMS.filter((item) => item.group === "main");
  const secondaryItems = MENU_ITEMS.filter((item) => item.group === "secondary");

  return (
    <div className="topMenuGatePopover">
      <GatePanel className="topMenuGate" role="menu" aria-label="Menu principal">
        <GateHeader title="Menu" subtitle="Navigation rapide" className="topMenuGateHeader" />
        <div className="topMenuGateList topMenuGateSectionFlat">
          {mainItems.map((item) => (
            <GateRow
              key={item.id}
              label={item.label}
              meta={item.subtitle}
              right={<span className="topMenuGateChevron" aria-hidden="true">›</span>}
              className="topMenuGateItem topMenuGateRowFlat"
              role="menuitem"
              withSound
              onClick={() => handleAction(item.id)}
            />
          ))}
        </div>
        <div className="topMenuGateDivider" />
        <div className="topMenuGateList topMenuGateSectionFlat">
          {secondaryItems.map((item) => (
            <GateRow
              key={item.id}
              label={item.label}
              meta={item.subtitle}
              right={<span className="topMenuGateChevron" aria-hidden="true">›</span>}
              className="topMenuGateItem topMenuGateRowFlat"
              role="menuitem"
              withSound
              onClick={() => handleAction(item.id)}
            />
          ))}
        </div>
        <GateFooter className="topMenuGateFooter">
          <GateButton
            type="button"
            variant="ghost"
            className="topMenuGateLogout"
            withSound
            onClick={handleLogout}
            disabled={loggingOut}
            role="menuitem"
          >
            {loggingOut ? "Déconnexion..." : "Déconnexion"}
          </GateButton>
        </GateFooter>
      {menuError ? (
          <p className="topMenuGateError" role="alert">
            {menuError}
          </p>
        ) : null}
      </GatePanel>
    </div>
  );
}
