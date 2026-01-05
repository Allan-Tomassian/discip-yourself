import React, { useEffect, useState } from "react";
import ScreenShell from "./_ScreenShell";
import ThemePicker from "../components/ThemePicker";
import { Button, Card, Textarea } from "../components/UI";

// TOUR MAP:
// - primary_action: adjust settings and replay onboarding/tutorial
// - key_elements: theme picker, motivation editor, intro actions, notifications info
// - optional_elements: none
function MotivationSection({ data, setData }) {
  const profile = data?.profile || {};
  const [whyDraft, setWhyDraft] = useState(profile.whyText || "");

  useEffect(() => {
    setWhyDraft(profile.whyText || "");
  }, [profile.whyText]);

  const lastUpdatedMs = profile.whyUpdatedAt ? Date.parse(profile.whyUpdatedAt) : 0;
  const daysSince = lastUpdatedMs ? Math.floor((Date.now() - lastUpdatedMs) / (24 * 60 * 60 * 1000)) : 999;
  const daysLeft = profile.plan === "premium" ? 0 : Math.max(0, 30 - daysSince);
  const canEditWhy = profile.plan === "premium" || daysLeft === 0;
  const cleanWhy = (whyDraft || "").trim();
  const whyChanged = cleanWhy !== (profile.whyText || "").trim();

  return (
    <Card accentBorder style={{ marginTop: 14 }} data-tour-id="settings-why">
      <div className="p18 col">
        <div className="sectionTitle textAccent">Pourquoi</div>
        <div className="sectionSub" style={{ marginTop: 6 }}>
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

export default function Settings({ data, setData }) {
  const safeData = data && typeof data === "object" ? data : {};
  const themeData = safeData.ui && typeof safeData.ui === "object" ? safeData : { ...safeData, ui: {} };
  const fallbackWallpaper = Array.isArray(safeData.categories) ? safeData.categories[0]?.wallpaper : "";
  const backgroundImage = fallbackWallpaper || safeData.profile?.whyImage || "";

  return (
    <ScreenShell
      data={safeData}
      pageId="settings"
      headerTitle={<span className="textAccent" data-tour-id="settings-title">Réglages</span>}
      headerSubtitle="Essentiel"
      backgroundImage={backgroundImage}
    >
      <div className="col">
        <div data-tour-id="settings-theme">
          <ThemePicker data={themeData} setData={setData} />
        </div>
        <MotivationSection data={safeData} setData={setData} />
        <Card accentBorder style={{ marginTop: 14 }}>
          <div className="p18 col">
            <div className="sectionTitle textAccent">Introduction</div>
            <div className="sectionSub" style={{ marginTop: 6 }}>
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
        <Card accentBorder style={{ marginTop: 14 }} data-tour-id="settings-notifications">
          <div className="p18 col">
            <div className="sectionTitle textAccent">Notifications</div>
            <div className="sectionSub" style={{ marginTop: 6 }}>
              Les notifications système (son/vibration) nécessitent une version PWA. À venir.
            </div>
            <div className="mt10">
              <Button disabled variant="ghost">
                Activer · Bientôt
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
