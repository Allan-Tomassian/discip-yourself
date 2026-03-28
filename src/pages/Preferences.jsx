import React, { useEffect, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateRow, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
import { DEFAULT_THEME } from "../theme/themeTokens";
import { getPlanLimits, isPremium } from "../logic/entitlements";
import { isClickSoundEnabled, setClickSoundEnabled } from "../shared/ui/sound/useClickSound";
import { MARKETING_COPY, PLACEHOLDER_COPY, SURFACE_LABELS } from "../ui/labels";
import "../features/preferences/preferencesGate.css";

export default function Preferences({ data, setData }) {
  const safeData = data && typeof data === "object" ? data : {};
  const profile = safeData?.profile || {};
  const fallbackWallpaper = Array.isArray(safeData.categories) ? safeData.categories[0]?.wallpaper : "";
  const backgroundImage = fallbackWallpaper || profile?.whyImage || "";

  const premium = isPremium(safeData);
  const limits = getPlanLimits();
  const visualSystemLabel = DEFAULT_THEME.charAt(0).toUpperCase() + DEFAULT_THEME.slice(1);
  const [soundEnabled, setSoundEnabledState] = useState(() => isClickSoundEnabled());

  const [whyDraft, setWhyDraft] = useState(profile.whyText || "");
  useEffect(() => {
    setWhyDraft(profile.whyText || "");
  }, [profile.whyText]);

  const nowMs = Date.now();
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
    setSoundEnabled(next);
    setSoundEnabledState(next);
  }

  return (
    <ScreenShell data={safeData} pageId="settings" backgroundImage={backgroundImage}>
      <GatePage
        className="preferencesGatePage"
        title={<span className="GatePageTitle" data-tour-id="settings-title">Réglages</span>}
        subtitle={<span className="GatePageSubtitle">App, apparence et préférences</span>}
      >
        <GateSection
          title="Apparence"
          description="Le design system global est appliqué partout dans l’app."
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium GateSecondarySectionCard"
          data-tour-id="settings-theme"
        >
          <div className="preferencesGateSummary">
            <p className="preferencesGateNote preferencesGateNoteStrong GateRoleCardTitle">
              Système visuel actif : {visualSystemLabel}
            </p>
            <p className="preferencesGateNote GateRoleHelperText">
              Toutes les surfaces partagent désormais le même thème sombre, calme et responsive.
            </p>
            <p className="preferencesGateNote GateRoleHelperText">
              Les anciennes préférences visuelles sont conservées uniquement pour compatibilité technique, sans effet sur l’interface.
            </p>
          </div>
        </GateSection>

        <GateSection
          title="Pourquoi"
          description="Modifiable tous les 30 jours."
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium GateSecondarySectionCard"
          data-tour-id="settings-why"
        >
          <div className="preferencesGateForm">
            <label className="preferencesGateField GateFormField" htmlFor="preferences-why">
              <span className="preferencesGateFieldLabel GateFormLabel">Ton pourquoi</span>
              <textarea
                id="preferences-why"
                className="preferencesGateTextarea GateTextareaPremium"
                value={whyDraft}
                onChange={(event) => setWhyDraft(event.target.value)}
                placeholder={PLACEHOLDER_COPY.whyText}
                disabled={!canEditWhy}
              />
            </label>
            {!canEditWhy ? <p className="preferencesGateNote GateRoleHelperText">Tu pourras modifier ton pourquoi dans {daysLeft} jours.</p> : null}
            <div className="preferencesGateActions">
                <GateButton
                  type="button"
                  className="GatePressable"
                  withSound
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
              </GateButton>
            </div>
          </div>
        </GateSection>

        <GateSection
          title="Introduction"
          description="Relancer onboarding et tutoriel"
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
          <div className="preferencesGateActions preferencesGateActionsColumn">
            <GateButton
              type="button"
              className="GatePressable"
              withSound
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
            </GateButton>
            <GateButton
              type="button"
              variant="ghost"
              className="GatePressable"
              withSound
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
            </GateButton>
          </div>
        </GateSection>

        <GateSection
          title="Interactions"
          description="Animation pression + son optionnel"
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
          <GateRow
            className="preferencesGateRowControl GatePressable"
            label="Son des interactions"
            meta={soundEnabled ? "Activé" : "Désactivé"}
            withSound
            onClick={toggleSound}
            right={
              <GateButton
                type="button"
                variant="ghost"
                className="preferencesGateToggleButton GatePressable"
                withSound
                onClick={(event) => {
                  event.stopPropagation();
                  toggleSound();
                }}
              >
                {soundEnabled ? "ON" : "OFF"}
              </GateButton>
            }
          />
        </GateSection>

        <GateSection
          title="Abonnement"
          description="Résumé rapide de ton plan"
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
          <div className="preferencesGateSummary">
            <p className="preferencesGateNote preferencesGateNoteStrong GateRoleCardTitle">
              {premium ? MARKETING_COPY.premiumPlan : MARKETING_COPY.essentialPlan}
            </p>
            <p className="preferencesGateNote GateRoleHelperText">
              {MARKETING_COPY.premiumLimitsPrefix} : {limits.categories} catégories · {limits.outcomes} objectifs · {limits.actions} actions
            </p>
            <div className="preferencesGateActions">
              <GateButton type="button" variant="ghost" className="GatePressable" withSound onClick={() => navigateTo("/subscription")}>
                Ouvrir {SURFACE_LABELS.subscription.toLowerCase()}
              </GateButton>
            </div>
          </div>
        </GateSection>

        <GateSection
          title="Données"
          description="Export, import et sauvegarde"
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
          <div className="preferencesGateActions">
            <GateButton type="button" variant="ghost" className="GatePressable" withSound onClick={() => navigateTo("/data")}>
              Ouvrir les données
            </GateButton>
          </div>
        </GateSection>

        <GateSection
          title="Légal & Support"
          description="Confidentialité, conditions et assistance"
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
          <div className="preferencesGateLinks">
            <GateButton type="button" variant="ghost" className="GatePressable" withSound onClick={() => navigateTo("/privacy")}>
              Confidentialité
            </GateButton>
            <GateButton type="button" variant="ghost" className="GatePressable" withSound onClick={() => navigateTo("/terms")}>
              Conditions
            </GateButton>
            <GateButton type="button" variant="ghost" className="GatePressable" withSound onClick={() => navigateTo("/support")}>
              Support
            </GateButton>
          </div>
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
