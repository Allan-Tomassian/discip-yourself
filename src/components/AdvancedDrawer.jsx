import React from "react";
import { Button } from "./UI";

export default function AdvancedDrawer({ open, onClose, title = "Avancé", children }) {
  if (!open) return null;

  return (
    <div className="modalBackdrop drawerBackdrop" onClick={onClose}>
      <div className="drawerPanel" onClick={(e) => e.stopPropagation()}>
        <div className="drawerHeader">
          <div style={{ fontWeight: 800 }}>{title}</div>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
        <div className="mt12 col">{children}</div>
      </div>
    </div>
  );
}
