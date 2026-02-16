import React from "react";
import { useAuth } from "./useAuth";
import LoginScreen from "./LoginScreen";

export default function AuthGate({ children }) {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <div
        data-testid="auth-loading-screen"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
      >
        <p>Chargement...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return children;
}
