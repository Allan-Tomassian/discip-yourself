import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { GateHeader, GatePanel, GateRow } from "../../shared/ui/gate/Gate";
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

export default function MainDrawer({
  open = false,
  active = "",
  onClose,
  onNavigate,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const { body, documentElement } = document;
    const scrollY = typeof window !== "undefined" ? window.scrollY || 0 : 0;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousHtmlOverflow = documentElement.style.overflow;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    documentElement.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      documentElement.style.overflow = previousHtmlOverflow;
      if (typeof window !== "undefined") {
        window.scrollTo(0, scrollY);
      }
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modalBackdrop drawerBackdrop"
      onClick={() => onClose?.()}
      role="presentation"
      style={{ zIndex: 1400 }}
    >
      <div
        className="drawerPanelOuter GateGlassOuter"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawerPanelClip GateGlassClip GateGlassBackdrop">
          <GatePanel
            className="drawerPanel drawerMenuPanel GateGlassContent GateMainSection GateMainSectionCard GateSurfacePremium GateCardPremium"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
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
          </GatePanel>
        </div>
      </div>
    </div>,
    document.body
  );
}
