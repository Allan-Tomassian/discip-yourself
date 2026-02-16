import React from "react";
import { Button, Card } from "../components/UI";
import { useProfile } from "./useProfile";
import ProfileSetupScreen from "./ProfileSetupScreen";

export default function ProfileGate({ children }) {
  const { loading, profile, loadError, refreshProfile } = useProfile();
  const hasUsername = Boolean(String(profile?.username || "").trim());

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

  if (loadError) {
    return (
      <div
        data-testid="profile-load-error-screen"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
      >
        <Card style={{ width: "100%", maxWidth: 460, padding: 20 }}>
          <h1 style={{ margin: "0 0 12px" }}>Profil indisponible</h1>
          <p style={{ margin: "0 0 16px", color: "#EF4444" }}>{loadError}</p>
          <Button
            type="button"
            data-testid="profile-load-retry-button"
            onClick={() => {
              refreshProfile().catch(() => {});
            }}
          >
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  if (!profile || !hasUsername) {
    return <ProfileSetupScreen />;
  }

  return children;
}
