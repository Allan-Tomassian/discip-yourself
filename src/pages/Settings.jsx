import React, { useEffect, useState } from "react";
import ScreenShell from "./_ScreenShell";
import ThemePicker from "../components/ThemePicker";
import { Button, Card, Textarea } from "../components/UI";

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
    <Card accentBorder style={{ marginTop: 14 }}>
      <div className="p18 col">
        <div className="titleSm">Pourquoi</div>
        <div className="small2" style={{ marginTop: 6 }}>
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
      headerTitle="Réglages"
      headerSubtitle="Essentiel"
      backgroundImage={backgroundImage}
    >
      <div className="col">
        <ThemePicker data={themeData} setData={setData} />
        <MotivationSection data={safeData} setData={setData} />
        <Card accentBorder style={{ marginTop: 14 }}>
          <div className="p18">
            <div className="titleSm">Notifications</div>
            <div className="small2" style={{ marginTop: 6 }}>
              Bientôt disponible.
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
