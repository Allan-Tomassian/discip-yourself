import React, { useEffect, useState } from "react";
import ScreenShell from "./_ScreenShell";
import ThemePicker from "../components/ThemePicker";
import { Button, Card, Textarea } from "../components/UI";
import { getPlanLimits, isPremium } from "../logic/entitlements";
import { LABELS } from "../ui/labels";

// TOUR MAP:
// - primary_action: adjust settings and replay onboarding/tutorial
// - key_elements: theme picker, motivation editor, intro actions, notifications info
// - optional_elements: none
function MotivationSection({ data, setData }) {
  const profile = data?.profile || {};
  const isPremiumPlan = isPremium(data);
  const [whyDraft, setWhyDraft] = useState(profile.whyText || "");
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    setWhyDraft(profile.whyText || "");
  }, [profile.whyText]);

  const lastUpdatedMs = profile.whyUpdatedAt ? Date.parse(profile.whyUpdatedAt) : 0;
  const daysSince =
    nowMs && lastUpdatedMs ? Math.floor((nowMs - lastUpdatedMs) / (24 * 60 * 60 * 1000)) : 999;
  const daysLeft = isPremiumPlan ? 0 : Math.max(0, 30 - daysSince);
  const canEditWhy = isPremiumPlan || daysLeft === 0;
  const cleanWhy = (whyDraft || "").trim();
  const whyChanged = cleanWhy !== (profile.whyText || "").trim();

  return (
    <Card accentBorder className="mt14" data-tour-id="settings-why">
      <div className="p18 col">
        <div className="sectionTitle">Pourquoi</div>
        <div className="sectionSub mt6">
          Modifiable tous les 30 jours.
        </div>
        <div className="mt10 col">
          <Textarea
            value={whyDraft}
            onChange={(e) => setWhyDraft(e.target.value)}
            placeholder="Ton pourquoi"
            disabled={!canEditWhy}
          />
          {!canEditWhy ? (
            <div className="small2">Tu pourras modifier ton pourquoi dans {daysLeft} jours.</div>
          ) : null}
          <Button
            variant={canEditWhy ? "primary" : "ghost"}
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
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function Settings({
  data,
  setData,
  onOpenPrivacy,
  onOpenTerms,
  onOpenSupport,
  onOpenPaywall,
  onRestorePurchases,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const themeData = safeData.ui && typeof safeData.ui === "object" ? safeData : { ...safeData, ui: {} };
  const fallbackWallpaper = Array.isArray(safeData.categories) ? safeData.categories[0]?.wallpaper : "";
  const backgroundImage = fallbackWallpaper || safeData.profile?.whyImage || "";
  const isPremiumPlan = isPremium(safeData);
  const limits = getPlanLimits();
  const entitlements =
    safeData?.profile?.entitlements && typeof safeData.profile.entitlements === "object"
      ? safeData.profile.entitlements
      : {};
  const expiryMs = entitlements?.expiresAt ? Date.parse(entitlements.expiresAt) : NaN;
  const expiryLabel = Number.isFinite(expiryMs) ? new Date(expiryMs).toLocaleDateString() : "";
  const showExpiry = Boolean(expiryLabel);
  const isIOS = globalThis?.Capacitor?.getPlatform ? globalThis.Capacitor.getPlatform() === "ios" : false;

  function downloadJsonFile(filename, payload) {
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      void err;
    }
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="settings"
      headerTitle={<span data-tour-id="settings-title">Réglages</span>}
      headerSubtitle="Essentiel"
      backgroundImage={backgroundImage}
    >
      <div className="col">
        <div data-tour-id="settings-theme">
          <ThemePicker data={themeData} setData={setData} />
        </div>
        <MotivationSection data={safeData} setData={setData} />
        <Card accentBorder className="mt14">
          <div className="p18 col">
            <div className="sectionTitle">Abonnement</div>
            <div className="sectionSub mt6">
              {isPremiumPlan ? "Premium actif" : "Version gratuite"}
            </div>
            <div className="mt10 col">
              <div className="small2">
                Limites gratuites : {limits.categories} catégories · {limits.outcomes} {LABELS.goalsLower} · {limits.actions} {LABELS.actionsLower}
              </div>
              {isPremiumPlan && showExpiry ? (
                <div className="small2">Expire le {expiryLabel}</div>
              ) : null}
              <Button
                onClick={() => {
                  if (isPremiumPlan) return;
                  if (typeof onOpenPaywall === "function") onOpenPaywall("Limites premium");
                }}
                disabled={isPremiumPlan}
              >
                {isPremiumPlan ? "Premium activé" : "Passer Premium"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (typeof onRestorePurchases === "function") {
                    onRestorePurchases();
                    return;
                  }
                  if (typeof onOpenPaywall === "function") onOpenPaywall("Restaurer un achat");
                }}
              >
                Restaurer
              </Button>
              {isIOS ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.open("https://apps.apple.com/account/subscriptions", "_blank");
                  }}
                >
                  Gérer l’abonnement
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
        <Card accentBorder className="mt14">
          <div className="p18 col">
            <div className="sectionTitle">Données</div>
            <div className="sectionSub mt6">
              Export JSON complet de l’app.
            </div>
            <div className="mt10">
              <Button
                onClick={() => {
                  if (!isPremiumPlan) {
                    if (typeof onOpenPaywall === "function") onOpenPaywall("Export des données");
                    return;
                  }
                  downloadJsonFile("discip-yourself-data.json", safeData);
                }}
              >
                Exporter mes données (JSON)
              </Button>
            </div>
          </div>
        </Card>
        <Card accentBorder className="mt14">
          <div className="p18 col">
            <div className="sectionTitle">Introduction</div>
            <div className="sectionSub mt6">
              Revoir l’accueil et relancer le tutoriel.
            </div>
            <div className="mt10 col">
              <Button
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
              </Button>
              <Button
                variant="ghost"
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
              </Button>
            </div>
          </div>
        </Card>
        <Card accentBorder className="mt14" data-tour-id="settings-notifications">
          <div className="p18 col">
            <div className="sectionTitle">Notifications</div>
            <div className="sectionSub mt6">
              Les notifications seront disponibles avec la version iOS (TestFlight), puis l’App Store.
            </div>
            <div className="mt10">
              <Button disabled variant="ghost">
                Activer · Bientôt
              </Button>
            </div>
          </div>
        </Card>
        <Card accentBorder className="mt14">
          <div className="p18 col">
            <div className="sectionTitle">Légal & Support</div>
            <div className="sectionSub mt6">
              Informations légales et assistance.
            </div>
            <div className="mt10 col">
              <Button
                variant="ghost"
                onClick={() => (typeof onOpenPrivacy === "function" ? onOpenPrivacy() : null)}
              >
                Confidentialité
              </Button>
              <Button
                variant="ghost"
                onClick={() => (typeof onOpenTerms === "function" ? onOpenTerms() : null)}
              >
                Conditions
              </Button>
              <Button
                variant="ghost"
                onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}
              >
                Support
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
