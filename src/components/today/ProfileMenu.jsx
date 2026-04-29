import React from "react";
import { AppSheet, AppSheetContent } from "../../shared/ui/app";

const PROFILE_ITEMS = [
  { id: "account", label: "Profil" },
  { id: "settings", label: "Paramètres" },
  { id: "billing", label: "Abonnement" },
  { id: "support", label: "Support" },
];

export default function ProfileMenu({
  open = false,
  onClose,
  onNavigate,
  onSignOut,
}) {
  return (
    <AppSheet open={open} onClose={onClose} maxWidth={420} className="todayProfileSheetMotion">
      <AppSheetContent title="Profil" subtitle="Gérer ton compte et ton accès.">
        <div className="todayProfileMenuActions">
          {PROFILE_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="todaySheetActionButton"
              onClick={() => {
                onClose?.();
                onNavigate?.(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className="todaySheetActionButton is-danger"
            onClick={() => {
              onClose?.();
              onSignOut?.();
            }}
          >
            Déconnexion
          </button>
        </div>
      </AppSheetContent>
    </AppSheet>
  );
}
