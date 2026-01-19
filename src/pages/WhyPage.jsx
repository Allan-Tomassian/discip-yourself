import React, { useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Badge, Button, Card, Input, Textarea } from "../components/UI";
import { readFileAsDataUrl, uid } from "../utils/helpers";
import { computeGlobalAvgForDay, computeGlobalAvgForWeek, computeStreakDays } from "../logic/habits";
import { REWARDS, isRewardUnlocked, isRewardClaimed } from "../logic/rewards";
import { safeAlert, safePrompt } from "../utils/dialogs";

async function shareText(text) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return true;
    }
  } catch (err) {
    void err;
  }
  try {
    await navigator.clipboard.writeText(text);
    safeAlert("Copié dans le presse-papier.");
    return true;
  } catch (err) {
    void err;
    safeAlert(text);
    return false;
  }
}

export default function WhyPage({ data, setData }) {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const selected = categories.find((c) => c.id === data?.ui?.selectedCategoryId) || categories[0] || null;
  const [pendingName, setPendingName] = useState(data.profile.name || "");
  const [pendingWhy, setPendingWhy] = useState(data.profile.whyText || "");

  const dailyAvg = useMemo(() => computeGlobalAvgForDay(data, new Date()), [data]);
  const weeklyAvg = useMemo(() => computeGlobalAvgForWeek(data, new Date()), [data]);
  const streak = useMemo(() => computeStreakDays(data, new Date()), [data]);

  function addCategory() {
    const name = safePrompt("Nom :", "Nouvelle");
    if (!name) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    const color = safePrompt("Couleur HEX :", "#FFFFFF") || "#FFFFFF";
    const cleanColor = color.trim();
    const id = uid();

    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const nextCategories = [...prevCategories, { id, name: cleanName, color: cleanColor, wallpaper: "" }];
      const prevUi = prev.ui || {};
      const nextSelected = prevCategories.length === 0 ? id : prevUi.selectedCategoryId || id;
      return { ...prev, categories: nextCategories, ui: { ...prevUi, selectedCategoryId: nextSelected } };
    });
  }

  if (!categories.length) {
    return (
      <ScreenShell
        data={data}
        pageId="why"
        headerTitle="Mon pourquoi"
        headerSubtitle="Aucune catégorie"
        backgroundImage={data?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12">
              <Button onClick={addCategory}>+ Ajouter une catégorie</Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  function claim(id) {
    setData((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        rewardClaims: { ...prev.profile.rewardClaims, [id]: { claimedAt: Date.now() } },
      },
    }));
  }

  return (
    <ScreenShell
      data={data}
      pageId="why"
      headerTitle="Mon pourquoi"
      headerSubtitle={`Niveau ${data.profile.level} · XP ${data.profile.xp}`}
      backgroundImage={data.profile.whyImage || selected.wallpaper || ""}
    >
      <Card accentBorder>
        <div className="p18">
          <div className="row">
            <div>
              <div className="titleSm">Mon pourquoi</div>
              <div className="small">Centralise ici. Pas dans Réglages.</div>
            </div>
            <Badge>Essentiel</Badge>
          </div>

          <div className="mt14 col">
            <Input value={pendingName} onChange={(e) => setPendingName(e.target.value)} placeholder="Ton prénom" />
            <Textarea value={pendingWhy} onChange={(e) => setPendingWhy(e.target.value)} placeholder="Écris ton pourquoi" />

            <Button
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  profile: {
                    ...prev.profile,
                    name: (pendingName || "").trim(),
                    whyText: (pendingWhy || "").trim(),
                  },
                }))
              }
            >
              Appliquer
            </Button>

            <div className="listItem">
              <div className="row">
                <div>
                  <div className="titleSm">Image du pourquoi</div>
                  <div className="small">Optionnelle. Utilisée en fond.</div>
                </div>
                <Badge>{data.profile.whyImage ? "OK" : "—"}</Badge>
              </div>

              <div className="mt12" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label className="btn btnGhost">
                  Importer
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await readFileAsDataUrl(f);
                      setData((prev) => ({ ...prev, profile: { ...prev.profile, whyImage: url } }));
                    }}
                  />
                </label>
                <Button variant="ghost" onClick={() => setData((prev) => ({ ...prev, profile: { ...prev.profile, whyImage: "" } }))}>
                  Retirer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card accentBorder style={{ marginTop: 14 }}>
        <div className="p18">
          <div className="row">
            <div>
              <div className="titleSm">Rewards (paliers)</div>
              <div className="small">Débloque, puis “claim”.</div>
            </div>
            <Badge>{REWARDS.length}</Badge>
          </div>

          <div className="mt14 grid3">
            <div className="kpi">
              <div className="small2">Aujourd’hui</div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{Math.round(dailyAvg * 100)}%</div>
            </div>
            <div className="kpi">
              <div className="small2">Semaine</div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{Math.round(weeklyAvg * 100)}%</div>
            </div>
            <div className="kpi">
              <div className="small2">Streak</div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{streak}j</div>
            </div>
          </div>

          <div className="mt14 col">
            {REWARDS.map((r) => {
              const unlocked = isRewardUnlocked(r, data);
              const claimed = isRewardClaimed(r.id, data);

              return (
                <div key={r.id} className="listItem">
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{r.title}</div>
                      <div className="small2">
                        {r.type === "LEVEL"
                          ? `Débloqué au niveau ${r.threshold}`
                          : r.type === "DAILY_AVG"
                            ? `Palier: ${Math.round(r.threshold * 100)}% aujourd’hui`
                            : r.type === "WEEKLY_AVG"
                              ? `Palier: ${Math.round(r.threshold * 100)}% semaine`
                              : `Palier: ${r.threshold} jours`}
                      </div>
                    </div>
                    <Badge>{claimed ? "Claimed" : unlocked ? "Unlocked" : "Locked"}</Badge>
                  </div>

                  <div className="mt12 row">
                    <Button disabled={!unlocked || claimed} onClick={() => claim(r.id)}>
                      {claimed ? "Réclamée" : "Claim"}
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => shareText(r.shareText)}
                      disabled={!unlocked}
                    >
                      Partager
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
}
