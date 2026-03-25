import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { GateButton, GatePanel } from "../../shared/ui/gate/Gate";

const SECTIONS = [
  {
    title: "Personnel",
    items: [
      { id: "journal", label: "Note du jour" },
      { id: "micro-actions", label: "Micro-actions" },
      { id: "history", label: "Historique" },
    ],
  },
  {
    title: "Compte",
    items: [
      { id: "settings", label: "Réglages" },
      { id: "account", label: "Compte" },
      { id: "billing", label: "Abonnement" },
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
      { id: "legal", label: "Mentions légales" },
      { id: "privacy", label: "Confidentialité" },
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
        style={{ maxWidth: 360, width: "calc(100vw - 24px)", marginLeft: 12, marginRight: "auto" }}
      >
        <div className="drawerPanelClip GateGlassClip GateGlassBackdrop">
          <GatePanel
            className="drawerPanel GateGlassContent GateSurfacePremium GateCardPremium"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            >
            <div className="drawerHeader">
              <div style={{ fontWeight: 800 }}>Menu</div>
              <GateButton
                type="button"
                variant="ghost"
                className="GatePressable"
                withSound
                onClick={() => onClose?.()}
                aria-label="Fermer le menu"
              >
                Fermer
              </GateButton>
            </div>
            <div className="drawerBody mt12 col" style={{ gap: 18 }}>
              {SECTIONS.map((section) => (
                <section key={section.title} className="col" style={{ gap: 10 }}>
                  <div className="small2" style={{ opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {section.title}
                  </div>
                  <div className="col" role="menu" aria-label={section.title} style={{ gap: 8 }}>
                    {section.items.map((item) => {
                      const selected = active === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          className={`listItem GateRowPremium GatePressable${selected ? " navBtnActive" : ""}`}
                          onClick={() => {
                            onNavigate?.(item.id);
                            onClose?.();
                          }}
                          style={{ textAlign: "left" }}
                        >
                          <div className="itemTitle">{item.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </GatePanel>
        </div>
      </div>
    </div>,
    document.body
  );
}
