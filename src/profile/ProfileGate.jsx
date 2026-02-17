import React from "react";
import { useProfile } from "./useProfile";
import { isProfileComplete } from "./profileApi";

function redirectToAccount() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/account") return;
  window.history.replaceState({}, "", "/account");
}

export default function ProfileGate({ children }) {
  const { loading, profile } = useProfile();

  if (loading) {
    return (
      <div
        data-testid="profile-loading-screen"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
      >
        <p>Chargement...</p>
      </div>
    );
  }

  if (!profile || !isProfileComplete(profile)) {
    redirectToAccount();
  }

  return children;
}
