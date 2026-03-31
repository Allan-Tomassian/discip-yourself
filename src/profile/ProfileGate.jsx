import React from "react";
import { useProfile } from "./useProfile";

export default function ProfileGate({ children }) {
  const { loading } = useProfile();

  if (loading) {
    return (
      <div
        data-testid="profile-loading-screen"
        className="appViewportFill"
        style={{ display: "grid", placeItems: "center", padding: 24 }}
      >
        <p>Chargement...</p>
      </div>
    );
  }

  return children;
}
