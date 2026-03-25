import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateRow, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
import { BRAND_ACCENT, applyThemeTokens, getThemeName, listThemes } from "../theme/themeTokens";
import { getPlanLimits, isPremium } from "../logic/entitlements";
import { isClickSoundEnabled, setClickSoundEnabled } from "../shared/ui/sound/useClickSound";
import "../features/preferences/preferencesGate.css";

function toLabel(name) {
  if (!name) return "";
  const value = String(name).trim();
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function preserveAccentWhile(applyFn) {
  if (typeof document === "undefined") return applyFn();
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const keys = [
    "--accent",
    "--accentStrong",
    "--accentPrimary",
    "--focus",
    "--ring",
    "--accentText",
  ];
  const snapshot = {};
  for (const key of keys) snapshot[key] = cs.getPropertyValue(key);
  applyFn();
  for (const key of keys) {
    const value = snapshot[key];
    if (value != null && String(value).trim() !== "") root.style.setProperty(key, value);
  }
}

export default function Preferences({ data, setData }) {
  const safeData = data && typeof data === "object" ? data : {};
  const profile = safeData?.profile || {};
  const fallbackWallpaper = Array.isArray(safeData.categories) ? safeData.categories[0]?.wallpaper : "";
  const backgroundImage = fallbackWallpaper || profile?.whyImage || "";

  const persistedGlobalTheme = safeData?.ui?.theme;
  const savedTheme = persistedGlobalTheme || getThemeName(safeData, "home");
  const savedAccent = BRAND_ACCENT;
  const [pendingTheme, setPendingTheme] = useState(() => savedTheme || "aurora");

  const themeOptions = useMemo(() => {
    const themes = listThemes();
    const available = Array.isArray(themes) && themes.length ? themes : ["aurora"];
    return available.map((themeName) => ({ value: themeName, label: toLabel(themeName) }));
  }, []);

  useEffect(() => {
    setPendingTheme(savedTheme || "aurora");
  }, [savedTheme]);

  useEffect(() => {
    preserveAccentWhile(() => applyThemeTokens(pendingTheme, savedAccent));
    return () => {
      preserveAccentWhile(() => applyThemeTokens(savedTheme || "aurora", savedAccent));
    };
  }, [pendingTheme, savedTheme, savedAccent]);

  const isThemeDirty = pendingTheme !== (savedTheme || "aurora");

  const premium = isPremium(safeData);
  const limits = getPlanLimits();
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
          description="Choisis le thème de l'app"
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium"
          data-tour-id="settings-theme"
        >
          <div className="preferencesGateForm">
            <label className="preferencesGateField GateFormField" htmlFor="preferences-theme-select">
              <span className="preferencesGateFieldLabel GateFormLabel">Thème</span>
              <select
                id="preferences-theme-select"
                className="preferencesGateSelect GateSelectPremium"
                value={pendingTheme}
                onChange={(event) => setPendingTheme(event.target.value)}
              >
                {themeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="preferencesGateNote">
              Thème actuel : <span className="preferencesGateNoteStrong">{toLabel(savedTheme || "aurora")}</span>
            </p>
            <div className="preferencesGateActions">
              <GateButton
                type="button"
                variant="ghost"
                className="GatePressable"
                withSound
                disabled={!isThemeDirty}
                onClick={() => setPendingTheme(savedTheme || "aurora")}
              >
                Réinitialiser
              </GateButton>
              <GateButton
                type="button"
                className="GatePressable"
                withSound
                disabled={!isThemeDirty}
                onClick={() => {
                  setData((prev) => {
                    const nextUi = {
                      ...(prev.ui || {}),
                      theme: pendingTheme,
                      pageThemes: {
                        ...(prev.ui?.pageThemes || {}),
                        home: pendingTheme,
                        __default: pendingTheme,
                      },
                    };
                    return { ...prev, ui: nextUi };
                  });
                }}
              >
                Appliquer
              </GateButton>
            </div>
          </div>
        </GateSection>

        <GateSection
          title="Pourquoi"
          description="Modifiable tous les 30 jours."
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium"
          data-tour-id="settings-why"
        >
          <div className="preferencesGateForm">
            <label className="preferencesGateField GateFormField" htmlFor="preferences-why">
              <span className="preferencesGateFieldLabel GateFormLabel">Texte motivation</span>
              <textarea
                id="preferences-why"
                className="preferencesGateTextarea GateTextareaPremium"
                value={whyDraft}
                onChange={(event) => setWhyDraft(event.target.value)}
                placeholder="Ton pourquoi"
                disabled={!canEditWhy}
              />
            </label>
            {!canEditWhy ? (
              <p className="preferencesGateNote">Tu pourras modifier ton pourquoi dans {daysLeft} jours.</p>
            ) : null}
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
          className="preferencesGateCard GateSurfacePremium GateCardPremium"
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
          className="preferencesGateCard GateSurfacePremium GateCardPremium"
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
          className="preferencesGateCard GateSurfacePremium GateCardPremium"
        >
          <div className="preferencesGateSummary">
            <p className="preferencesGateNote preferencesGateNoteStrong">
              {premium ? "Premium actif" : "Version gratuite"}
            </p>
            <p className="preferencesGateNote">
              Limites free : {limits.categories} catégories · {limits.outcomes} objectifs · {limits.actions} actions
            </p>
            <div className="preferencesGateActions">
              <GateButton type="button" variant="ghost" className="GatePressable" withSound onClick={() => navigateTo("/subscription")}>
                Voir l’abonnement
              </GateButton>
            </div>
          </div>
        </GateSection>

        <GateSection
          title="Données"
          description="Export, import et sauvegarde"
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium"
        >
          <div className="preferencesGateActions">
            <GateButton type="button" variant="ghost" className="GatePressable" withSound onClick={() => navigateTo("/data")}>
              Ouvrir Données
            </GateButton>
          </div>
        </GateSection>

        <GateSection
          title="Légal & Support"
          description="Confidentialité, conditions et assistance"
          collapsible={false}
          className="preferencesGateCard GateSurfacePremium GateCardPremium"
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
