import React from "react";
import { GateHeader, GateRow } from "../../shared/ui/gate/Gate";
import { AppDrawer } from "../../shared/ui/app";
import { SURFACE_LABELS } from "../../ui/labels";
import "../../features/navigation/topMenuGate.css";

const SECTIONS = [
  {
    title: "Personnel",
    items: [
      { id: "journal", label: SURFACE_LABELS.journal },
      { id: "micro-actions", label: "Micro-actions" },
      { id: "history", label: SURFACE_LABELS.history },
    ],
  },
  {
    title: "Compte",
    items: [
      { id: "settings", label: SURFACE_LABELS.settings },
      { id: "account", label: SURFACE_LABELS.account },
      { id: "billing", label: SURFACE_LABELS.subscription },
    ],
  },
  {
    title: "Aide",
    items: [
      { id: "support", label: "Support" },
      { id: "faq", label: "FAQ" },
    ],
  },
  {
    title: "Légal",
    items: [
      { id: "legal", label: SURFACE_LABELS.legal },
      { id: "privacy", label: SURFACE_LABELS.privacy },
    ],
  },
];

export default function MainDrawer({ open = false, active = "", onClose, onNavigate }) {
  if (!open) return null;

  return (
    <AppDrawer
      open={open}
      onClose={onClose}
      ariaLabel="Menu principal"
      className="drawerBackdrop"
      panelClassName="drawerPanel drawerMenuPanel"
    >
      <GateHeader
        className="drawerHeader drawerMenuHeader"
        title="Menu"
        subtitle="Pages secondaires et surfaces utilitaires."
        actions={
          <button
            type="button"
            className="GateIconButtonPremium GatePressable drawerMenuCloseBtn"
            onClick={() => onClose?.()}
            aria-label="Fermer le menu"
            title="Fermer"
          >
            ×
          </button>
        }
      />
      <div className="drawerBody">
        <nav className="drawerMenuBody" aria-label="Navigation secondaire">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="drawerMenuGroup"
              aria-labelledby={`drawer-menu-group-${section.title}`}
            >
              <div
                id={`drawer-menu-group-${section.title}`}
                className="GateRoleSectionTitle drawerMenuSectionTitle"
              >
                {section.title}
              </div>
              <div className="drawerMenuItems" role="group" aria-label={section.title}>
                {section.items.map((item) => {
                  const selected = active === item.id;
                  return (
                    <GateRow
                      key={item.id}
                      role="menuitem"
                      label={item.label}
                      withSound
                      selected={selected}
                      className="GateRowPremium GateInlineMetaCard GatePressable drawerMenuItem"
                      aria-current={selected ? "page" : undefined}
                      onClick={() => {
                        onNavigate?.(item.id);
                        onClose?.();
                      }}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </div>
    </AppDrawer>
  );
}
