import React, { useEffect, useState } from "react";
import { DEFAULT_THEME } from "../theme/themeTokens";
import { getPlanLimits, isPremium } from "../logic/entitlements";
import { isClickSoundEnabled, setClickSoundEnabled } from "../shared/ui/sound/useClickSound";
import { MARKETING_COPY, PLACEHOLDER_COPY, SURFACE_LABELS } from "../ui/labels";
import {
  AppActionRow,
  AppCard,
  AppScreen,
  AppSettingRow,
  AppTextarea,
  GhostButton,
  FieldGroup,
  PrimaryButton,
  SectionHeader,
} from "../shared/ui/app";
import "../features/preferences/preferencesGate.css";

export default function Preferences({ data, setData }) {
  const safeData = data && typeof data === "object" ? data : {};
  const profile = safeData?.profile || {};

  const premium = isPremium(safeData);
  const limits = getPlanLimits();
  const visualSystemLabel = DEFAULT_THEME.charAt(0).toUpperCase() + DEFAULT_THEME.slice(1);
  const [soundEnabled, setSoundEnabledState] = useState(() => isClickSoundEnabled());
  const [nowMs] = useState(() => Date.now());

  const [whyDraft, setWhyDraft] = useState(profile.whyText || "");
  useEffect(() => {
    setWhyDraft(profile.whyText || "");
  }, [profile.whyText]);

  const lastUpdatedMs = profile.whyUpdatedAt ? Date.parse(profile.whyUpdatedAt) : 0;
  const rawDaysSince =
    Number.isFinite(nowMs) && Number.isFinite(lastUpdatedMs) && lastUpdatedMs > 0
      ? Math.floor((nowMs - lastUpdatedMs) / (24 * 60 * 60 * 1000))
      : 999;
  const daysSince = Number.isFinite(rawDaysSince) ? Math.max(0, rawDaysSince) : 999;
  const daysLeft = premium ? 0 : Math.max(0, 30 - daysSince);
  const canEditWhy = premium || daysLeft === 0;
  const cleanWhy = (whyDraft || "").trim();
  const whyChanged = cleanWhy !== (profile.whyText || "").trim();

  function navigateTo(path) {
    if (typeof window === "undefined") return;
    window.location.assign(path);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setClickSoundEnabled(next);
    setSoundEnabledState(next);
  }

  return (
    <AppScreen
      data={safeData}
      pageId="settings"
      headerTitle={<span data-tour-id="settings-title">Réglages</span>}
      headerSubtitle="App, apparence et préférences"
    >
      <section className="mainPageSection">
        <SectionHeader
          title="Apparence"
          subtitle="Le design system global est appliqué partout dans l’app."
        />
        <div className="mainPageSectionBody preferencesGateSummary" data-tour-id="settings-theme">
          <p className="preferencesGateNote preferencesGateNoteStrong">
            Système visuel actif : {visualSystemLabel}
          </p>
          <p className="preferencesGateNote">
            Toutes les surfaces partagent désormais le même thème sombre, calme et responsive.
          </p>
          <p className="preferencesGateNote">
            Les anciennes préférences visuelles sont conservées uniquement pour compatibilité technique, sans effet sur l’interface.
          </p>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader
          title="Pourquoi"
          subtitle="Modifiable tous les 30 jours."
        />
        <div className="mainPageSectionBody">
          <AppCard className="preferencesGateCard" data-tour-id="settings-why">
            <div className="preferencesGateForm">
              <div className="preferencesGateSummary">
                <FieldGroup label="Ton pourquoi" htmlFor="preferences-why">
                  <AppTextarea
                    id="preferences-why"
                    className="preferencesGateTextarea"
                    value={whyDraft}
                    onChange={(event) => setWhyDraft(event.target.value)}
                    placeholder={PLACEHOLDER_COPY.whyText}
                    disabled={!canEditWhy}
                  />
                </FieldGroup>
                {!canEditWhy ? (
                  <p className="preferencesGateNote">
                    Tu pourras modifier ton pourquoi dans {daysLeft} jours.
                  </p>
                ) : null}
              </div>
              <AppActionRow className="preferencesGateActions">
                <PrimaryButton
                  type="button"
                  disabled={!canEditWhy || !cleanWhy || !whyChanged}
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      profile: {
                        ...prev.profile,
                        whyText: cleanWhy,
                        whyUpdatedAt: new Date().toISOString(),
                      },
                    }))
                  }
                >
                  Enregistrer
                </PrimaryButton>
              </AppActionRow>
            </div>
          </AppCard>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader
          title="Introduction"
          subtitle="Relancer l’introduction ou le tutoriel produit."
        />
        <div className="mainPageSectionBody">
          <AppActionRow align="start" className="preferencesGateActions preferencesGateActionsColumn">
            <PrimaryButton
              type="button"
              size="sm"
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  ui: {
                    ...(prev.ui || {}),
                    onboardingSeenVersion: 0,
                    onboardingCompleted: false,
                  },
                }))
              }
              data-tour-id="settings-replay-onboarding"
            >
              Revoir l’introduction
            </PrimaryButton>
            <GhostButton
              type="button"
              size="sm"
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  ui: {
                    ...(prev.ui || {}),
                    tutorialEnabled: true,
                    tutorialStep: 0,
                    tourForceStart: true,
                    tourStepIndex: 0,
                  },
                }))
              }
              data-tour-id="settings-restart-tutorial"
            >
              Relancer le tutoriel
            </GhostButton>
          </AppActionRow>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader
          title="Interactions"
          subtitle="Animation de pression et son optionnel."
        />
        <div className="mainPageSectionBody">
          <AppSettingRow
            className="preferencesGateRowControl"
            label="Son des interactions"
            meta={soundEnabled ? "Activé" : "Désactivé"}
            withSound
            onClick={toggleSound}
            right={
              <GhostButton
                type="button"
                size="sm"
                className="preferencesGateToggleButton"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleSound();
                }}
              >
                {soundEnabled ? "ON" : "OFF"}
              </GhostButton>
            }
          />
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader
          title="Abonnement"
          subtitle="Résumé rapide de ton plan."
        />
        <div className="mainPageSectionBody preferencesGateSummary">
          <p className="preferencesGateNote preferencesGateNoteStrong">
            {premium ? MARKETING_COPY.premiumPlan : MARKETING_COPY.essentialPlan}
          </p>
          <p className="preferencesGateNote">
            {MARKETING_COPY.premiumLimitsPrefix} : {limits.categories} catégories · {limits.outcomes} objectifs · {limits.actions} actions
          </p>
          <AppActionRow align="start" className="preferencesGateActions">
            <GhostButton
              type="button"
              size="sm"
              onClick={() => navigateTo("/subscription")}
            >
              Ouvrir {SURFACE_LABELS.subscription.toLowerCase()}
            </GhostButton>
          </AppActionRow>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader
          title="Données"
          subtitle="Export, import et sauvegarde."
        />
        <div className="mainPageSectionBody">
          <AppActionRow align="start" className="preferencesGateActions">
            <GhostButton
              type="button"
              size="sm"
              onClick={() => navigateTo("/data")}
            >
              Ouvrir les données
            </GhostButton>
          </AppActionRow>
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader
          title="Légal et support"
          subtitle="Confidentialité, conditions et assistance."
        />
        <div className="mainPageSectionBody">
          <div className="preferencesGateLinks">
            <GhostButton
              type="button"
              size="sm"
              onClick={() => navigateTo("/privacy")}
            >
              Confidentialité
            </GhostButton>
            <GhostButton
              type="button"
              size="sm"
              onClick={() => navigateTo("/terms")}
            >
              Conditions
            </GhostButton>
            <GhostButton
              type="button"
              size="sm"
              onClick={() => navigateTo("/support")}
            >
              Support
            </GhostButton>
          </div>
        </div>
      </section>
    </AppScreen>
  );
}
