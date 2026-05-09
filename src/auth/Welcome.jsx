import React from "react";
import { PrimaryButton, SecondaryButton } from "../shared/ui/app";
import FirstAccessShell from "../features/first-access/FirstAccessShell";
import AuthCommandSurface, { AuthSecureNote } from "../features/first-access/AuthCommandSurface";

export default function Welcome({ onNavigate }) {
  return (
    <FirstAccessShell variant="welcome">
      <AuthCommandSurface
        data-testid="auth-welcome-screen"
        tone="welcome"
        showIcon={false}
        eyebrow="Système avant motivation"
        title=""
        subtitle=""
        bodyClassName="authWelcomeStack"
      >
        <div className="authWelcomeIdentity">
          <div className="authWelcomeProduct">
            Discip <span>Yourself</span>
          </div>
          <div className="authWelcomeRule" aria-hidden="true" />
        </div>

        <h1 className="authWelcomeHeadline">
          Tu n’as pas besoin de motivation.
          <br />
          <strong>Tu as besoin d’un système.</strong>
        </h1>

        <p className="authWelcomeSubcopy">
          Reprends le contrôle. Exécute chaque jour. Construis une structure qui tient.
        </p>

        <div className="authActionStack">
          <PrimaryButton type="button" onClick={() => onNavigate("/auth/signup")}>
            Commencer
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => onNavigate("/auth/login")}>
            Se connecter
          </SecondaryButton>
        </div>

        <AuthSecureNote>Ton système. Tes données. Accès sécurisé.</AuthSecureNote>
      </AuthCommandSurface>
    </FirstAccessShell>
  );
}
