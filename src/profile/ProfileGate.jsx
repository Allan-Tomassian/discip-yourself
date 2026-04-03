import React from "react";
import { useProfile } from "./useProfile";
import { FeedbackMessage } from "../shared/ui/app";

export default function ProfileGate({ children }) {
  const { loading } = useProfile();

  if (loading) {
    return (
      <div data-testid="profile-loading-screen" className="appLoadingScreen">
        <FeedbackMessage>Chargement...</FeedbackMessage>
      </div>
    );
  }

  return children;
}
